import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

// Allowed admin email domain and specific admin emails
const ADMIN_EMAIL_DOMAIN = '@knotie-ai.pro';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

/**
 * Check if an email is authorized as an admin
 */
function isAuthorizedAdmin(email: string | undefined): boolean {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase();
  // Allow if email matches the admin domain or is in the explicit admin list
  if (normalizedEmail.endsWith(ADMIN_EMAIL_DOMAIN)) return true;
  if (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(normalizedEmail)) return true;
  return false;
}

/**
 * Verify admin authentication using Supabase cookie-based authentication
 * Validates both session token AND admin email authorization
 */
export async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase configuration error: Missing URL or key', new Error('Missing Supabase configuration'), {
        operation: 'admin_auth'
      });
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

    const adminSessionToken = cookies['supabase-admin-session'];

    if (!adminSessionToken) {
      return null;
    }

    // Create Supabase client with the session token
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${adminSessionToken}`
        }
      }
    });

    // Get the user from the session using the token
    const { data: { user }, error } = await supabase.auth.getUser(adminSessionToken);

    if (error || !user) {
      return null;
    }

    // Validate admin email authorization
    if (!isAuthorizedAdmin(user.email)) {
      logger.error('Unauthorized admin access attempt', new Error('Email not authorized'), {
        operation: 'admin_auth',
        email: user.email,
      });
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
}
