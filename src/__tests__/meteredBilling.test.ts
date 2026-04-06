import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MeteredBillingService } from '@/lib/billing/meteredBilling';
import { UsageTrackingService } from '@/lib/billing/usageTracking';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    meteredBillingPlan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    customerMeteredSubscription: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    usageMetric: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

// Mock InvoiceService
vi.mock('@/lib/stripe/invoices', () => ({
  InvoiceService: {
    createInvoice: vi.fn().mockResolvedValue({
      id: 'invoice-123',
      invoiceNumber: 'INV-001',
      amount: 5000, // $50.00
    }),
  },
}));

describe('MeteredBillingService', () => {
  const mockPlan = {
    id: 'plan-123',
    partnerId: 'partner-123',
    name: 'Call Minutes Plan',
    metricType: 'minutes',
    metricName: 'call_minutes',
    pricingModel: 'tiered',
    pricingTiers: [
      { upTo: 100, price: 10 }, // $0.10 per minute for first 100 minutes
      { upTo: 500, price: 8 },  // $0.08 per minute for next 400 minutes
      { upTo: null, price: 5 }, // $0.05 per minute for 500+ minutes
    ],
    billingCycle: 'monthly',
    minimumCharge: 500, // $5.00 minimum
    includedUnits: 50, // 50 free minutes
    isActive: true,
  };

  const mockSubscription = {
    id: 'sub-123',
    customerId: 'customer-123',
    partnerId: 'partner-123',
    planId: 'plan-123',
    status: 'active',
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-01-31'),
    nextBillingDate: new Date('2024-01-31'),
    plan: mockPlan,
    customer: {
      id: 'customer-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
    partner: {
      id: 'partner-123',
      businessName: 'Test Business',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPlan', () => {
    it('should create a metered billing plan', async () => {
      (prisma.meteredBillingPlan.create as any).mockResolvedValue(mockPlan);

      const planData = {
        partnerId: 'partner-123',
        name: 'Call Minutes Plan',
        metricType: 'minutes',
        metricName: 'call_minutes',
        pricingModel: 'tiered' as const,
        pricingTiers: mockPlan.pricingTiers,
        billingCycle: 'monthly' as const,
        minimumCharge: 5.00,
        includedUnits: 50,
      };

      const result = await MeteredBillingService.createPlan(planData);

      expect(result).toEqual(mockPlan);
      expect(prisma.meteredBillingPlan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          partnerId: 'partner-123',
          name: 'Call Minutes Plan',
          metricType: 'minutes',
          metricName: 'call_minutes',
          pricingModel: 'tiered',
        }),
      });
    });
  });

  describe('subscribeCustomer', () => {
    it('should subscribe customer to metered billing plan', async () => {
      (prisma.meteredBillingPlan.findUnique as any).mockResolvedValue(mockPlan);
      (prisma.customerMeteredSubscription.create as any).mockResolvedValue(mockSubscription);

      const result = await MeteredBillingService.subscribeCustomer(
        'customer-123',
        'partner-123',
        'plan-123'
      );

      expect(result).toEqual(mockSubscription);
      expect(prisma.customerMeteredSubscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: 'customer-123',
          partnerId: 'partner-123',
          planId: 'plan-123',
          status: 'active',
        }),
      });
    });

    it('should throw error if plan not found', async () => {
      (prisma.meteredBillingPlan.findUnique as any).mockResolvedValue(null);

      await expect(
        MeteredBillingService.subscribeCustomer('customer-123', 'partner-123', 'plan-123')
      ).rejects.toThrow('Plan not found or access denied');
    });
  });

  describe('calculateMeteredCharges', () => {
    it('should calculate flat rate pricing correctly', () => {
      const flatPlan = {
        pricingModel: 'flat',
        pricingTiers: [{ upTo: null, price: 10 }], // $0.10 per unit
        includedUnits: { valueOf: () => 10 } as any,
        minimumCharge: { valueOf: () => 100 } as any, // $1.00 minimum
      };

      const result = MeteredBillingService.calculateMeteredCharges(25, flatPlan);

      expect(result).toEqual({
        totalUsage: 25,
        includedUsage: 10,
        billableUsage: 15,
        totalCost: 1.5, // 15 units * $0.10
        minimumCharge: 1.0,
        finalAmount: 1.5,
        tierBreakdown: [
          {
            tier: 1,
            upTo: null,
            usage: 15,
            rate: 0.1,
            cost: 1.5,
          },
        ],
      });
    });

    it('should calculate tiered pricing correctly', () => {
      const tieredPlan = {
        pricingModel: 'tiered',
        pricingTiers: [
          { upTo: 100, price: 10 }, // $0.10 for first 100
          { upTo: 200, price: 8 },  // $0.08 for next 100
          { upTo: null, price: 5 }, // $0.05 for 200+
        ],
        includedUnits: { valueOf: () => 50 } as any,
        minimumCharge: { valueOf: () => 0 } as any,
      };

      // Test usage: 250 total, 50 included = 200 billable
      // Tier 1: 100 units * $0.10 = $10.00
      // Tier 2: 100 units * $0.08 = $8.00
      // Total: $18.00
      const result = MeteredBillingService.calculateMeteredCharges(250, tieredPlan);

      expect(result.totalUsage).toBe(250);
      expect(result.includedUsage).toBe(50);
      expect(result.billableUsage).toBe(200);
      expect(result.totalCost).toBe(18.0);
      expect(result.finalAmount).toBe(18.0);
      expect(result.tierBreakdown).toHaveLength(2);
      expect(result.tierBreakdown[0]).toEqual({
        tier: 1,
        upTo: 100,
        usage: 100,
        rate: 0.1,
        cost: 10.0,
      });
      expect(result.tierBreakdown[1]).toEqual({
        tier: 2,
        upTo: 200,
        usage: 100,
        rate: 0.08,
        cost: 8.0,
      });
    });

    it('should apply minimum charge when total cost is below minimum', () => {
      const plan = {
        pricingModel: 'flat',
        pricingTiers: [{ upTo: null, price: 1 }], // $0.01 per unit
        includedUnits: { valueOf: () => 0 } as any,
        minimumCharge: { valueOf: () => 500 } as any, // $5.00 minimum
      };

      const result = MeteredBillingService.calculateMeteredCharges(10, plan);

      expect(result.totalCost).toBe(0.1); // 10 * $0.01
      expect(result.minimumCharge).toBe(5.0);
      expect(result.finalAmount).toBe(5.0); // Applied minimum
    });

    it('should handle volume pricing correctly', () => {
      const volumePlan = {
        pricingModel: 'volume',
        pricingTiers: [
          { upTo: 100, price: 10 }, // $0.10 per unit for 1-100
          { upTo: 500, price: 8 },  // $0.08 per unit for 101-500
          { upTo: null, price: 5 }, // $0.05 per unit for 500+
        ],
        includedUnits: { valueOf: () => 0 } as any,
        minimumCharge: { valueOf: () => 0 } as any,
      };

      // 150 units should use the second tier ($0.08 per unit)
      const result = MeteredBillingService.calculateMeteredCharges(150, volumePlan);

      expect(result.totalUsage).toBe(150);
      expect(result.billableUsage).toBe(150);
      expect(result.totalCost).toBe(12.0); // 150 * $0.08
      expect(result.finalAmount).toBe(12.0);
      expect(result.tierBreakdown[0]).toEqual({
        tier: 2,
        upTo: 500,
        usage: 150,
        rate: 0.08,
        cost: 12.0,
      });
    });
  });

  describe('processMeteredBilling', () => {
    it('should process metered billing and create invoice', async () => {
      // Mock subscription with plan
      (prisma.customerMeteredSubscription.findUnique as any).mockResolvedValue(mockSubscription);

      // Mock usage aggregation
      vi.spyOn(UsageTrackingService, 'getUnbilledUsage').mockResolvedValue([
        {
          customerId: 'customer-123',
          partnerId: 'partner-123',
          metricType: 'minutes',
          metricName: 'call_minutes',
          totalQuantity: 150, // 150 minutes used
          totalCost: 0,
          billingPeriodStart: new Date('2024-01-01'),
          billingPeriodEnd: new Date('2024-01-31'),
          usageCount: 10,
        },
      ]);

      // Mock marking usage as billed
      vi.spyOn(UsageTrackingService, 'markUsageAsBilled').mockResolvedValue();

      // Mock subscription update
      (prisma.customerMeteredSubscription.update as any).mockResolvedValue({});

      const result = await MeteredBillingService.processMeteredBilling('sub-123');

      expect(result).toBeDefined();
      expect(result?.invoice.id).toBe('invoice-123');
      expect(result?.totalUsage).toBe(150);
      expect(UsageTrackingService.markUsageAsBilled).toHaveBeenCalled();
      expect(prisma.customerMeteredSubscription.update).toHaveBeenCalled();
    });

    it('should skip inactive subscriptions', async () => {
      const inactiveSubscription = { ...mockSubscription, status: 'paused' };
      (prisma.customerMeteredSubscription.findUnique as any).mockResolvedValue(inactiveSubscription);

      const result = await MeteredBillingService.processMeteredBilling('sub-123');

      expect(result).toBeNull();
    });

    it('should handle zero usage gracefully', async () => {
      (prisma.customerMeteredSubscription.findUnique as any).mockResolvedValue(mockSubscription);
      vi.spyOn(UsageTrackingService, 'getUnbilledUsage').mockResolvedValue([]);
      (prisma.customerMeteredSubscription.update as any).mockResolvedValue({});

      const result = await MeteredBillingService.processMeteredBilling('sub-123');

      expect(result).toBeNull();
      expect(prisma.customerMeteredSubscription.update).toHaveBeenCalled(); // Still updates billing period
    });
  });
});
