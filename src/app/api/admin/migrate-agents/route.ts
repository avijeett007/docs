import { NextRequest, NextResponse } from 'next/server';
import { migrateAllAgents } from '@/lib/migration';

export const dynamic = 'force-dynamic';

/**
 * One-time migration script to migrate all agents from partner-level to agent-level API keys
 * and enable webhooks for all agents.
 * 
 * This endpoint is protected by a unique API key and should only be used once.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the migration API key
    const authHeader = request.headers.get('Authorization');
    const migrationApiKey = process.env.MIGRATION_SCRIPT_API_KEY;

    if (!migrationApiKey) {
      console.error('[migration-script] MIGRATION_SCRIPT_API_KEY environment variable not set');
      return NextResponse.json(
        { error: 'Migration script not configured' },
        { status: 500 }
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header. Use: Bearer <MIGRATION_SCRIPT_API_KEY>' },
        { status: 401 }
      );
    }

    const providedApiKey = authHeader.split(' ')[1];
    if (providedApiKey !== migrationApiKey) {
      console.error('[migration-script] Invalid migration API key provided');
      return NextResponse.json(
        { error: 'Invalid migration API key' },
        { status: 401 }
      );
    }

    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const { dryRun = false, confirmMigration = false } = body;

    // Safety check - require explicit confirmation for production migration
    if (!dryRun && !confirmMigration) {
      return NextResponse.json({
        error: 'Migration requires explicit confirmation',
        message: 'To run the actual migration, set confirmMigration: true in the request body',
        suggestion: 'Run with dryRun: true first to see what would be migrated'
      }, { status: 400 });
    }

    console.log(`[migration-script] Starting ${dryRun ? 'DRY RUN' : 'FULL'} migration...`);
    console.log(`[migration-script] Request body:`, { dryRun, confirmMigration });

    // Start the migration process
    const startTime = Date.now();
    const migrationStats = await migrateAllAgents(dryRun);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`[migration-script] Migration completed in ${duration}ms`);
    console.log(`[migration-script] Final statistics:`, migrationStats);

    // Calculate totals for summary
    const totalApiKeyMigrations = 
      migrationStats.apiKeyMigration.vapi.migrated +
      migrationStats.apiKeyMigration.retell.migrated +
      migrationStats.apiKeyMigration.ultravox.migrated;

    const totalApiKeyFailures = 
      migrationStats.apiKeyMigration.vapi.failed +
      migrationStats.apiKeyMigration.retell.failed +
      migrationStats.apiKeyMigration.ultravox.failed;

    const totalWebhookEnablements = 
      migrationStats.webhookMigration.vapi.enabled +
      migrationStats.webhookMigration.retell.enabled +
      migrationStats.webhookMigration.ultravox.enabled;

    const totalWebhookFailures = 
      migrationStats.webhookMigration.vapi.failed +
      migrationStats.webhookMigration.retell.failed +
      migrationStats.webhookMigration.ultravox.failed;

    const response = {
      success: true,
      dryRun,
      duration: `${duration}ms`,
      summary: {
        totalPartners: migrationStats.totalPartners,
        totalAgents: migrationStats.totalAgents,
        apiKeyMigrations: {
          successful: totalApiKeyMigrations,
          failed: totalApiKeyFailures,
          successRate: totalApiKeyMigrations + totalApiKeyFailures > 0 ? 
            Math.round((totalApiKeyMigrations / (totalApiKeyMigrations + totalApiKeyFailures)) * 100) : 0
        },
        webhookEnablements: {
          successful: totalWebhookEnablements,
          failed: totalWebhookFailures,
          successRate: totalWebhookEnablements + totalWebhookFailures > 0 ? 
            Math.round((totalWebhookEnablements / (totalWebhookEnablements + totalWebhookFailures)) * 100) : 0
        },
        totalErrors: migrationStats.errors.length
      },
      details: migrationStats,
      message: dryRun ? 
        'Dry run completed successfully. No actual changes were made.' :
        'Migration completed successfully. All agents have been migrated.',
      nextSteps: dryRun ? [
        'Review the migration statistics above',
        'If everything looks correct, run the migration with confirmMigration: true',
        'Monitor the application after migration to ensure everything works correctly'
      ] : [
        'Migration is complete',
        'Monitor agent performance and webhook functionality',
        'Remove the MIGRATION_SCRIPT_API_KEY environment variable for security',
        'Check analytics to ensure data is flowing correctly'
      ]
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[migration-script] Error in migration process:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      message: errorMessage,
      details: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } : error,
      suggestion: 'Check the server logs for more details and contact support if needed'
    }, { status: 500 });
  }
}

/**
 * GET endpoint to check migration status and requirements
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the migration API key
    const authHeader = request.headers.get('Authorization');
    const migrationApiKey = process.env.MIGRATION_SCRIPT_API_KEY;

    if (!migrationApiKey) {
      return NextResponse.json(
        { error: 'Migration script not configured' },
        { status: 500 }
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const providedApiKey = authHeader.split(' ')[1];
    if (providedApiKey !== migrationApiKey) {
      return NextResponse.json(
        { error: 'Invalid migration API key' },
        { status: 401 }
      );
    }

    // Return migration script information
    return NextResponse.json({
      available: true,
      message: 'Migration script is ready to run',
      usage: {
        dryRun: 'POST with { "dryRun": true } to see what would be migrated',
        fullMigration: 'POST with { "confirmMigration": true } to run the actual migration'
      },
      requirements: [
        'MIGRATION_SCRIPT_API_KEY environment variable must be set',
        'Analytics service must be running and accessible',
        'All required environment variables must be configured',
        'Database must be accessible'
      ],
      warnings: [
        'This is a one-time migration script',
        'Always run a dry run first',
        'Monitor the application after migration',
        'Remove the API key after successful migration'
      ]
    });

  } catch (error) {
    console.error('[migration-script] Error checking migration status:', error);
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}
