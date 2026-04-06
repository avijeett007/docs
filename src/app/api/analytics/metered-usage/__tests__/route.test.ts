import { NextRequest } from 'next/server';
import { POST } from '../route';
import { jest } from '@jest/globals';

// Mock Prisma
const mockPrisma = {
  meteredBillingPlan: {
    findMany: jest.fn(),
  },
  usageMetric: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock environment variables
process.env.ANALYTICS_API_KEY = 'test-analytics-key';

describe('/api/analytics/metered-usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createRequest = (body: any, authHeader?: string) => {
    const request = new NextRequest('http://localhost:3000/api/analytics/metered-usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
      body: JSON.stringify(body),
    });
    return request;
  };

  const validRequestBody = {
    agentId: 'agent-123',
    partnerId: 'partner-456',
    customerId: 'customer-789',
    metricName: 'qualified_leads',
    metricValue: true,
    callId: 'call-abc123',
    timestamp: '2024-01-15T10:30:00Z',
    sourceReference: 'analytics_event_uuid',
    metadata: {
      provider: 'vapi',
      extraction_method: 'keyword_analysis',
    },
  };

  it('should reject requests without authentication', async () => {
    const request = createRequest(validRequestBody);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
  });

  it('should reject requests with invalid authentication', async () => {
    const request = createRequest(validRequestBody, 'Bearer invalid-key');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
  });

  it('should accept requests with valid authentication', async () => {
    mockPrisma.meteredBillingPlan.findMany.mockResolvedValue([]);

    const request = createRequest(validRequestBody, 'Bearer test-analytics-key');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should ignore non-billable events (false values)', async () => {
    const request = createRequest(
      { ...validRequestBody, metricValue: false },
      'Bearer test-analytics-key'
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Non-billable event ignored');
    expect(data.processed).toBe(false);
  });

  it('should handle no active subscriptions', async () => {
    mockPrisma.meteredBillingPlan.findMany.mockResolvedValue([]);

    const request = createRequest(validRequestBody, 'Bearer test-analytics-key');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('No active subscriptions found for this metric');
    expect(data.processed).toBe(false);
  });

  it('should process usage for active subscriptions', async () => {
    const mockSubscription = {
      id: 'subscription-123',
      customerId: 'customer-789',
      metricName: 'qualified_leads',
      isActive: true,
      stripeSubscriptionId: null,
      stripePriceId: null,
      customer: { id: 'customer-789' },
      partner: { id: 'partner-456' },
    };

    mockPrisma.meteredBillingPlan.findMany.mockResolvedValue([mockSubscription]);
    mockPrisma.usageMetric.findFirst.mockResolvedValue(null); // No duplicate
    mockPrisma.usageMetric.create.mockResolvedValue({
      id: 'usage-123',
      meteredBillingPlanId: 'subscription-123',
      customerId: 'customer-789',
      partnerId: 'partner-456',
      agentId: 'agent-123',
      metricName: 'qualified_leads',
      metricValue: 1,
      timestamp: new Date('2024-01-15T10:30:00Z'),
      sourceReference: 'analytics_event_uuid',
      metadata: validRequestBody.metadata,
    });

    const request = createRequest(validRequestBody, 'Bearer test-analytics-key');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Usage recorded successfully');
    expect(data.processed).toBe(true);
    expect(data.usageCount).toBe(1);
    expect(data.subscriptions).toHaveLength(1);
    expect(data.subscriptions[0].subscriptionId).toBe('subscription-123');
  });

  it('should prevent duplicate usage records', async () => {
    const mockSubscription = {
      id: 'subscription-123',
      customerId: 'customer-789',
      metricName: 'qualified_leads',
      isActive: true,
      customer: { id: 'customer-789' },
      partner: { id: 'partner-456' },
    };

    const existingUsage = {
      id: 'existing-usage-123',
      meteredBillingPlanId: 'subscription-123',
      sourceReference: 'analytics_event_uuid',
    };

    mockPrisma.meteredBillingPlan.findMany.mockResolvedValue([mockSubscription]);
    mockPrisma.usageMetric.findFirst.mockResolvedValue(existingUsage);

    const request = createRequest(validRequestBody, 'Bearer test-analytics-key');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.usageCount).toBe(0); // No new usage recorded
    expect(mockPrisma.usageMetric.create).not.toHaveBeenCalled();
  });

  it('should validate request body', async () => {
    const invalidBody = {
      agentId: '', // Invalid: empty string
      partnerId: 'partner-456',
      customerId: 'customer-789',
      // Missing required fields
    };

    const request = createRequest(invalidBody, 'Bearer test-analytics-key');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request data');
    expect(data.details).toBeDefined();
  });

  it('should handle database errors gracefully', async () => {
    mockPrisma.meteredBillingPlan.findMany.mockRejectedValue(new Error('Database error'));

    const request = createRequest(validRequestBody, 'Bearer test-analytics-key');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
    expect(data.message).toBe('Database error');
  });

  it('should include metadata in response', async () => {
    mockPrisma.meteredBillingPlan.findMany.mockResolvedValue([]);

    const request = createRequest(validRequestBody, 'Bearer test-analytics-key');
    const response = await POST(request);
    const data = await response.json();

    expect(data.metadata).toEqual({
      agentId: 'agent-123',
      metricName: 'qualified_leads',
      callId: 'call-abc123',
      timestamp: '2024-01-15T10:30:00Z',
    });
  });
});
