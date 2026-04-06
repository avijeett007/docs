import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

// SECURITY: Use server-side only environment variables for admin operations
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('Supabase admin configuration error: Missing URL or service key', new Error('Missing Supabase configuration'), {
    operation: 'supabase_admin_init',
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey
  });
}

// Create a Supabase client with the service role key
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});
