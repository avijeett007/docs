export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

interface CreateVoiceRequest {
  voiceId: string;
  providerId: string;
  voiceName: string;
  sampleVoiceUrl?: string;
  sex?: string;
  voiceType?: string;
  language?: string;
  accent?: string;
  description?: string;
}

// GET /api/admin/voices - List all voice configurations
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

    console.log('[admin/voices] Fetching voice configurations');

    // Fetch all voice configurations
    const voices = await prisma.voice.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        provider: true,
        voiceModelId: true,
        sampleUrl: true,
        isActive: true,
        sex: true,
        voiceType: true,
        language: true,
        accent: true,
        description: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log(`[admin/voices] Found ${voices.length} voice configurations`);

    return NextResponse.json(voices);

  } catch (error: any) {
    console.error('[admin/voices] Error fetching voice configurations:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch voice configurations',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

// POST /api/admin/voices - Create a new voice configuration
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

    const requestData: CreateVoiceRequest = await request.json();
    console.log('[admin/voices] Creating voice configuration:', requestData);

    // Validate required fields
    if (!requestData.voiceId || !requestData.providerId || !requestData.voiceName) {
      return NextResponse.json({
        error: 'Missing required fields: voiceId, providerId, and voiceName are required'
      }, { status: 400 });
    }

    // Check if voice ID already exists for this provider
    const existingVoice = await prisma.voice.findFirst({
      where: {
        voiceModelId: requestData.voiceId,
        provider: requestData.providerId
      }
    });

    if (existingVoice) {
      return NextResponse.json({
        error: 'Voice configuration already exists',
        message: `A voice with ID "${requestData.voiceId}" already exists for provider "${requestData.providerId}"`
      }, { status: 409 });
    }

    // Create a global voice configuration available to all partners
    const voice = await prisma.voice.create({
      data: {
        name: requestData.voiceId, // Use voiceId as name for now
        displayName: requestData.voiceName,
        provider: requestData.providerId,
        voiceModelId: requestData.voiceId,
        sampleUrl: requestData.sampleVoiceUrl || null,
        sex: requestData.sex || 'unknown',
        voiceType: requestData.voiceType || 'standard',
        language: requestData.language || 'en',
        accent: requestData.accent || null,
        description: requestData.description || null,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        provider: true,
        voiceModelId: true,
        sampleUrl: true,
        sex: true,
        voiceType: true,
        language: true,
        accent: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log('[admin/voices] Voice configuration created successfully:', voice.id);

    return NextResponse.json(voice, { status: 201 });

  } catch (error: any) {
    console.error('[admin/voices] Error creating voice configuration:', error);

    // Handle Prisma constraint errors
    if (error.code === 'P2002') {
      return NextResponse.json({
        error: 'Voice configuration already exists',
        message: 'A voice with this ID and provider combination already exists'
      }, { status: 409 });
    }

    return NextResponse.json({
      error: 'Failed to create voice configuration',
      message: error.message || 'An unexpected error occurred'
    }, { status: 500 });
  }
}
