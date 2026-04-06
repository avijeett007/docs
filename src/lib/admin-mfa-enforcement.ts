import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { logger } from './logger';

/**
 * Server-only MFA enforcement check
 * Uses server-only environment variable for security
 */
function isAdminMFAEnforced(): boolean {
  return process.env.FEATURE_ADMIN_MFA_ENFORCED === 'true';
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

export interface MFAEnforcementResult {
  success: boolean;
  user?: AdminUser;
  error?: string;
  mfaRequired?: boolean;
  redirectToMFA?: boolean;
}

/**
 * Server-side MFA enforcement for Mission Control
 * This function should be called by all protected Mission Control routes
 */
export async function enforceAdminMFA(_request?: NextRequest): Promise<MFAEnforcementResult> {
  try {
    const cookieStore = cookies();
    
    // Get session token from cookie
    const sessionToken = cookieStore.get('supabase-admin-session')?.value;
    const mfaVerifiedCookie = cookieStore.get('supabase-admin-mfa-verified')?.value;
    
    if (!sessionToken) {
      return {
        success: false,
        error: 'Not authenticated'
      };
    }

    // SECURITY: Use server-side only environment variables for admin operations
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error('Supabase admin configuration error', new Error('Missing Supabase configuration'), {
        operation: 'admin_mfa_enforcement'
      });
      return {
        success: false,
        error: 'Server configuration error'
      };
    }

    // Create admin Supabase client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    // Verify the session token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(sessionToken);

    if (error || !user) {
      logger.error('Invalid admin session', error as Error, {
        operation: 'admin_mfa_enforcement'
      });
      return {
        success: false,
        error: 'Invalid session'
      };
    }

    const adminUser: AdminUser = {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email || '',
    };

    // Check if MFA is enforced (server-only security check)
    const mfaEnforced = isAdminMFAEnforced();
    
    if (!mfaEnforced) {
      // MFA not enforced, allow access
      return {
        success: true,
        user: adminUser
      };
    }

    // MFA is enforced - check if user has MFA enabled
    const { data: mfaData, error: mfaError } = await supabaseAdmin
      .from('admin_mfa')
      .select('mfa_enabled, mfa_last_used_at')
      .eq('user_id', user.id)
      .single();

    if (mfaError && mfaError.code !== 'PGRST116') {
      logger.error('MFA check error', mfaError as Error, {
        operation: 'admin_mfa_enforcement'
      });
      // Allow access on database error to prevent lockout
      return {
        success: true,
        user: adminUser
      };
    }

    if (!mfaData || !mfaData.mfa_enabled) {
      // User doesn't have MFA enabled, allow access
      return {
        success: true,
        user: adminUser
      };
    }

    // User has MFA enabled and MFA is enforced
    // Check if MFA has been verified for this session
    if (!mfaVerifiedCookie || mfaVerifiedCookie !== 'true') {
      logger.info('MFA verification required for user', {
        operation: 'admin_mfa_enforcement',
        userEmail: user.email
      });
      return {
        success: false,
        error: 'MFA verification required',
        mfaRequired: true,
        redirectToMFA: true,
        user: adminUser
      };
    }

    // MFA verified, allow access
    logger.info('MFA enforcement access granted for user', {
      operation: 'admin_mfa_enforcement',
      userEmail: user.email
    });
    return {
      success: true,
      user: adminUser
    };

  } catch (error) {
    logger.error('MFA enforcement error', error as Error, {
      operation: 'admin_mfa_enforcement'
    });
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Set MFA verification cookie after successful MFA verification
 */
export function setMFAVerificationCookie(): void {
  const cookieStore = cookies();
  
  // Set MFA verified cookie with same expiration as session (1 hour)
  cookieStore.set('supabase-admin-mfa-verified', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour
    path: '/'
  });
}

/**
 * Clear MFA verification cookie on logout
 */
export function clearMFAVerificationCookie(): void {
  const cookieStore = cookies();
  cookieStore.delete('supabase-admin-mfa-verified');
}
