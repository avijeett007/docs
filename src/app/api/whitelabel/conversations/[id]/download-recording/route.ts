import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify customer authentication
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyCustomerJWT(token);
    if (!decoded || !decoded.customerId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const customerId = decoded.customerId;
    const conversationId = params.id;

    let recordingUrl: string | null = null;

    // Check if we should use analytics service
    const USE_ANALYTICS_SERVICE = process.env.NEXT_PUBLIC_USE_ANALYTICS_SERVICE_WHITELABEL_CONVERSATIONS === 'true';

    if (USE_ANALYTICS_SERVICE) {
      // Get recording URL from analytics service
      const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL;
      const ANALYTICS_API_KEY = process.env.ANALYTICS_STANDARD_API_KEY;

      if (!ANALYTICS_API_URL || !ANALYTICS_API_KEY) {
        return NextResponse.json(
          { error: 'Analytics service not configured' },
          { status: 500 }
        );
      }

      try {
        // Note: V2 doesn't have individual conversation endpoint, so always use V1
        const analyticsResponse = await fetch(`${ANALYTICS_API_URL}/api/v1/app/conversation/${conversationId}`, {
          headers: {
            'x-api-key': ANALYTICS_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          recordingUrl = analyticsData.recordingUrl || analyticsData.stereoRecordingUrl;
        }
      } catch (error) {
        console.error('Error fetching conversation from analytics service:', error);
      }
    } else {
      // Legacy approach: Get conversation data from provider APIs
      // Check if this is a VAPI conversation
      const vapiAgent = await prisma.vapiAgent.findFirst({
        where: {
          customerId: customerId,
        },
        include: {
          partner: {
            select: {
              vapiApiKey: true
            }
          }
        }
      });

      if (vapiAgent?.partner?.vapiApiKey) {
        // Try to get VAPI conversation
        const { decrypt } = await import('@/lib/encryption');
        const decryptedApiKey = await decrypt(vapiAgent.partner.vapiApiKey);

        try {
          const vapiResponse = await fetch(`https://api.vapi.ai/call/${conversationId}`, {
            headers: {
              'Authorization': `Bearer ${decryptedApiKey}`,
              'Accept': 'application/json'
            }
          });

          if (vapiResponse.ok) {
            const vapiData = await vapiResponse.json();
            recordingUrl = vapiData.recordingUrl || vapiData.stereoRecordingUrl;
          }
        } catch (error) {
          console.error('Error fetching VAPI conversation:', error);
        }
      }

      // If not found in VAPI, try Retell
      if (!recordingUrl) {
        const retellAgent = await prisma.retellAgent.findFirst({
          where: {
            customerId: customerId,
          },
          include: {
            partner: {
              select: {
                retellApiKey: true
              }
            }
          }
        });

        if (retellAgent?.partner?.retellApiKey) {
          const { decrypt } = await import('@/lib/encryption');
          const decryptedApiKey = await decrypt(retellAgent.partner.retellApiKey);

          try {
            const retellResponse = await fetch(`https://api.retellai.com/get-call/${conversationId}`, {
              headers: {
                'Authorization': `Bearer ${decryptedApiKey}`,
                'Accept': 'application/json'
              }
            });

            if (retellResponse.ok) {
              const retellData = await retellResponse.json();
              recordingUrl = retellData.recording_url;
            }
          } catch (error) {
            console.error('Error fetching Retell conversation:', error);
          }
        }
      }
    }

    if (!recordingUrl) {
      return NextResponse.json(
        { error: 'Recording not found or not available' },
        { status: 404 }
      );
    }

    // Stream the recording from the provider URL
    const recordingResponse = await fetch(recordingUrl);

    if (!recordingResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch recording from provider' },
        { status: recordingResponse.status }
      );
    }

    // Get the content type and content length
    const contentType = recordingResponse.headers.get('content-type') || 'audio/wav';
    const contentLength = recordingResponse.headers.get('content-length');

    // Determine file extension from content type or URL
    let extension = 'wav';
    if (contentType.includes('mp3') || recordingUrl.includes('.mp3')) {
      extension = 'mp3';
    } else if (contentType.includes('wav') || recordingUrl.includes('.wav')) {
      extension = 'wav';
    } else if (contentType.includes('m4a') || recordingUrl.includes('.m4a')) {
      extension = 'm4a';
    }

    // Create filename with current date
    const date = new Date().toLocaleDateString().replace(/\//g, '-');
    const filename = `recording-${conversationId}-${date}.${extension}`;

    // Set up response headers for download
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
    });

    // Add content length if available
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    // Stream the response directly without storing on disk
    return new NextResponse(recordingResponse.body, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Error in download-recording route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
