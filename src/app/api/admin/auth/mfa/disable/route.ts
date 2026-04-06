import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to disable MFA' },
        { status: 400 }
      );
    }

    // Get session token from cookie
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('supabase-admin-session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify the session token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(sessionToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Verify password by attempting to sign in
    const { error: passwordError } = await supabaseAdmin.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (passwordError) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 400 }
      );
    }

    // Check if MFA is enabled
    const { data: mfaData, error: mfaError } = await supabaseAdmin
      .from('admin_mfa')
      .select('mfa_enabled')
      .eq('user_id', user.id)
      .single();

    if (mfaError && mfaError.code !== 'PGRST116') {
      console.error('Error checking MFA status:', mfaError);
      return NextResponse.json(
        { error: 'Failed to check MFA status' },
        { status: 500 }
      );
    }

    if (!mfaData?.mfa_enabled) {
      return NextResponse.json(
        { error: 'MFA is not enabled for this account' },
        { status: 400 }
      );
    }

    // Disable MFA by clearing all MFA data
    const { error: updateError } = await supabaseAdmin
      .from('admin_mfa')
      .update({
        mfa_enabled: false,
        mfa_secret: null,
        mfa_backup_codes: null,
        mfa_last_used_at: null,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error disabling MFA:', updateError);
      return NextResponse.json(
        { error: 'Failed to disable MFA' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'MFA has been successfully disabled for your account.',
    });

  } catch (error) {
    console.error('MFA disable error:', error);
    return NextResponse.json(
      { error: 'Failed to disable MFA' },
      { status: 500 }
    );
  }
}
