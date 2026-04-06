import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearMFAVerificationCookie } from '@/lib/admin-mfa-enforcement';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  return handleLogout(_request);
}

export async function POST(_request: NextRequest) {
  return handleLogout(_request);
}

async function handleLogout(_request: NextRequest) {
  try {
    const cookieStore = cookies();

    // Clear all admin session cookies
    cookieStore.delete('supabase-admin-session');
    cookieStore.delete('supabase-admin-refresh');
    cookieStore.delete('supabase-admin-user');

    // Clear MFA verification cookie
    clearMFAVerificationCookie();

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Admin logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
