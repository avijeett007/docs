import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/encryption';
import { verifyApiKey } from '@/lib/api-key-resolver';



export const dynamic = 'force-dynamic';

interface BulkMigrationRequest {
  provider?: 'vapi' | 'retell' | 'all';
  verifyKeys?: boolean;
}

// Trigger bulk migration for partner's agents
export async function POST(request: NextRequest) {
  try {
    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { provider = 'all', verifyKeys = true }: BulkMigrationRequest = body;

    console.log(`Starting bulk migration for partner ${partnerId}, provider: ${provider}`);

    const results = {
      vapi: { migrated: 0, failed: 0, skipped: 0, errors: [] as string[] },
      retell: { migrated: 0, failed: 0, skipped: 0, errors: [] as string[] }
    };

    // Migrate VAPI agents
    if (provider === 'all' || provider === 'vapi') {
      const vapiResult = await migratePartnerVapiAgents(partnerId, verifyKeys);
      results.vapi = vapiResult;
    }

    // Migrate Retell agents
    if (provider === 'all' || provider === 'retell') {
      const retellResult = await migratePartnerRetellAgents(partnerId, verifyKeys);
      results.retell = retellResult;
    }

    const totalMigrated = results.vapi.migrated + results.retell.migrated;
    const totalFailed = results.vapi.failed + results.retell.failed;
    const totalSkipped = results.vapi.skipped + results.retell.skipped;

    return NextResponse.json({
      success: true,
      summary: {
        totalMigrated,
        totalFailed,
        totalSkipped,
        successRate: totalMigrated + totalFailed > 0 ? 
          Math.round((totalMigrated / (totalMigrated + totalFailed)) * 100) : 0
      },
      details: results
    });

  } catch (error) {
    console.error('Error in bulk migration:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

async function migratePartnerVapiAgents(partnerId: string, verifyKeys: boolean) {
  const result = { migrated: 0, failed: 0, skipped: 0, errors: [] as string[] };

  try {
    // Get partner's VAPI API key
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { vapiApiKey: true }
    });

    if (!partner?.vapiApiKey) {
      result.errors.push('No VAPI API key found for partner');
      return result;
    }

    // Get agents that need migration
    const agents = await prisma.vapiAgent.findMany({
      where: {
        partnerId: partnerId,
        apiKeyStatus: 'not_set'
      }
    });

    console.log(`Found ${agents.length} VAPI agents to migrate for partner ${partnerId}`);

    const decryptedPartnerKey = await decrypt(partner.vapiApiKey);

    for (const agent of agents) {
      try {
        let keyStatus = 'migrated_from_partner';
        let errorMessage: string | null = null;

        // Verify the API key if requested
        if (verifyKeys) {
          const isValid = await verifyApiKey(decryptedPartnerKey, agent.id, 'vapi');
          keyStatus = isValid ? 'valid' : 'invalid';
          if (!isValid) {
            errorMessage = 'Partner API key verification failed';
          }
        }

        // Encrypt the API key for the agent
        const encryptedKey = await encrypt(decryptedPartnerKey);

        // Calculate historical data date range (30 days back from now)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        // Update the agent with API key and historical processing initialization
        await prisma.vapiAgent.update({
          where: { id: agent.id },
          data: {
            apiKey: encryptedKey,
            apiKeyStatus: keyStatus,
            apiKeyLastVerified: new Date(),
            apiKeyErrorMessage: errorMessage,
            // Initialize historical processing fields for migrated agents
            historicalAnalyticsProcessed: false,
            historicalProcessingStatus: 'pending',
            historicalDataStartDate: thirtyDaysAgo,
            historicalDataEndDate: now,
            historicalCallsProcessed: 0,
            historicalCallsTotal: 0,
          }
        });

        if (keyStatus === 'valid' || keyStatus === 'migrated_from_partner') {
          result.migrated++;
        } else {
          result.failed++;
          result.errors.push(`Agent ${agent.id}: ${errorMessage}`);
        }

      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Agent ${agent.id}: ${errorMsg}`);
        console.error(`Error migrating VAPI agent ${agent.id}:`, error);
      }
    }

  } catch (error) {
    result.errors.push(`VAPI migration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('Error in VAPI migration:', error);
  }

  return result;
}

async function migratePartnerRetellAgents(partnerId: string, verifyKeys: boolean) {
  const result = { migrated: 0, failed: 0, skipped: 0, errors: [] as string[] };

  try {
    // Get partner's Retell API key
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { retellApiKey: true }
    });

    if (!partner?.retellApiKey) {
      result.errors.push('No Retell API key found for partner');
      return result;
    }

    // Get agents that need migration
    const agents = await prisma.retellAgent.findMany({
      where: {
        partnerId: partnerId,
        apiKeyStatus: 'not_set'
      }
    });

    console.log(`Found ${agents.length} Retell agents to migrate for partner ${partnerId}`);

    const decryptedPartnerKey = await decrypt(partner.retellApiKey);

    for (const agent of agents) {
      try {
        let keyStatus = 'migrated_from_partner';
        let errorMessage: string | null = null;

        // Verify the API key if requested
        if (verifyKeys) {
          const isValid = await verifyApiKey(decryptedPartnerKey, agent.id, 'retell');
          keyStatus = isValid ? 'valid' : 'invalid';
          if (!isValid) {
            errorMessage = 'Partner API key verification failed';
          }
        }

        // Encrypt the API key for the agent
        const encryptedKey = await encrypt(decryptedPartnerKey);

        // Calculate historical data date range (30 days back from now)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        // Update the agent with API key and historical processing initialization
        await prisma.retellAgent.update({
          where: { id: agent.id },
          data: {
            apiKey: encryptedKey,
            apiKeyStatus: keyStatus,
            apiKeyLastVerified: new Date(),
            apiKeyErrorMessage: errorMessage,
            // Initialize historical processing fields for migrated agents
            historicalAnalyticsProcessed: false,
            historicalProcessingStatus: 'pending',
            historicalDataStartDate: thirtyDaysAgo,
            historicalDataEndDate: now,
            historicalCallsProcessed: 0,
            historicalCallsTotal: 0,
          }
        });

        if (keyStatus === 'valid' || keyStatus === 'migrated_from_partner') {
          result.migrated++;
        } else {
          result.failed++;
          result.errors.push(`Agent ${agent.id}: ${errorMessage}`);
        }

      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Agent ${agent.id}: ${errorMsg}`);
        console.error(`Error migrating Retell agent ${agent.id}:`, error);
      }
    }

  } catch (error) {
    result.errors.push(`Retell migration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('Error in Retell migration:', error);
  }

  return result;
}
