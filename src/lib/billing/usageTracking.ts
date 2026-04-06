import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '@/lib/logger';

export interface UsageEvent {
  customerId: string;
  partnerId: string;
  agentId?: string;
  metricType: string;
  metricName: string;
  metricCategory?: string;
  quantity: number;
  unitPrice?: number;
  sourceReference?: string;
  usageDate?: Date;
  metadata?: Record<string, any>;
}

export interface UsageAggregation {
  customerId: string;
  partnerId: string;
  metricType: string;
  metricName: string;
  totalQuantity: number;
  totalCost: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  usageCount: number;
}

export interface BillingPeriod {
  start: Date;
  end: Date;
}

export class UsageTrackingService {
  /**
   * Record a usage event
   */
  static async recordUsage(event: UsageEvent): Promise<void> {
    try {
      const usageDate = event.usageDate || new Date();
      const billingPeriod = this.getCurrentBillingPeriod(usageDate);
      
      // Calculate total cost if unit price is provided
      const totalCost = event.unitPrice 
        ? new Decimal(event.quantity).mul(new Decimal(event.unitPrice))
        : null;

      await prisma.usageMetric.create({
        data: {
          customerId: event.customerId,
          partnerId: event.partnerId,
          agentId: event.agentId,
          metricType: event.metricType,
          metricName: event.metricName,
          metricCategory: event.metricCategory,
          quantity: new Decimal(event.quantity),
          unitPrice: event.unitPrice ? new Decimal(event.unitPrice) : null,
          totalCost: totalCost,
          billingPeriodStart: billingPeriod.start,
          billingPeriodEnd: billingPeriod.end,
          usageDate: usageDate,
          sourceReference: event.sourceReference,
          metadata: event.metadata || {},
          billingStatus: 'pending',
        },
      });

      logger.info('Usage recorded', {
        operation: 'usage_tracking',
        customerId: event.customerId,
        metricType: event.metricType,
        quantity: event.quantity,
        billingPeriod
      });
    } catch (error) {
      logger.error('Error recording usage', error as Error, {
        operation: 'usage_tracking',
        customerId: event.customerId,
        metricType: event.metricType
      });
      throw new Error('Failed to record usage event');
    }
  }

  /**
   * Record multiple usage events in batch
   */
  static async recordUsageBatch(events: UsageEvent[]): Promise<void> {
    try {
      const usageMetrics = events.map(event => {
        const usageDate = event.usageDate || new Date();
        const billingPeriod = this.getCurrentBillingPeriod(usageDate);
        
        const totalCost = event.unitPrice 
          ? new Decimal(event.quantity).mul(new Decimal(event.unitPrice))
          : null;

        return {
          customerId: event.customerId,
          partnerId: event.partnerId,
          agentId: event.agentId,
          metricType: event.metricType,
          metricName: event.metricName,
          metricCategory: event.metricCategory,
          quantity: new Decimal(event.quantity),
          unitPrice: event.unitPrice ? new Decimal(event.unitPrice) : null,
          totalCost: totalCost,
          billingPeriodStart: billingPeriod.start,
          billingPeriodEnd: billingPeriod.end,
          usageDate: usageDate,
          sourceReference: event.sourceReference,
          metadata: event.metadata || {},
          billingStatus: 'pending' as const,
        };
      });

      await prisma.usageMetric.createMany({
        data: usageMetrics,
      });

      logger.info('Batch usage recorded', {
        operation: 'usage_tracking',
        eventCount: events.length
      });
    } catch (error) {
      logger.error('Error recording usage batch', error as Error, {
        operation: 'usage_tracking',
        eventCount: events.length
      });
      throw new Error('Failed to record usage events');
    }
  }

  /**
   * Get usage aggregation for a customer and billing period
   */
  static async getUsageAggregation(
    customerId: string,
    partnerId: string,
    billingPeriodStart: Date,
    billingPeriodEnd: Date,
    metricType?: string
  ): Promise<UsageAggregation[]> {
    try {
      const whereClause: any = {
        customerId,
        partnerId,
        billingPeriodStart: {
          gte: billingPeriodStart,
        },
        billingPeriodEnd: {
          lte: billingPeriodEnd,
        },
      };

      if (metricType) {
        whereClause.metricType = metricType;
      }

      const aggregations = await prisma.usageMetric.groupBy({
        by: ['customerId', 'partnerId', 'metricType', 'metricName'],
        where: whereClause,
        _sum: {
          quantity: true,
          totalCost: true,
        },
        _count: {
          id: true,
        },
      });

      return aggregations.map(agg => ({
        customerId: agg.customerId,
        partnerId: agg.partnerId,
        metricType: agg.metricType,
        metricName: agg.metricName,
        totalQuantity: Number(agg._sum.quantity || 0),
        totalCost: Number(agg._sum.totalCost || 0),
        billingPeriodStart,
        billingPeriodEnd,
        usageCount: agg._count.id,
      }));
    } catch (error) {
      logger.error('Error getting usage aggregation', error as Error, {
        operation: 'usage_tracking',
        customerId,
        partnerId
      });
      throw new Error('Failed to get usage aggregation');
    }
  }

