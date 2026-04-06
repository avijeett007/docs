import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTOTP, isValidOTPFormat } from '@/lib/mfa';
import { decryptData } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      );
    }

    if (!isValidOTPFormat(code)) {
      return NextResponse.json(
        { error: 'Invalid code format. Please enter a 6-digit code.' },
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

    // Get MFA data
    const { data: mfaData, error: mfaError } = await supabaseAdmin
      .from('admin_mfa')
      .select('mfa_enabled, mfa_secret')
      .eq('user_id', user.id)
      .single();

    if (mfaError) {
      console.error('Error fetching MFA data:', mfaError);
      return NextResponse.json(
        { error: 'MFA setup not found. Please start the setup process again.' },
        { status: 404 }
      );
    }

    if (mfaData.mfa_enabled) {
      return NextResponse.json(
        { error: 'MFA is already enabled' },
        { status: 400 }
      );
    }

    if (!mfaData.mfa_secret) {
      return NextResponse.json(
        { error: 'MFA secret not found. Please start the setup process again.' },
        { status: 400 }
      );
    }

    // Decrypt and verify the TOTP code
    const secret = await decryptData(mfaData.mfa_secret);
    const isValid = verifyTOTP(code, secret);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please try again.' },
        { status: 400 }
      );
    }

    // Enable MFA
    const { error: updateError } = await supabaseAdmin
      .from('admin_mfa')
      .update({
        mfa_enabled: true,
        mfa_last_used_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error enabling MFA:', updateError);
      return NextResponse.json(
        { error: 'Failed to enable MFA' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'MFA has been successfully enabled for your account.',
    });

  } catch (error) {
    console.error('MFA verification setup error:', error);
    return NextResponse.json(
      { error: 'Failed to verify MFA setup' },
      { status: 500 }
    );
  }
}
