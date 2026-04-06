import { prisma } from '@/lib/prisma';
import { logger } from './logger';

export interface MigrationMetrics {
  timestamp: Date;
  totalAgents: number;
  migratedAgents: number;
  migrationProgress: number;
  vapiStats: {
    total: number;
    migrated: number;
    byStatus: Record<string, number>;
  };
  retellStats: {
    total: number;
    migrated: number;
    byStatus: Record<string, number>;
  };
  errorCount: number;
  averageResponseTime?: number;
}

export interface MigrationAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export class MigrationMonitor {
  private alerts: MigrationAlert[] = [];
  private metrics: MigrationMetrics[] = [];

  /**
   * Collect current migration metrics
   */
  async collectMetrics(): Promise<MigrationMetrics> {
    try {
      const startTime = Date.now();

      // Get VAPI agent statistics
      const vapiStats = await prisma.vapiAgent.groupBy({
        by: ['apiKeyStatus'],
        _count: true
      });

      // Get Retell agent statistics
      const retellStats = await prisma.retellAgent.groupBy({
        by: ['apiKeyStatus'],
        _count: true
      });

      // Process VAPI statistics
      const vapiByStatus = vapiStats.reduce((acc, stat) => {
        acc[stat.apiKeyStatus] = stat._count;
        return acc;
      }, {} as Record<string, number>);

      // Process Retell statistics
      const retellByStatus = retellStats.reduce((acc, stat) => {
        acc[stat.apiKeyStatus] = stat._count;
        return acc;
      }, {} as Record<string, number>);

      // Calculate totals
      const vapiTotal = Object.values(vapiByStatus).reduce((sum, count) => sum + count, 0);
      const retellTotal = Object.values(retellByStatus).reduce((sum, count) => sum + count, 0);
      const totalAgents = vapiTotal + retellTotal;

      // Calculate migrated counts (anything not 'not_set')
      const vapiMigrated = vapiTotal - (vapiByStatus.not_set || 0);
      const retellMigrated = retellTotal - (retellByStatus.not_set || 0);
      const migratedAgents = vapiMigrated + retellMigrated;

      // Calculate progress
      const migrationProgress = totalAgents > 0 ? (migratedAgents / totalAgents) * 100 : 0;

      // Count recent errors (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const errorCount = await this.countRecentErrors(oneHourAgo);

      const responseTime = Date.now() - startTime;

      const metrics: MigrationMetrics = {
        timestamp: new Date(),
        totalAgents,
        migratedAgents,
        migrationProgress,
        vapiStats: {
          total: vapiTotal,
          migrated: vapiMigrated,
          byStatus: vapiByStatus
        },
        retellStats: {
          total: retellTotal,
          migrated: retellMigrated,
          byStatus: retellByStatus
        },
        errorCount,
        averageResponseTime: responseTime
      };

      // Store metrics
      this.metrics.push(metrics);
      
      // Keep only last 100 metrics
      if (this.metrics.length > 100) {
        this.metrics = this.metrics.slice(-100);
      }

      // Check for alerts
      await this.checkAlerts(metrics);

      return metrics;

    } catch (error) {
      logger.error('Error collecting migration metrics', error as Error, {
        operation: 'migration_monitoring'
      });
      throw error;
    }
  }

  /**
   * Check for alert conditions
   */
  private async checkAlerts(metrics: MigrationMetrics): Promise<void> {
    // Check migration success rate
    if (metrics.totalAgents > 0) {
      const successRate = (metrics.migratedAgents / metrics.totalAgents) * 100;
      
      if (successRate < 95) {
        this.createAlert('critical', 'Low Migration Success Rate', 
          `Migration success rate is ${successRate.toFixed(1)}% (below 95% threshold)`, {
            successRate,
            totalAgents: metrics.totalAgents,
            migratedAgents: metrics.migratedAgents
          });
      } else if (successRate < 98) {
        this.createAlert('warning', 'Migration Success Rate Warning', 
          `Migration success rate is ${successRate.toFixed(1)}% (below 98% threshold)`, {
            successRate,
            totalAgents: metrics.totalAgents,
            migratedAgents: metrics.migratedAgents
          });
      }
    }

    // Check error rate
    if (metrics.errorCount > 10) {
      this.createAlert('critical', 'High Error Rate', 
        `${metrics.errorCount} errors detected in the last hour`, {
          errorCount: metrics.errorCount
        });
    } else if (metrics.errorCount > 5) {
      this.createAlert('warning', 'Elevated Error Rate', 
        `${metrics.errorCount} errors detected in the last hour`, {
          errorCount: metrics.errorCount
        });
    }

    // Check response time
    if (metrics.averageResponseTime && metrics.averageResponseTime > 5000) {
      this.createAlert('warning', 'Slow Response Time', 
        `Average response time is ${metrics.averageResponseTime}ms (above 5s threshold)`, {
          responseTime: metrics.averageResponseTime
        });
    }

    // Check for agents with invalid status
    const invalidVapi = metrics.vapiStats.byStatus.invalid || 0;
    const invalidRetell = metrics.retellStats.byStatus.invalid || 0;
    const totalInvalid = invalidVapi + invalidRetell;

    if (totalInvalid > 0) {
      this.createAlert('warning', 'Agents with Invalid API Keys', 
        `${totalInvalid} agents have invalid API key status`, {
          invalidVapi,
          invalidRetell,
          totalInvalid
        });
    }
  }

