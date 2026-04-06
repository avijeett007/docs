import { NextRequest, NextResponse } from 'next/server';
import { migrateExistingPartners } from '@/scripts/migrate-existing-partners-credits';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only environment variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase URL or Key is missing');
      return null;
    }

    // Extract cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';

    // Parse cookies to find our custom admin session cookie
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    // Check for our custom admin session token
    const adminSessionToken = cookies['supabase-admin-session'];

    if (!adminSessionToken) {
      console.log('Authentication failed: missing token');
      return null;
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the token by setting it and getting the user
    const { data: { user }, error } = await supabase.auth.getUser(adminSessionToken);

    if (error) {
      console.error('Authentication error');
      return null;
    }

    if (!user) {
      console.log('Authentication failed: invalid token');
      return null;
    }

    console.log('Admin authentication successful');
    return user;
  } catch (error) {
    console.error('Authentication exception');
    return null;
  }
}

/**
 * POST /api/admin/migrate-partner-credits
 * Migrate existing partners to credit system
 *
 * Body:
 * {
 *   "dryRun": boolean (default: true)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { dryRun = true } = await request.json();

    console.log(`Starting partner credit migration (${dryRun ? 'DRY RUN' : 'LIVE RUN'})`);

    const result = await migrateExistingPartners(dryRun);

    return NextResponse.json({
      success: true,
      message: `Migration ${dryRun ? 'simulation' : 'execution'} completed`,
      data: result,
      dryRun
    });

  } catch (error) {
    console.error('Error in partner credit migration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrate-partner-credits
 * Get migration status and preview
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run a dry run to show what would happen
    const preview = await migrateExistingPartners(true);

    return NextResponse.json({
      success: true,
      message: 'Migration preview generated',
      data: preview,
      preview: true
    });

  } catch (error) {
    console.error('Error generating migration preview:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
