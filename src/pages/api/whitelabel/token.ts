import { NextApiRequest, NextApiResponse } from "next";
import { generateRandomAlphanumeric } from "@/lib/util";
import { prisma } from "@/lib/prisma";

import { AccessToken } from "livekit-server-sdk";
import type { AccessTokenOptions, VideoGrant } from "livekit-server-sdk";
import { TokenResult } from "../../../lib/types";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

const createToken = (userInfo: AccessTokenOptions, grant: VideoGrant) => {
  const at = new AccessToken(apiKey, apiSecret, userInfo);
  at.addGrant(grant);
  return at.toJwt();
};

export default async function handleWhitelabelToken(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (!apiKey || !apiSecret) {
      res.statusMessage = "Environment variables aren't set up correctly";
      res.status(500).end();
      return;
    }

    // Get partner information from headers (set by middleware)
    const partnerId = req.headers['x-partner-id'] as string;
    const partnerDetails = req.headers['x-partner-details'] as string;

    let partnerData = null;

    // Try to get partner data from headers first
    if (partnerDetails) {
      try {
        partnerData = JSON.parse(partnerDetails);
      } catch (e) {
        console.error('Failed to parse partner details from header:', e);
      }
    }

    // If no partner data in headers and we have a partner ID, fetch from database
    if (!partnerData && partnerId) {
      try {
        const partner = await prisma.partner.findUnique({
          where: { id: partnerId },
          select: {
            id: true,
            businessName: true,
            portalTitle: true,
            portalSlogan: true,
            voiceAiAgentEnabled: true,
            voiceAiAgentPricingNote: true,
            voiceAiAgentSpecialOffer: true,
            voiceAiAgentName: true,
            voiceAiAgentVoiceType: true,
            voiceAiAgentLanguage: true,
            voiceAiAgentVoiceConfig: true,
            voiceAiAgentId: true,
            subdomain: true,
            customDomain: true,
          }
        });

        if (partner) {
          partnerData = partner;
        }
      } catch (error) {
        console.error('Error fetching partner data:', error);
      }
    }

    // Generate room and identity
    const roomName = `whitelabel-room-${generateRandomAlphanumeric(4)}-${generateRandomAlphanumeric(4)}-knotie`;
    const identity = `whitelabel-identity-${generateRandomAlphanumeric(4)}`;

    // Determine the website link dynamically
    let websiteLink = '';
    if (partnerData?.customDomain) {
      websiteLink = `https://${partnerData.customDomain}`;
    } else if (partnerData?.subdomain) {
      websiteLink = `https://${partnerData.subdomain}.knotie-ai.pro`;
    }

    // Extract voice configuration if available
    let voiceConfig = null;
    if (partnerData?.voiceAiAgentVoiceConfig) {
      try {
        voiceConfig = typeof partnerData.voiceAiAgentVoiceConfig === 'string'
          ? JSON.parse(partnerData.voiceAiAgentVoiceConfig)
          : partnerData.voiceAiAgentVoiceConfig;
      } catch (error) {
        console.error('Error parsing voice config:', error);
      }
    }

    // Create metadata object with partner information
    const metadata = {
      source: 'whitelabel',
      partnerId: partnerId || 'unknown',
      businessName: partnerData?.businessName || 'Unknown Business',
      agentName: partnerData?.voiceAiAgentName || 'Knotie',
      voiceType: partnerData?.voiceAiAgentVoiceType || 'female',
      language: partnerData?.voiceAiAgentLanguage || 'en',
      websiteLink: websiteLink,
      pricingNote: partnerData?.voiceAiAgentPricingNote || '',
      specialOffer: partnerData?.voiceAiAgentSpecialOffer || '',
      // Agent ID for analytics
      agent_id: partnerData?.voiceAiAgentId || null,
      // Voice configuration metadata
      voiceProvider: voiceConfig?.provider || null,
      voiceModelId: voiceConfig?.voiceModelId || null,
      voiceId: voiceConfig?.voiceId || null,
      voiceDisplayName: voiceConfig?.displayName || null,
      voiceLanguageCapabilities: voiceConfig?.languageCapabilities || null,
      voiceUseCases: voiceConfig?.useCases || null
    };

    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    };

    // Create token with metadata
    const token = await createToken({ 
      identity,
      metadata: JSON.stringify(metadata)
    }, grant);

    const result: TokenResult = {
      identity,
      accessToken: token,
    };

    console.log('Generated whitelabel token with metadata:', {
      identity,
      roomName,
      partnerId,
      businessName: partnerData?.businessName,
      agentId: partnerData?.voiceAiAgentId,
      voiceProvider: voiceConfig?.provider,
      voiceModelId: voiceConfig?.voiceModelId,
      language: partnerData?.voiceAiAgentLanguage
    });

    res.status(200).json(result);
  } catch (e) {
    console.error('Error generating whitelabel token:', e);
    res.statusMessage = (e as Error).message;
    res.status(500).end();
  }
}