  /**
   * Get unbilled usage for a customer
   */
  static async getUnbilledUsage(
    customerId: string,
    partnerId: string,
    metricName?: string
  ): Promise<UsageAggregation[]> {
    try {
      const whereClause: any = {
        customerId,
        partnerId,
        billingStatus: 'pending',
      };

      if (metricName) {
        whereClause.metricName = metricName;
      }

      const aggregations = await prisma.usageMetric.groupBy({
        by: ['customerId', 'partnerId', 'metricType', 'metricName', 'billingPeriodStart', 'billingPeriodEnd'],
        where: whereClause,
        _sum: {
          quantity: true,
          totalCost: true,
        },
        _count: {
          id: true,
        },
      });

      return aggregations.map(agg => ({
        customerId: agg.customerId,
        partnerId: agg.partnerId,
        metricType: agg.metricType,
        metricName: agg.metricName,
        totalQuantity: Number(agg._sum.quantity || 0),
        totalCost: Number(agg._sum.totalCost || 0),
        billingPeriodStart: agg.billingPeriodStart,
        billingPeriodEnd: agg.billingPeriodEnd,
        usageCount: agg._count.id,
      }));
    } catch (error) {
      logger.error('Error getting unbilled usage', error as Error, {
        operation: 'usage_tracking',
        customerId,
        partnerId
      });
      throw new Error('Failed to get unbilled usage');
    }
  }

  /**
   * Mark usage as billed
   */
  static async markUsageAsBilled(
    customerId: string,
    partnerId: string,
    billingPeriodStart: Date,
    billingPeriodEnd: Date,
    invoiceId: string,
    metricType?: string
  ): Promise<void> {
    try {
      const whereClause: any = {
        customerId,
        partnerId,
        billingPeriodStart,
        billingPeriodEnd,
        billingStatus: 'pending',
      };

      if (metricType) {
        whereClause.metricType = metricType;
      }

      await prisma.usageMetric.updateMany({
        where: whereClause,
        data: {
          billingStatus: 'billed',
          billedAt: new Date(),
          invoiceId,
        },
      });

      logger.info('Usage marked as billed', {
        operation: 'usage_tracking',
        customerId,
        billingPeriod: { start: billingPeriodStart, end: billingPeriodEnd },
        invoiceId
      });
    } catch (error) {
      logger.error('Error marking usage as billed', error as Error, {
        operation: 'usage_tracking',
        customerId,
        invoiceId
      });
      throw new Error('Failed to mark usage as billed');
    }
  }

  /**
   * Get current billing period (monthly by default)
   */
  static getCurrentBillingPeriod(date: Date = new Date()): BillingPeriod {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    
    return { start, end };
  }

  /**
   * Get billing period for a specific cycle
   */
  static getBillingPeriod(
    date: Date,
    cycle: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  ): BillingPeriod {
    const start = new Date(date);
    const end = new Date(date);

    switch (cycle) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      
      case 'weekly':
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      
      case 'quarterly':
        const quarter = Math.floor(start.getMonth() / 3);
        start.setMonth(quarter * 3, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(quarter * 3 + 3, 0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }

  /**
   * Get usage history for a customer with pagination
   */
  static async getUsageHistory(
    customerId: string,
    partnerId: string,
    startDate: Date,
    endDate: Date,
    metricType?: string,
    options: {
      page?: number;
      limit?: number;
      orderBy?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      // Extract pagination options
      const page = options.page || 1;
      const limit = options.limit || 100;
      const orderBy = options.orderBy || 'desc';
      const skip = (page - 1) * limit;

      const whereClause: any = {
        customerId,
        partnerId,
        usageDate: {
          gte: startDate,
          lte: endDate,
        },
      };

      if (metricType) {
        whereClause.metricType = metricType;
      }

      // Get total count for pagination
      const total = await prisma.usageMetric.count({
        where: whereClause,
      });

      // Get paginated data
      const usage = await prisma.usageMetric.findMany({
        where: whereClause,
        orderBy: {
          usageDate: orderBy,
        },
        skip,
        take: limit,
        select: {
          id: true,
          metricType: true,
          metricName: true,
          metricCategory: true,
          quantity: true,
          unitPrice: true,
          totalCost: true,
          usageDate: true,
          billingStatus: true,
          sourceReference: true,
          metadata: true,
        },
      });

      const data = usage.map(u => ({
        ...u,
        quantity: Number(u.quantity),
        unitPrice: u.unitPrice ? Number(u.unitPrice) : null,
        totalCost: u.totalCost ? Number(u.totalCost) : null,
      }));

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Error getting usage history', error as Error, {
        operation: 'usage_tracking',
        customerId,
        partnerId
      });
      throw new Error('Failed to get usage history');
    }
  }
}
