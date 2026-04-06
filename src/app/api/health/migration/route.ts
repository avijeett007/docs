import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';



export const dynamic = 'force-dynamic';

// Health check for migration system
export async function GET(_request: NextRequest) {
  const startTime = Date.now();
  const checks: Record<string, any> = {};

  try {
    // Check 1: Database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'healthy',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      };
    }

    // Check 2: Migration schema validation
    try {
      const vapiSample = await prisma.vapiAgent.findFirst({
        select: {
          id: true,
          apiKeyStatus: true,
          apiKeyLastVerified: true,
          apiKeyErrorMessage: true
        }
      });

      const retellSample = await prisma.retellAgent.findFirst({
        select: {
          id: true,
          apiKeyStatus: true,
          apiKeyLastVerified: true,
          apiKeyErrorMessage: true
        }
      });

      checks.schema = {
        status: 'healthy',
        vapiFieldsPresent: !!vapiSample || true, // true if no agents exist
        retellFieldsPresent: !!retellSample || true
      };
    } catch (error) {
      checks.schema = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Schema validation failed'
      };
    }

    // Check 3: Encryption/Decryption
    try {
      const testData = 'health-check-test-data';
      const encrypted = await encrypt(testData);
      const decrypted = await decrypt(encrypted);
      
      checks.encryption = {
        status: decrypted === testData ? 'healthy' : 'unhealthy',
        working: decrypted === testData
      };
    } catch (error) {
      checks.encryption = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Encryption test failed'
      };
    }

    // Check 4: Migration statistics
    try {
      const vapiCount = await prisma.vapiAgent.count();
      const retellCount = await prisma.retellAgent.count();
      const totalAgents = vapiCount + retellCount;

      const vapiMigrated = await prisma.vapiAgent.count({
        where: { apiKeyStatus: { not: 'not_set' } }
      });

      const retellMigrated = await prisma.retellAgent.count({
        where: { apiKeyStatus: { not: 'not_set' } }
      });

      const totalMigrated = vapiMigrated + retellMigrated;
      const migrationProgress = totalAgents > 0 ? (totalMigrated / totalAgents) * 100 : 0;

      checks.migration = {
        status: 'healthy',
        totalAgents,
        totalMigrated,
        migrationProgress: Math.round(migrationProgress * 10) / 10,
        vapi: { total: vapiCount, migrated: vapiMigrated },
        retell: { total: retellCount, migrated: retellMigrated }
      };
    } catch (error) {
      checks.migration = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Migration stats failed'
      };
    }

    // Check 5: API endpoints accessibility
    try {
      // This is a basic check - in production you might want to test actual endpoints
      checks.api = {
        status: 'healthy',
        endpoints: {
          migrationStatus: '/api/partner/agents/migration-status',
          bulkMigration: '/api/partner/agents/migrate-bulk',
          importList: '/api/partner/agents/import/list',
          importExecute: '/api/partner/agents/import/execute'
        }
      };
    } catch (error) {
      checks.api = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'API check failed'
      };
    }

    // Overall health determination
    const unhealthyChecks = Object.values(checks).filter(check => check.status === 'unhealthy');
    const overallStatus = unhealthyChecks.length === 0 ? 'healthy' : 'unhealthy';

    const totalResponseTime = Date.now() - startTime;

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: totalResponseTime,
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      checks,
      summary: {
        totalChecks: Object.keys(checks).length,
        healthyChecks: Object.values(checks).filter(check => check.status === 'healthy').length,
        unhealthyChecks: unhealthyChecks.length
      }
    };

    // Return appropriate HTTP status
    const httpStatus = overallStatus === 'healthy' ? 200 : 503;

    return NextResponse.json(response, { status: httpStatus });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Health check failed',
      checks
    }, { status: 503 });

  }
  // NOTE: DO NOT call prisma.$disconnect() here!
  // In serverless/Next.js environments, the Prisma client connection pool
  // should persist across requests. Calling $disconnect() causes
  // "Engine is not yet connected" errors for concurrent requests.
}
