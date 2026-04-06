import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerToken } from '@/lib/auth';



export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { prospectId: string } }
) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { prospectId } = params;

    // Fetch the prospect with all details
    const prospect = await prisma.prospect.findUnique({
      where: {
        id: prospectId
      }
    });

    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect not found' },
        { status: 404 }
      );
    }

    // Ensure the authenticated partner can only access their own prospects
    if (prospect.partnerId !== authResult.partner.id) {
      return NextResponse.json(
        { error: 'Forbidden - can only access your own prospects' },
        { status: 403 }
      );
    }

    // If the prospect has a selected voice ID, fetch voice details from the appropriate provider
    let voiceDetails = null;
    if (prospect.selectedVoiceId) {
      try {
        const audioMode = process.env.SAAS_Audio_Mode || 'cartesia';

        if (audioMode === 'retell') {
          // Fetch voice details from Retell using our curated API
          const voicesResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/retell/voices?gender=all&limit=100`);

          if (voicesResponse.ok) {
            const voicesData = await voicesResponse.json();
            if (voicesData.success && voicesData.voices) {
              voiceDetails = voicesData.voices.find((voice: any) => voice.voice_id === prospect.selectedVoiceId);
            }
          }
        } else {
          // Fetch voice details from Cartesia (default)
          const cartesiaApiKey = process.env.CARTESIA_API_KEY;
          if (cartesiaApiKey) {
            const voiceResponse = await fetch(`https://api.cartesia.ai/voices/${prospect.selectedVoiceId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${cartesiaApiKey}`,
                'Cartesia-Version': '2025-04-16',
              },
            });

            if (voiceResponse.ok) {
              voiceDetails = await voiceResponse.json();
            }
          }
        }
      } catch (error) {
        console.error('Error fetching voice details:', error);
        // Continue without voice details if API call fails
      }
    }

    return NextResponse.json({
      success: true,
      prospect: {
        ...prospect,
        voiceDetails
      }
    });

  } catch (error) {
    console.error('Error fetching prospect details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
