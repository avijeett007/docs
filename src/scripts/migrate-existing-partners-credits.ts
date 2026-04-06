/**
 * Migration Script: Allocate Credits to Existing Partners
 * 
 * This script identifies existing active partners and allocates monthly credits
 * based on their current subscription plans.
 * 
 * Usage:
 * npm run ts-node src/scripts/migrate-existing-partners-credits.ts
 */

import { prisma } from '@/lib/prisma';
import { SubscriptionCreditService, getCreditAllocationForPlan } from '@/lib/services/subscriptionCreditService';
import { getServerStripe } from '@/lib/stripe';

interface PartnerMigrationResult {
  partnerId: string;
  businessName: string;
  planName: string;
  creditsAllocated: number;
  success: boolean;
  error?: string;
}

async function getPartnerSubscriptionInfo(partner: any) {
  const stripe = getServerStripe();
  if (!stripe || !partner.stripeSubscriptionId) {
    return null;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(partner.stripeSubscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;
    
    if (!priceId) {
      return null;
    }

    const price = await stripe.prices.retrieve(priceId);
    const product = await stripe.products.retrieve(price.product as string);
    
    return {
      subscriptionId: subscription.id,
      priceId: priceId,
      planName: product.name || 'Unknown Plan',
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    };
  } catch (error) {
    console.error(`Error fetching subscription info for partner ${partner.id}:`, error);
    return null;
  }
}

async function migrateExistingPartners(dryRun: boolean = true): Promise<{
  totalPartners: number;
  processed: number;
  successful: number;
  failed: number;
  results: PartnerMigrationResult[];
}> {
  console.log(`🚀 Starting existing partner credit migration (${dryRun ? 'DRY RUN' : 'LIVE RUN'})`);
  
  const results: PartnerMigrationResult[] = [];
  let processed = 0;
  let successful = 0;
  let failed = 0;

  try {
    // Find all active partners with subscriptions
    const partners = await prisma.partner.findMany({
      where: {
        approvalStatus: 'ACTIVE',
        subscriptionStatus: 'ACTIVE',
        stripeSubscriptionId: {
          not: null
        }
      },
      select: {
        id: true,
        businessName: true,
        stripeSubscriptionId: true,
        planId: true,
        creditBalance: true,
        monthlyCreditAllocation: true,
        lastCreditAllocationDate: true,
        createdAt: true,
      }
    });

    console.log(`📊 Found ${partners.length} active partners with subscriptions`);

    for (const partner of partners) {
      processed++;
      console.log(`\n🔄 Processing partner ${processed}/${partners.length}: ${partner.businessName} (${partner.id})`);

      try {
        // Get subscription info from Stripe
        const subscriptionInfo = await getPartnerSubscriptionInfo(partner);
        
        if (!subscriptionInfo) {
          const error = 'Could not retrieve subscription information from Stripe';
          console.log(`❌ ${error}`);
          results.push({
            partnerId: partner.id,
            businessName: partner.businessName,
            planName: 'Unknown',
            creditsAllocated: 0,
            success: false,
            error
          });
          failed++;
          continue;
        }

        console.log(`📋 Plan: ${subscriptionInfo.planName} (${subscriptionInfo.priceId})`);
        console.log(`💰 Current balance: ${partner.creditBalance} credits`);
        console.log(`📅 Last allocation: ${partner.lastCreditAllocationDate || 'Never'}`);

        // Calculate credits to allocate
        const creditsToAllocate = getCreditAllocationForPlan(subscriptionInfo.planName, subscriptionInfo.priceId);
        console.log(`🎯 Credits to allocate: ${creditsToAllocate}`);

        if (!dryRun) {
          // Perform the actual credit allocation
          const result = await SubscriptionCreditService.allocateMonthlyCredits(
            partner.id,
            subscriptionInfo.planName,
            subscriptionInfo.priceId,
            true // force allocation
          );

          if (result.success) {
            console.log(`✅ Successfully allocated ${result.creditsAllocated} credits`);
            successful++;
            results.push({
              partnerId: partner.id,
              businessName: partner.businessName,
              planName: subscriptionInfo.planName,
              creditsAllocated: result.creditsAllocated || 0,
              success: true
            });
          } else {
            console.log(`❌ Failed to allocate credits: ${result.error}`);
            failed++;
            results.push({
              partnerId: partner.id,
              businessName: partner.businessName,
              planName: subscriptionInfo.planName,
              creditsAllocated: 0,
              success: false,
              error: result.error
            });
          }
        } else {
          // Dry run - just simulate
          console.log(`🔍 DRY RUN: Would allocate ${creditsToAllocate} credits`);
          successful++;
          results.push({
            partnerId: partner.id,
            businessName: partner.businessName,
            planName: subscriptionInfo.planName,
            creditsAllocated: creditsToAllocate,
            success: true
          });
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ Error processing partner: ${errorMessage}`);
        failed++;
        results.push({
          partnerId: partner.id,
          businessName: partner.businessName,
          planName: 'Unknown',
          creditsAllocated: 0,
          success: false,
          error: errorMessage
        });
      }
    }

    const summary = {
      totalPartners: partners.length,
      processed,
      successful,
      failed,
      results
    };

    console.log('\n📊 MIGRATION SUMMARY');
    console.log('==================');
    console.log(`Total partners: ${summary.totalPartners}`);
    console.log(`Processed: ${summary.processed}`);
    console.log(`Successful: ${summary.successful}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Success rate: ${((summary.successful / summary.processed) * 100).toFixed(1)}%`);

    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN - no actual changes were made');
      console.log('To perform the actual migration, run with --live flag');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

    return summary;

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isLiveRun = args.includes('--live');
  const isDryRun = !isLiveRun;

  try {
    await migrateExistingPartners(isDryRun);
  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  main();
}

export { migrateExistingPartners };
