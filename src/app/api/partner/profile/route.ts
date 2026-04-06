export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { encrypt, decrypt, isLikelyEncrypted } from '@/lib/encryption';

// Function to update partner in analytics service
async function updatePartnerInAnalytics(partner: {
  id: string;
  businessName: string;
  contactName: string;
  emailAddress: string;
  vapiApiKey?: string | null;
  retellApiKey?: string | null;
  ultravoxApiKey?: string | null;
}) {
  try {
    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
    const analyticsApiKey = process.env.ANALYTICS_ADMIN_API_KEY;

    if (!analyticsApiKey) {
      console.error('Missing ANALYTICS_ADMIN_API_KEY environment variable');
      return false;
    }

    // Log API keys to verify they are unencrypted (first 5 chars only for security)
    console.log('[updatePartnerInAnalytics] Received API keys:', {
      vapiKey: partner.vapiApiKey ?
        `${partner.vapiApiKey.substring(0, 5)}... (length: ${partner.vapiApiKey.length})` : 'undefined',
      retellKey: partner.retellApiKey ?
        `${partner.retellApiKey.substring(0, 5)}... (length: ${partner.retellApiKey.length})` : 'undefined',
      ultravoxKey: partner.ultravoxApiKey ?
        `${partner.ultravoxApiKey.substring(0, 5)}... (length: ${partner.ultravoxApiKey.length})` : 'undefined'
    });

    // Check if the keys appear to be encrypted (based on their length and format)
    const isVapiKeyLikelyEncrypted = partner.vapiApiKey && partner.vapiApiKey.length > 100;
    const isRetellKeyLikelyEncrypted = partner.retellApiKey && partner.retellApiKey.length > 100;
    const isUltravoxKeyLikelyEncrypted = partner.ultravoxApiKey && partner.ultravoxApiKey.length > 100;

    if (isVapiKeyLikelyEncrypted || isRetellKeyLikelyEncrypted || isUltravoxKeyLikelyEncrypted) {
      console.warn('[updatePartnerInAnalytics] WARNING: API keys appear to be encrypted!', {
        isVapiKeyLikelyEncrypted,
        isRetellKeyLikelyEncrypted,
        isUltravoxKeyLikelyEncrypted
      });
    }

    // Build the request body, only including keys if they are provided
    const requestBody: any = {
      partner_id: partner.id,
      business_name: partner.businessName,
      partner_name: partner.contactName,
      email: partner.emailAddress
    };

    // Only include VAPI API key if provided and not null/empty
    if (partner.vapiApiKey && typeof partner.vapiApiKey === 'string' && partner.vapiApiKey.trim() !== '') {
      requestBody.vapi_api_key = partner.vapiApiKey;
    }

    // Only include Retell API key if provided and not null/empty
    if (partner.retellApiKey && typeof partner.retellApiKey === 'string' && partner.retellApiKey.trim() !== '') {
      requestBody.retell_api_key = partner.retellApiKey;
    }

    // Only include Ultravox API key if provided and not null/empty
    if (partner.ultravoxApiKey && typeof partner.ultravoxApiKey === 'string' && partner.ultravoxApiKey.trim() !== '') {
      requestBody.ultravox_api_key = partner.ultravoxApiKey;
    }

    console.log(`[updatePartnerInAnalytics] Updating partner ${partner.id} in analytics service:`,
      {
        hasVapiKey: !!requestBody.vapi_api_key,
        hasRetellKey: !!requestBody.retell_api_key,
        url: `${analyticsApiUrl}/partners/${partner.id}`
      }
    );

    const response = await fetch(`${analyticsApiUrl}/partners/${partner.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': analyticsApiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`[updatePartnerInAnalytics] Failed to update partner ${partner.id} in analytics:`, errorData);
      return false;
    }

    console.log(`[updatePartnerInAnalytics] Successfully updated partner ${partner.id} in analytics service`);
    return true;
  } catch (error) {
    console.error(`[updatePartnerInAnalytics] Error updating partner ${partner.id} in analytics:`, error);
    return false;
  }
}

export async function GET(request: Request) {
  try {
    // Get the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    console.log('Auth header:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid Authorization header found');
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    console.log('Extracted token:', token.substring(0, 20) + '...');

    const payload = await verifyJWT(token);
    console.log('Verified JWT payload:', payload);

    if (!payload) {
      console.log('No payload returned from verifyJWT');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!payload.partnerId) {
      console.log('No partnerId in payload:', payload);
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: {
        id: payload.partnerId,
      },
      select: {
        id: true,
        businessName: true,
        contactName: true,
        emailAddress: true,
        phoneNumber: true,
        areaOfBusiness: true,
        expertise: true,
        partnershipType: true,
        approvalStatus: true,
        partnerCode: true,
        ghlCalendarId: true,
        ghlLocationId: true,
        ghlApiKey: true,
        vapiApiKey: true,
        retellApiKey: true,
        ultravoxApiKey: true,
        businessAddress: true,
        maxTeamMembers: true,
        // Welcome video tracking
        hasSeenWelcomeVideo: true,
        hasChangedPassword: true,
        // Onboarding walkthrough tracking
        walkthroughCompletedAt: true,
        // SMTP settings
        useCustomSmtp: true,
        smtpHost: true,
        smtpPort: true,
        smtpUsername: true,
        smtpPassword: true,
        smtpFromEmail: true,
        smtpFromName: true,
        // SES Domain Email Service settings
        sesDomain: true,
        sesDomainStatus: true,
        sesDomainVerificationToken: true,
        sesDomainVerificationStartedAt: true,
        sesDomainVerifiedAt: true,
        sesDkimTokens: true,
        sesFromEmail: true,
        sesFromName: true,
        useSESDomain: true,
        sesDomainEnabled: true,
        // Branding settings
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        fontFamily: true,
        portalTitle: true,
        portalSlogan: true,
        subdomain: true,
        customDomain: true,
        customDomainVerified: true,
        // SaaS mode settings
        saasMode: true,
        manualSaasModeEnabled: true,
        // Subscription plan & tier
        planId: true,
        marketingTier: true,
        subscriptionStatus: true,
        // AI Analytics gating
        enableAiAnalytics: true,
        creditBalance: true,
      },
    });

    if (!partner) {
      console.log('No partner found with ID:', payload.partnerId);
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Compute isFreeForever server-side (canonical logic from tierValidationService)
    const freeForeverPriceId = process.env.STRIPE_FREE_FOREVER_PRICE_ID;
    const isFreeForever =
      partner.marketingTier === 'free_forever' ||
      partner.planId === 'free_forever' ||
      partner.planId === 'free_forever_trial' ||
      !!(freeForeverPriceId && partner.planId === freeForeverPriceId) ||
      (partner.subscriptionStatus === 'INACTIVE' && !partner.planId);

    return NextResponse.json({ ...partner, isFreeForever });
  } catch (error) {
    console.error('Error fetching partner profile:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching partner profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    // Get the token from the Authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyJWT(token);

    if (!payload || !payload.partnerId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const {
      businessName,
      contactName,
      businessAddress,
      emailAddress,
      phoneNumber,
      areaOfBusiness,
      expertise,
      partnershipType,
      ghlCalendarId,
      ghlLocationId,
      ghlApiKey,
      vapiApiKey,
      retellApiKey,
      ultravoxApiKey,
      maxTeamMembers
    } = body;

    // Store original API keys for analytics service before encryption
    const originalVapiApiKey = vapiApiKey;
    const originalRetellApiKey = retellApiKey;
    const originalUltravoxApiKey = ultravoxApiKey;

    // Log raw API keys (first 5 chars only for security)
    if (originalVapiApiKey) {
      console.log(`[profile/route] Original VAPI API key (first 5 chars): ${originalVapiApiKey.substring(0, 5)}...`);
    }
    if (originalRetellApiKey) {
      console.log(`[profile/route] Original Retell API key (first 5 chars): ${originalRetellApiKey.substring(0, 5)}...`);
    }
    if (originalUltravoxApiKey) {
      console.log(`[profile/route] Original Ultravox API key (first 5 chars): ${originalUltravoxApiKey.substring(0, 5)}...`);
    }

    // Create update data object, only including non-empty fields
    const updateData: any = {};

    // Only include fields that are provided and not empty
    if (businessName?.trim()) updateData.businessName = businessName;
    if (contactName?.trim()) updateData.contactName = contactName;
    if (businessAddress?.trim()) updateData.businessAddress = businessAddress;
    if (emailAddress?.trim()) updateData.emailAddress = emailAddress;
    if (phoneNumber?.trim()) updateData.phoneNumber = phoneNumber;
    if (areaOfBusiness?.trim()) updateData.areaOfBusiness = areaOfBusiness;
    if (expertise?.trim()) updateData.expertise = expertise;
    if (partnershipType?.trim()) updateData.partnershipType = partnershipType;

    // Handle special fields that can be null
    if (ghlCalendarId !== undefined) {
      updateData.ghlCalendarId = ghlCalendarId || null;
    }
    if (ghlLocationId !== undefined) {
      updateData.ghlLocationId = ghlLocationId || null;
    }

    // Handle maxTeamMembers field
    if (maxTeamMembers !== undefined) {
      updateData.maxTeamMembers = parseInt(maxTeamMembers, 10) || 2; // Default to 2 if invalid
    }

    // Only update API keys if they are explicitly provided and not empty
    if (ghlApiKey !== undefined) {
      console.log('[profile/route] Processing GHL API key - provided:', !!ghlApiKey);

      // Only encrypt if it's not already encrypted and not null
      if (ghlApiKey && !isLikelyEncrypted(ghlApiKey)) {
        console.log('[profile/route] GHL API key needs encryption - length:', ghlApiKey.length);
        updateData.ghlApiKey = await encrypt(ghlApiKey);
        console.log('[profile/route] GHL API key encrypted - length:', updateData.ghlApiKey.length);
      } else if (ghlApiKey) {
        console.log('[profile/route] GHL API key already appears to be encrypted - using as is');
        updateData.ghlApiKey = ghlApiKey;
      } else {
        updateData.ghlApiKey = null;
      }
    }

    if (vapiApiKey !== undefined) {
      console.log('[profile/route] Processing VAPI API key - provided:', !!vapiApiKey);
      console.log('[profile/route] VAPI API key original length:', vapiApiKey ? vapiApiKey.length : 0);

      // Only encrypt if it's not already encrypted and not null
      if (vapiApiKey && !isLikelyEncrypted(vapiApiKey)) {
        console.log('[profile/route] VAPI API key needs encryption - length:', vapiApiKey.length);
        updateData.vapiApiKey = await encrypt(vapiApiKey);
        console.log('[profile/route] VAPI API key encrypted - length:', updateData.vapiApiKey.length);
      } else if (vapiApiKey) {
        console.log('[profile/route] VAPI API key already appears to be encrypted - using as is');
        updateData.vapiApiKey = vapiApiKey;
      } else {
        updateData.vapiApiKey = null;
      }
    }

    if (retellApiKey !== undefined) {
      console.log('[profile/route] Processing Retell API key - provided:', !!retellApiKey);
      console.log('[profile/route] Retell API key original length:', retellApiKey ? retellApiKey.length : 0);

      // Only encrypt if it's not already encrypted and not null
      if (retellApiKey && !isLikelyEncrypted(retellApiKey)) {
        console.log('[profile/route] Retell API key needs encryption - length:', retellApiKey.length);
        updateData.retellApiKey = await encrypt(retellApiKey);
        console.log('[profile/route] Retell API key encrypted - length:', updateData.retellApiKey.length);
      } else if (retellApiKey) {
        console.log('[profile/route] Retell API key already appears to be encrypted - using as is');
        updateData.retellApiKey = retellApiKey;
      } else {
        updateData.retellApiKey = null;
      }
    }

    if (ultravoxApiKey !== undefined) {
      console.log('[profile/route] Processing Ultravox API key - provided:', !!ultravoxApiKey);
      console.log('[profile/route] Ultravox API key original length:', ultravoxApiKey ? ultravoxApiKey.length : 0);

      // Only encrypt if it's not already encrypted and not null
      if (ultravoxApiKey && !isLikelyEncrypted(ultravoxApiKey)) {
        console.log('[profile/route] Ultravox API key needs encryption - length:', ultravoxApiKey.length);
        updateData.ultravoxApiKey = await encrypt(ultravoxApiKey);
        console.log('[profile/route] Ultravox API key encrypted - length:', updateData.ultravoxApiKey.length);
      } else if (ultravoxApiKey) {
        console.log('[profile/route] Ultravox API key already appears to be encrypted - using as is');
        updateData.ultravoxApiKey = ultravoxApiKey;
      } else {
        updateData.ultravoxApiKey = null;
      }
    }

    // Validate that we're not accidentally emptying required fields
    const partner = await prisma.partner.findUnique({
      where: { id: payload.partnerId },
      select: {
        businessName: true,
        emailAddress: true,
        contactName: true,
        businessAddress: true,
        phoneNumber: true,
        areaOfBusiness: true,
        expertise: true,
        partnershipType: true,
        ghlApiKey: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Ensure required fields are not emptied
    const requiredFields = [
      'businessName',
      'emailAddress',
      'contactName',
      'businessAddress',
      'phoneNumber',
      'areaOfBusiness',
      'expertise',
      'partnershipType',
    ] as const;

    for (const field of requiredFields) {
      if (!updateData[field]) {
        updateData[field] = partner[field];
      }
    }

    // Check if GHL credentials are being updated (API key or Location ID)
    const isGhlCredentialsUpdated = (ghlApiKey !== undefined && ghlApiKey) || (ghlLocationId !== undefined && ghlLocationId);

    // Update partner details
    const updatedPartner = await prisma.partner.update({
      where: {
        id: payload.partnerId,
      },
      data: updateData,
      select: {
        id: true,
        businessName: true,
        contactName: true,
        businessAddress: true,
        emailAddress: true,
        phoneNumber: true,
        areaOfBusiness: true,
        expertise: true,
        partnershipType: true,
        approvalStatus: true,
        partnerCode: true,
        ghlCalendarId: true,
        ghlLocationId: true,
        ghlApiKey: true,
        vapiApiKey: true,
        retellApiKey: true,
        ultravoxApiKey: true,
        maxTeamMembers: true,
      },
    });

    // Create/update provider token for GHL if API key is provided
    if (ghlApiKey && ghlLocationId) {
      console.log(`[profile/route] Creating/updating GHL provider token for partner ${updatedPartner.id}`);

      try {
        // Check if provider token already exists
        const existingToken = await prisma.providerToken.findFirst({
          where: {
            partnerId: updatedPartner.id,
            provider: 'ghl',
            resourceId: ghlLocationId,
          },
        });

        const tokenData = {
          tenantId: updatedPartner.id, // Use partner ID as tenant ID since Partner model doesn't have tenantId
          partnerId: updatedPartner.id,
          provider: 'ghl',
          resourceId: ghlLocationId,
          accessToken: updateData.ghlApiKey || ghlApiKey, // Use encrypted version if available
          refreshToken: updateData.ghlApiKey || ghlApiKey, // GHL uses API keys, not OAuth
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          scope: 'contacts.write contacts.readonly locations.readonly',
          status: 'active',
          metadata: {
            locationId: ghlLocationId,
            updatedAt: new Date().toISOString(),
          },
        };

        if (existingToken) {
          // Update existing token
          await prisma.providerToken.update({
            where: { id: existingToken.id },
            data: {
              accessToken: tokenData.accessToken,
              refreshToken: tokenData.refreshToken,
              expiresAt: tokenData.expiresAt,
              status: 'active',
              metadata: tokenData.metadata,
              updatedAt: new Date(),
            },
          });
          console.log(`[profile/route] Updated existing GHL provider token for partner ${updatedPartner.id}`);
        } else {
          // Create new token
          await prisma.providerToken.create({
            data: tokenData,
          });
          console.log(`[profile/route] Created new GHL provider token for partner ${updatedPartner.id}`);
        }
      } catch (error) {
        console.error(`[profile/route] Error creating/updating GHL provider token:`, error);
        // Don't fail the request if provider token creation fails
      }
    }

    // Trigger GHL sync whenever credentials are updated (handles token rotation, location changes, etc.)
    if (isGhlCredentialsUpdated) {
      console.log(`[profile/route] GHL credentials updated for partner ${updatedPartner.id}, triggering sync`);

      try {
        const knotieManagerUrl = process.env.KNOTIE_MANAGER_URL || 'http://localhost:3002';
        const knotieManagerApiKey = process.env.KNOTIE_MANAGER_API_KEY;

        if (knotieManagerApiKey) {
          const syncResponse = await fetch(`${knotieManagerUrl}/api/ghl/initialize-sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': knotieManagerApiKey,
            },
            body: JSON.stringify({ partnerId: updatedPartner.id }),
          });

          if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            console.log(`[profile/route] Successfully triggered GHL sync for partner ${updatedPartner.id}:`, syncResult);
          } else {
            console.warn(`[profile/route] Failed to trigger GHL sync for partner ${updatedPartner.id}: ${syncResponse.status}`);
          }
        } else {
          console.warn('[profile/route] KNOTIE_MANAGER_API_KEY not configured, skipping GHL sync');
        }
      } catch (error) {
        console.error(`[profile/route] Error triggering GHL sync for partner ${updatedPartner.id}:`, error);
        // Don't fail the request if sync trigger fails
      }
    }

    // Update partner in analytics service if API keys were updated
    if (vapiApiKey !== undefined || retellApiKey !== undefined || ultravoxApiKey !== undefined) {
      console.log('[profile/route] Updating partner in analytics service');

      // Prepare API keys for analytics - decrypt if they are encrypted
      let analyticsVapiKey = originalVapiApiKey;
      let analyticsRetellKey = originalRetellApiKey;
      let analyticsUltravoxKey = originalUltravoxApiKey;

      // If VAPI key appears encrypted, try to decrypt it
      if (analyticsVapiKey && isLikelyEncrypted(analyticsVapiKey)) {
        console.log('[profile/route] VAPI API key appears encrypted, attempting to decrypt');
        try {
          analyticsVapiKey = await decrypt(analyticsVapiKey);
          console.log('[profile/route] Successfully decrypted VAPI API key');
        } catch (error) {
          console.error('[profile/route] Failed to decrypt VAPI API key:', error);
          // Keep the encrypted version as fallback
        }
      }

      // If Retell key appears encrypted, try to decrypt it
      if (analyticsRetellKey && isLikelyEncrypted(analyticsRetellKey)) {
        console.log('[profile/route] Retell API key appears encrypted, attempting to decrypt');
        try {
          analyticsRetellKey = await decrypt(analyticsRetellKey);
          console.log('[profile/route] Successfully decrypted Retell API key');
        } catch (error) {
          console.error('[profile/route] Failed to decrypt Retell API key:', error);
          // Keep the encrypted version as fallback
        }
      }

      // If Ultravox key appears encrypted, try to decrypt it
      if (analyticsUltravoxKey && isLikelyEncrypted(analyticsUltravoxKey)) {
        console.log('[profile/route] Ultravox API key appears encrypted, attempting to decrypt');
        try {
          analyticsUltravoxKey = await decrypt(analyticsUltravoxKey);
          console.log('[profile/route] Successfully decrypted Ultravox API key');
        } catch (error) {
          console.error('[profile/route] Failed to decrypt Ultravox API key:', error);
          // Keep the encrypted version as fallback
        }
      }

      // Log the keys being sent to analytics (first 5 chars for security)
      console.log('[profile/route] Keys being sent to analytics:', {
        vapiKey: analyticsVapiKey ? `${analyticsVapiKey.substring(0, 5)}...` : 'undefined',
        retellKey: analyticsRetellKey ? `${analyticsRetellKey.substring(0, 5)}...` : 'undefined',
        ultravoxKey: analyticsUltravoxKey ? `${analyticsUltravoxKey.substring(0, 5)}...` : 'undefined',
      });

      // Send the decrypted API keys to the analytics service
      const analyticsResult = await updatePartnerInAnalytics({
        id: updatedPartner.id,
        businessName: updatedPartner.businessName,
        contactName: updatedPartner.contactName,
        emailAddress: updatedPartner.emailAddress,
        vapiApiKey: analyticsVapiKey,
        retellApiKey: analyticsRetellKey,
        ultravoxApiKey: analyticsUltravoxKey
      });

      if (!analyticsResult) {
        console.warn('[profile/route] Failed to update partner in analytics service, but continuing');
      } else {
        console.log(`[profile/route] Successfully updated partner ${updatedPartner.id} in analytics service`);
      }
    }

    return NextResponse.json(updatedPartner);
  } catch (error) {
    console.error('Error updating partner profile:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating partner profile' },
      { status: 500 }
    );
  }
}