  /**
   * Create an alert
   */
  private createAlert(type: 'critical' | 'warning' | 'info', title: string, message: string, metadata?: Record<string, any>): void {
    const alert: MigrationAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      timestamp: new Date(),
      resolved: false,
      metadata
    };

    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }

    // Log alert
    logger.info('Migration alert created', {
      operation: 'migration_monitoring',
      alertType: type,
      title,
      message
    });
    
    // In production, you would send this to your monitoring system
    // e.g., Sentry, DataDog, CloudWatch, etc.
  }

  /**
   * Count recent errors (placeholder - implement based on your logging system)
   */
  private async countRecentErrors(since: Date): Promise<number> {
    // This is a placeholder implementation
    // In production, you would query your logging system
    // e.g., CloudWatch, Elasticsearch, etc.
    
    try {
      // Example: Count failed migrations in the last hour
      // This would need to be implemented based on your actual error tracking
      return 0;
    } catch (error) {
      logger.error('Error counting recent errors', error as Error, {
        operation: 'migration_monitoring'
      });
      return 0;
    }
  }

  /**
   * Get current alerts
   */
  getAlerts(includeResolved: boolean = false): MigrationAlert[] {
    return includeResolved 
      ? this.alerts 
      : this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Get recent metrics
   */
  getMetrics(count: number = 10): MigrationMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    metrics: MigrationMetrics;
    activeAlerts: number;
    criticalAlerts: number;
  }> {
    const metrics = await this.collectMetrics();
    const activeAlerts = this.getAlerts().length;
    const criticalAlerts = this.getAlerts().filter(a => a.type === 'critical').length;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (criticalAlerts > 0) {
      status = 'critical';
    } else if (activeAlerts > 0 || metrics.errorCount > 5) {
      status = 'warning';
    }

    return {
      status,
      metrics,
      activeAlerts,
      criticalAlerts
    };
  }

  /**
   * Generate monitoring report
   */
  generateReport(): {
    summary: string;
    metrics: MigrationMetrics;
    alerts: MigrationAlert[];
    recommendations: string[];
  } {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    const activeAlerts = this.getAlerts();
    const recommendations: string[] = [];

    if (!latestMetrics) {
      return {
        summary: 'No metrics available',
        metrics: {} as MigrationMetrics,
        alerts: [],
        recommendations: ['Collect initial metrics']
      };
    }

    // Generate recommendations
    if (latestMetrics.migrationProgress < 100) {
      recommendations.push(`${(100 - latestMetrics.migrationProgress).toFixed(1)}% of agents still need migration`);
    }

    if (latestMetrics.errorCount > 0) {
      recommendations.push(`Investigate ${latestMetrics.errorCount} recent errors`);
    }

    if (activeAlerts.length > 0) {
      recommendations.push(`Address ${activeAlerts.length} active alerts`);
    }

    if (latestMetrics.averageResponseTime && latestMetrics.averageResponseTime > 3000) {
      recommendations.push('Consider optimizing query performance');
    }

    const summary = `Migration Progress: ${latestMetrics.migrationProgress.toFixed(1)}% (${latestMetrics.migratedAgents}/${latestMetrics.totalAgents} agents)`;

    return {
      summary,
      metrics: latestMetrics,
      alerts: activeAlerts,
      recommendations
    };
  }
}

// Export singleton instance
export const migrationMonitor = new MigrationMonitor();
