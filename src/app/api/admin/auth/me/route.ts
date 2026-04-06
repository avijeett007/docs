import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { enforceAdminMFA } from '@/lib/admin-mfa-enforcement';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Use server-side MFA enforcement
    const mfaResult = await enforceAdminMFA(request);

    if (!mfaResult.success) {
      const cookieStore = cookies();

      if (mfaResult.mfaRequired) {
        // MFA verification required
        return NextResponse.json(
          {
            error: mfaResult.error,
            mfaRequired: true,
            user: mfaResult.user
          },
          { status: 403 }
        );
      }

      // Invalid session - clear cookies
      if (mfaResult.error === 'Invalid session' || mfaResult.error === 'Not authenticated') {
        cookieStore.delete('supabase-admin-session');
        cookieStore.delete('supabase-admin-refresh');
        cookieStore.delete('supabase-admin-user');
        cookieStore.delete('supabase-admin-mfa-verified');
      }

      return NextResponse.json(
        { error: mfaResult.error },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: mfaResult.user
    });

  } catch (error) {
    console.error('Admin auth check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
