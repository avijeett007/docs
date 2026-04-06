import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentMethodService } from '@/lib/stripe/paymentMethods';
import { prisma } from '@/lib/prisma';

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: {
        create: vi.fn().mockResolvedValue({
          id: 'cus_test123',
          email: 'test@example.com',
        }),
      },
      setupIntents: {
        create: vi.fn().mockResolvedValue({
          id: 'seti_test123',
          client_secret: 'seti_test123_secret_test',
          status: 'requires_payment_method',
        }),
      },
      paymentMethods: {
        retrieve: vi.fn().mockResolvedValue({
          id: 'pm_test123',
          type: 'card',
          card: {
            last4: '4242',
            brand: 'visa',
            exp_month: 12,
            exp_year: 2025,
          },
        }),
        detach: vi.fn().mockResolvedValue({}),
      },
    })),
  };
});

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    partner: {
      findUnique: vi.fn(),
    },
    customerPaymentMethod: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe('PaymentMethodService', () => {
  const mockCustomer = {
    id: 'customer-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    stripeCustomerId: null,
  };

  const mockPartner = {
    id: 'partner-123',
    stripeAccountId: 'acct_test123',
    businessName: 'Test Business',
  };

  const mockPaymentMethod = {
    id: 'pm-123',
    customerId: 'customer-123',
    partnerId: 'partner-123',
    stripePaymentMethodId: 'pm_test123',
    type: 'card',
    lastFour: '4242',
    brand: 'visa',
    expMonth: 12,
    expYear: 2025,
    isDefault: true,
    isActive: true,
    billingAddress: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSetupIntent', () => {
    it('should create setup intent for new customer', async () => {
      // Mock database responses
      (prisma.customer.findUnique as any).mockResolvedValue(mockCustomer);
      (prisma.partner.findUnique as any).mockResolvedValue(mockPartner);
      (prisma.customer.update as any).mockResolvedValue({
        ...mockCustomer,
        stripeCustomerId: 'cus_test123',
      });

      const result = await PaymentMethodService.createSetupIntent({
        customerId: 'customer-123',
        partnerId: 'partner-123',
        returnUrl: 'https://example.com/return',
      });

      expect(result).toEqual({
        setupIntentId: 'seti_test123',
        clientSecret: 'seti_test123_secret_test',
        status: 'requires_payment_method',
      });

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'customer-123' },
        data: { stripeCustomerId: 'cus_test123' },
      });
    });

    it('should throw error if customer not found', async () => {
      (prisma.customer.findUnique as any).mockResolvedValue(null);
      (prisma.partner.findUnique as any).mockResolvedValue(mockPartner);

      await expect(
        PaymentMethodService.createSetupIntent({
          customerId: 'customer-123',
          partnerId: 'partner-123',
          returnUrl: 'https://example.com/return',
        })
      ).rejects.toThrow('Customer or partner not found');
    });

    it('should throw error if partner has no Stripe account', async () => {
      (prisma.customer.findUnique as any).mockResolvedValue(mockCustomer);
      (prisma.partner.findUnique as any).mockResolvedValue({
        ...mockPartner,
        stripeAccountId: null,
      });

      await expect(
        PaymentMethodService.createSetupIntent({
          customerId: 'customer-123',
          partnerId: 'partner-123',
          returnUrl: 'https://example.com/return',
        })
      ).rejects.toThrow('Partner has not connected their Stripe account');
    });
  });

  describe('savePaymentMethod', () => {
    it('should save payment method successfully', async () => {
      (prisma.partner.findUnique as any).mockResolvedValue(mockPartner);
      (prisma.customerPaymentMethod.updateMany as any).mockResolvedValue({});
      (prisma.customerPaymentMethod.create as any).mockResolvedValue(mockPaymentMethod);

      const result = await PaymentMethodService.savePaymentMethod({
        customerId: 'customer-123',
        partnerId: 'partner-123',
        stripePaymentMethodId: 'pm_test123',
        setAsDefault: true,
      });

      expect(result).toEqual(mockPaymentMethod);
      expect(prisma.customerPaymentMethod.updateMany).toHaveBeenCalledWith({
        where: {
          customerId: 'customer-123',
          partnerId: 'partner-123',
          isDefault: true,
          isActive: true,
        },
        data: { isDefault: false },
      });
    });
  });

  describe('getCustomerPaymentMethods', () => {
    it('should return customer payment methods', async () => {
      const mockPaymentMethods = [mockPaymentMethod];
      (prisma.customerPaymentMethod.findMany as any).mockResolvedValue(mockPaymentMethods);

      const result = await PaymentMethodService.getCustomerPaymentMethods(
        'customer-123',
        'partner-123'
      );

      expect(result).toEqual(mockPaymentMethods);
      expect(prisma.customerPaymentMethod.findMany).toHaveBeenCalledWith({
        where: {
          customerId: 'customer-123',
          partnerId: 'partner-123',
          isActive: true,
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
      });
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('should set payment method as default', async () => {
      (prisma.customerPaymentMethod.findFirst as any).mockResolvedValue(mockPaymentMethod);
      (prisma.customerPaymentMethod.updateMany as any).mockResolvedValue({});
      (prisma.customerPaymentMethod.update as any).mockResolvedValue(mockPaymentMethod);

      await PaymentMethodService.setDefaultPaymentMethod(
        'pm-123',
        'customer-123',
        'partner-123'
      );

      expect(prisma.customerPaymentMethod.updateMany).toHaveBeenCalledWith({
        where: {
          customerId: 'customer-123',
          partnerId: 'partner-123',
          isDefault: true,
          isActive: true,
        },
        data: { isDefault: false },
      });

      expect(prisma.customerPaymentMethod.update).toHaveBeenCalledWith({
        where: { id: 'pm-123' },
        data: { isDefault: true },
      });
    });

    it('should throw error if payment method not found', async () => {
      (prisma.customerPaymentMethod.findFirst as any).mockResolvedValue(null);

      await expect(
        PaymentMethodService.setDefaultPaymentMethod(
          'pm-123',
          'customer-123',
          'partner-123'
        )
      ).rejects.toThrow('Payment method not found');
    });
  });

  describe('deletePaymentMethod', () => {
    it('should delete payment method successfully', async () => {
      (prisma.customerPaymentMethod.findFirst as any).mockResolvedValue(mockPaymentMethod);
      (prisma.partner.findUnique as any).mockResolvedValue(mockPartner);
      (prisma.customerPaymentMethod.update as any).mockResolvedValue({});

      await PaymentMethodService.deletePaymentMethod(
        'pm-123',
        'customer-123',
        'partner-123'
      );

      expect(prisma.customerPaymentMethod.update).toHaveBeenCalledWith({
        where: { id: 'pm-123' },
        data: { isActive: false, isDefault: false },
      });
    });
  });
});
