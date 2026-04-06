#!/usr/bin/env tsx

/**
 * Script to fix existing embed tokens by adding partner whitelabel domains
 * to their allowed domains list
 */

import { prisma } from '@/lib/prisma';
import { createEmbedJWT } from '@/lib/embedJwt';

async function fixExistingEmbedTokens() {
  console.log('🔧 Fixing existing embed tokens...\n');

  try {
    // Get all active embed tokens with their partner information
    const embedTokens = await prisma.embedToken.findMany({
      where: {
        status: 'active',
      },
      include: {
        partner: {
          select: {
            id: true,
            businessName: true,
            subdomain: true,
            customDomain: true,
            customDomainVerified: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        customerCredential: {
          select: {
            id: true,
          },
        },
      },
    });

    console.log(`Found ${embedTokens.length} active embed tokens\n`);

    let updatedCount = 0;

    for (const token of embedTokens) {
      const partner = token.partner;
      const currentAllowedDomains = token.allowedDomains || [];
      const enhancedAllowedDomains = [...currentAllowedDomains];
      let needsUpdate = false;

      console.log(`Processing token: ${token.name} (Partner: ${partner.businessName})`);
      console.log(`Current allowed domains:`, currentAllowedDomains);

      // Add partner's custom domain if verified
      if (partner.customDomain && partner.customDomainVerified) {
        if (!enhancedAllowedDomains.includes(partner.customDomain)) {
          enhancedAllowedDomains.push(partner.customDomain);
          needsUpdate = true;
          console.log(`  ✅ Added custom domain: ${partner.customDomain}`);
        }
      }

      // Add partner's subdomain if available
      if (partner.subdomain) {
        const subdomainUrl = `${partner.subdomain}.knotie-ai.pro`;
        if (!enhancedAllowedDomains.includes(subdomainUrl)) {
          enhancedAllowedDomains.push(subdomainUrl);
          needsUpdate = true;
          console.log(`  ✅ Added subdomain: ${subdomainUrl}`);
        }
      }

      if (needsUpdate) {
        console.log(`  📝 Updating allowed domains:`, enhancedAllowedDomains);

        // Generate new JWT with updated allowed domains
        const newJWT = createEmbedJWT({
          embedTokenId: token.id,
          customerId: token.customerId,
          partnerId: token.partnerId,
          customerCredentialId: token.customerCredentialId,
          accessMode: token.accessMode,
          allowedDomains: enhancedAllowedDomains,
        });

        // Update the token in database
        await prisma.embedToken.update({
          where: { id: token.id },
          data: {
            allowedDomains: enhancedAllowedDomains,
            token: newJWT,
            updatedAt: new Date(),
          },
        });

        updatedCount++;
        console.log(`  ✅ Token updated successfully\n`);
      } else {
        console.log(`  ⏭️  No update needed\n`);
      }
    }

    console.log(`\n🎉 Fixed ${updatedCount} embed tokens out of ${embedTokens.length} total tokens`);

  } catch (error) {
    console.error('❌ Error fixing embed tokens:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixExistingEmbedTokens().catch(console.error);
