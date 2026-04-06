import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTOTP, isValidOTPFormat, isValidBackupCodeFormat, verifyAndConsumeBackupCode } from '@/lib/mfa';
import { decryptData } from '@/lib/encryption';
import { setMFAVerificationCookie } from '@/lib/admin-mfa-enforcement';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { code, isBackupCode = false } = await request.json();
    const cookieStore = cookies();

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      );
    }

    // Get temporary MFA token from cookie
    const tempMfaToken = cookieStore.get('supabase-admin-mfa-temp')?.value;
    if (!tempMfaToken) {
      return NextResponse.json(
        { error: 'MFA session expired. Please login again.' },
        { status: 401 }
      );
    }

    // Decode temporary token
    let tempData;
    try {
      tempData = JSON.parse(Buffer.from(tempMfaToken, 'base64').toString());
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid MFA session. Please login again.' },
        { status: 401 }
      );
    }

    // Check if token is expired (10 minutes)
    if (Date.now() - tempData.timestamp > 10 * 60 * 1000) {
      return NextResponse.json(
        { error: 'MFA session expired. Please login again.' },
        { status: 401 }
      );
    }

    const userId = tempData.userId;

    // Validate code format
    if (isBackupCode) {
      if (!isValidBackupCodeFormat(code)) {
        return NextResponse.json(
          { error: 'Invalid backup code format' },
          { status: 400 }
        );
      }
    } else {
      if (!isValidOTPFormat(code)) {
        return NextResponse.json(
          { error: 'Invalid code format. Please enter a 6-digit code.' },
          { status: 400 }
        );
      }
    }

    // Get MFA data for the user
    const { data: mfaData, error: mfaError } = await supabaseAdmin
      .from('admin_mfa')
      .select('mfa_enabled, mfa_secret, mfa_backup_codes')
      .eq('user_id', userId)
      .single();

    if (mfaError) {
      console.error('Error fetching MFA data:', mfaError);
      return NextResponse.json(
        { error: 'MFA data not found' },
        { status: 404 }
      );
    }

    if (!mfaData.mfa_enabled) {
      return NextResponse.json(
        { error: 'MFA is not enabled for this account' },
        { status: 400 }
      );
    }

    let isValid = false;
    let updatedBackupCodes = mfaData.mfa_backup_codes;

    if (isBackupCode) {
      // Verify backup code
      if (!mfaData.mfa_backup_codes || mfaData.mfa_backup_codes.length === 0) {
        return NextResponse.json(
          { error: 'No backup codes available' },
          { status: 400 }
        );
      }

      const result = await verifyAndConsumeBackupCode(code, mfaData.mfa_backup_codes);
      isValid = result.isValid;
      updatedBackupCodes = result.remainingCodes;
    } else {
      // Verify TOTP code
      if (!mfaData.mfa_secret) {
        return NextResponse.json(
          { error: 'MFA secret not found' },
          { status: 500 }
        );
      }

      const secret = await decryptData(mfaData.mfa_secret);
      isValid = verifyTOTP(code, secret);
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Update MFA data
    const updateData: any = {
      mfa_last_used_at: new Date().toISOString(),
    };

    if (isBackupCode) {
      updateData.mfa_backup_codes = updatedBackupCodes;
    }

    const { error: updateError } = await supabaseAdmin
      .from('admin_mfa')
      .update(updateData)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating MFA data:', updateError);
      return NextResponse.json(
        { error: 'Failed to update MFA data' },
        { status: 500 }
      );
    }

    // Get user data for session creation
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !user) {
      console.error('Error fetching user data:', userError);
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    // Create session token (reuse the existing session creation logic)
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!,
    });

    if (sessionError || !sessionData) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Set session cookies using the stored session token
    const sessionToken = tempData.sessionToken;

    if (sessionToken) {
      cookieStore.set('supabase-admin-session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 3600, // 1 hour
        path: '/',
      });
    }

    // Note: We don't have refresh token from the temp data, but that's okay
    // The session will expire in 1 hour and user will need to re-authenticate

    // Set user info cookie
    cookieStore.set('supabase-admin-user', JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email,
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600,
      path: '/',
    });

    // Set MFA verification cookie for server-side enforcement
    setMFAVerificationCookie();

    // Clear temporary MFA token
    cookieStore.delete('supabase-admin-mfa-temp');

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email,
      },
      backupCodesRemaining: updatedBackupCodes?.length || 0,
    });

  } catch (error) {
    console.error('MFA verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify MFA' },
      { status: 500 }
    );
  }
}
