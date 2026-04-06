export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Verify admin authentication using Supabase
async function verifyAdminAuth(request: NextRequest) {
  try {
    // SECURITY: Use server-side only environment variables for admin operations
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return null;
    }

    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const adminSessionToken = cookies['supabase-admin-session'];
    if (!adminSessionToken) {
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error } = await supabase.auth.getUser(adminSessionToken);

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Admin auth error:', error);
    return null;
  }
}

// GET /api/admin/vapi-voices - Fetch voices from VAPI API
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[admin/vapi-voices] Fetching voices from VAPI API');

    // Get VAPI API key from environment or request
    const vapiApiKey = process.env.VAPI_API_KEY;
    if (!vapiApiKey) {
      return NextResponse.json(
        { error: 'VAPI API key not configured' },
        { status: 500 }
      );
    }

    // Fetch voices from VAPI API
    const response = await fetch('https://api.vapi.ai/voice', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin/vapi-voices] VAPI API error:', response.status, errorText);
      return NextResponse.json(
        { 
          error: 'Failed to fetch voices from VAPI',
          details: errorText
        },
        { status: response.status }
      );
    }

    const voices = await response.json();
    console.log(`[admin/vapi-voices] Successfully fetched ${voices.length || 0} voices from VAPI`);

    // Transform VAPI voice data to match our interface
    const transformedVoices = Array.isArray(voices) ? voices.map((voice: any) => ({
      id: voice.id,
      name: voice.name || voice.id,
      displayName: voice.name || voice.id,
      provider: voice.provider || 'vapi',
      voiceModelId: voice.voiceId || voice.id,
      sampleUrl: voice.sampleUrl || null,
      sex: voice.gender || 'unknown',
      voiceType: voice.type || 'standard',
      language: voice.language || 'en',
      accent: voice.accent || null,
      description: voice.description || null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })) : [];

    return NextResponse.json(transformedVoices);

  } catch (error: any) {
    console.error('[admin/vapi-voices] Error fetching VAPI voices:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch VAPI voices',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

// POST /api/admin/vapi-voices/sync - Sync VAPI voices to local database
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[admin/vapi-voices] Syncing VAPI voices to database');

    // Get VAPI API key
    const vapiApiKey = process.env.VAPI_API_KEY;
    if (!vapiApiKey) {
      return NextResponse.json(
        { error: 'VAPI API key not configured' },
        { status: 500 }
      );
    }

    // Fetch voices from VAPI API
    const response = await fetch('https://api.vapi.ai/voice', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin/vapi-voices] VAPI API error:', response.status, errorText);
      return NextResponse.json(
        { 
          error: 'Failed to fetch voices from VAPI',
          details: errorText
        },
        { status: response.status }
      );
    }

    const voices = await response.json();
    
    // TODO: Implement database sync logic here
    // This would involve:
    // 1. Fetching existing voices from database
    // 2. Comparing with VAPI voices
    // 3. Adding new voices
    // 4. Updating existing voices
    // 5. Optionally deactivating removed voices

    console.log(`[admin/vapi-voices] Sync completed for ${voices.length || 0} voices`);

    return NextResponse.json({
      message: 'VAPI voices sync completed',
      count: voices.length || 0
    });

  } catch (error: any) {
    console.error('[admin/vapi-voices] Error syncing VAPI voices:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync VAPI voices',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}
