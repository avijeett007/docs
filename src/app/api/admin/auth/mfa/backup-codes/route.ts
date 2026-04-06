import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateBackupCodes, encryptBackupCodes } from '@/lib/mfa';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  try {
    const { password } = await _request.json();

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to regenerate backup codes' },
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

    if (mfaError) {
      console.error('Error checking MFA status:', mfaError);
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

    // Generate new backup codes
    const backupCodes = generateBackupCodes();
    const encryptedBackupCodes = await encryptBackupCodes(backupCodes);

    // Update backup codes in database
    const { error: updateError } = await supabaseAdmin
      .from('admin_mfa')
      .update({
        mfa_backup_codes: encryptedBackupCodes,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating backup codes:', updateError);
      return NextResponse.json(
        { error: 'Failed to generate new backup codes' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      backupCodes,
      message: 'New backup codes have been generated. Please save them in a secure location.',
    });

  } catch (error) {
    console.error('Backup codes generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate backup codes' },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
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

    // Get backup codes count
    const { data: mfaData, error: mfaError } = await supabaseAdmin
      .from('admin_mfa')
      .select('mfa_backup_codes')
      .eq('user_id', user.id)
      .single();

    if (mfaError && mfaError.code !== 'PGRST116') {
      console.error('Error fetching backup codes:', mfaError);
      return NextResponse.json(
        { error: 'Failed to fetch backup codes count' },
        { status: 500 }
      );
    }

    const backupCodesCount = mfaData?.mfa_backup_codes?.length || 0;

    return NextResponse.json({
      backupCodesCount,
    });

  } catch (error) {
    console.error('Backup codes count error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch backup codes count' },
      { status: 500 }
    );
  }
}
