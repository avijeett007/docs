import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateTOTPSecret, generateQRCode, generateBackupCodes, encryptBackupCodes } from '@/lib/mfa';
import { encryptData } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
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

    // Check if MFA is already enabled
    const { data: existingMFA, error: mfaError } = await supabaseAdmin
      .from('admin_mfa')
      .select('mfa_enabled')
      .eq('user_id', user.id)
      .single();

    if (mfaError && mfaError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking MFA status:', mfaError);
      return NextResponse.json(
        { error: 'Failed to check MFA status' },
        { status: 500 }
      );
    }

    if (existingMFA?.mfa_enabled) {
      return NextResponse.json(
        { error: 'MFA is already enabled' },
        { status: 400 }
      );
    }

    // Generate TOTP secret
    const secret = generateTOTPSecret();
    
    // Generate QR code for the secret
    const qrCodeUrl = await generateQRCode(
      secret, 
      user.email || 'admin@knotie-ai.pro', 
      'Knotie AI Pro - Mission Control'
    );

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const encryptedBackupCodes = await encryptBackupCodes(backupCodes);

    // Encrypt the secret for storage
    const encryptedSecret = await encryptData(secret);

    // Store the setup data (MFA not enabled yet, will be enabled after verification)
    const { error: insertError } = await supabaseAdmin
      .from('admin_mfa')
      .upsert({
        user_id: user.id,
        mfa_enabled: false,
        mfa_secret: encryptedSecret,
        mfa_backup_codes: encryptedBackupCodes,
      });

    if (insertError) {
      console.error('Error storing MFA setup data:', insertError);
      return NextResponse.json(
        { error: 'Failed to setup MFA' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      secret,
      qrCodeUrl,
      backupCodes,
      manualEntryKey: secret,
      issuer: 'Knotie AI Pro - Mission Control',
      accountName: user.email || 'admin@knotie-ai.pro',
    });

  } catch (error) {
    console.error('MFA setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup MFA' },
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

    // Get admin MFA status
    const { data: mfaData, error: mfaError } = await supabaseAdmin
      .from('admin_mfa')
      .select('mfa_enabled, mfa_last_used_at')
      .eq('user_id', user.id)
      .single();

    if (mfaError && mfaError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching MFA status:', mfaError);
      return NextResponse.json(
        { error: 'Failed to fetch MFA status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      mfaEnabled: mfaData?.mfa_enabled || false,
      mfaLastUsedAt: mfaData?.mfa_last_used_at || null,
    });

  } catch (error) {
    console.error('MFA status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch MFA status' },
      { status: 500 }
    );
  }
}
