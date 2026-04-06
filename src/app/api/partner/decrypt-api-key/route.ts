import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

// Decrypt API key for form pre-population
export async function POST(request: NextRequest) {
  try {
    console.log('[decrypt-api-key] API endpoint called');
    
    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      console.log('[decrypt-api-key] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      console.log('[decrypt-api-key] No partner ID in token');
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { encryptedKey, provider } = body;

    if (!encryptedKey || !provider) {
      return NextResponse.json(
        { error: 'Missing encryptedKey or provider' },
        { status: 400 }
      );
    }

    console.log('[decrypt-api-key] Decrypting API key for provider:', provider);

    // Decrypt the API key
    try {
      const decryptedKey = await decrypt(encryptedKey);
      console.log('[decrypt-api-key] Successfully decrypted API key');
      
      return NextResponse.json({
        success: true,
        decryptedKey: decryptedKey
      });
    } catch (decryptError) {
      console.error('[decrypt-api-key] Decryption failed:', decryptError);
      return NextResponse.json(
        { error: 'Failed to decrypt API key' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error decrypting API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
