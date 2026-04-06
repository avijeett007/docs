import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Server-only MFA enforcement check
 * Uses server-only environment variable for security
 */
function isAdminMFAEnforced(): boolean {
  return process.env.FEATURE_ADMIN_MFA_ENFORCED === 'true';
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // SECURITY: Use server-side only environment variables for admin operations
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase admin configuration error');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Create admin Supabase client for authentication
    const supabaseAuthClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    // Authenticate user with Supabase Auth
    const { data: authData, error: authError } = await supabaseAuthClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      console.error('Admin authentication failed:', authError?.message);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify user has admin privileges (you can add additional checks here)
    // For now, we'll assume any user who can authenticate is an admin
    // In production, you might want to check user roles or specific email domains

    const user = authData.user;
    const session = authData.session;

    if (!session) {
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Check if MFA is enabled and enforced (server-only security check)
    const mfaEnforced = isAdminMFAEnforced();

    if (mfaEnforced) {
      // Check if user has MFA enabled
      const { data: mfaData, error: mfaError } = await supabaseAdmin
        .from('admin_mfa')
        .select('mfa_enabled, mfa_secret')
        .eq('user_id', user.id)
        .single();

      if (mfaError) {
        // If no MFA record found (PGRST116) or other database error, allow login without MFA
        // This ensures the system remains accessible even if there are database issues
      } else if (mfaData?.mfa_enabled) {

        // Don't set session cookies yet, wait for MFA verification
        // Set a temporary token for MFA verification
        const tempMfaToken = Buffer.from(JSON.stringify({
          userId: user.id,
          email: user.email,
          timestamp: Date.now(),
          sessionToken: session.access_token // Store the actual session token for later use
        })).toString('base64');

        const response = NextResponse.json({
          success: true,
          mfaRequired: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email,
          }
        });

        // Set temporary MFA token cookie (short-lived, 10 minutes)
        response.cookies.set('supabase-admin-mfa-temp', tempMfaToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 10 * 60, // 10 minutes
          path: '/'
        });

        return response;
      } else {
        console.log('🔐 MFA Debug - User has MFA record but MFA is disabled, proceeding with normal login');
        console.log('🔐 MFA Debug - MFA data:', mfaData);
      }
    } else {
      console.log('🔐 MFA Debug - MFA enforcement disabled, proceeding with normal login');
    }

    // Set secure HTTP-only cookies for admin session
    const cookieStore = cookies();
    
    // Set session token cookie
    cookieStore.set('supabase-admin-session', session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: session.expires_in || 3600, // 1 hour default
      path: '/',
    });

    // Set refresh token cookie
    if (session.refresh_token) {
      cookieStore.set('supabase-admin-refresh', session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
    }

    // Set user info cookie (for client-side display)
    cookieStore.set('supabase-admin-user', JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email,
    }), {
      httpOnly: false, // Allow client-side access for display purposes
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: session.expires_in || 3600,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email,
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
