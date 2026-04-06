import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parse as parseCookies } from 'cookie';
import { TIER_CONFIGURATIONS, TierLimits, MarketingTier } from '@/lib/services/tierValidationService';
import { logger } from '@/lib/logger';
import { obfuscateId } from '@/lib/pii-obfuscation';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase configuration error for admin tier configuration auth', undefined, {
        operation: 'admin_tier_config_verify_auth'
      });
      return null;
    }
    
    // Extract cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';

    // Parse cookies using secure cookie parser
    const cookies = parseCookies(cookieHeader);
    
    // Check for our custom admin session token
    const adminSessionToken = cookies['supabase-admin-session'];
    
    if (!adminSessionToken) {
      logger.warn('Admin authentication failed due to missing admin session token', {
        operation: 'admin_tier_config_verify_auth'
      });
      return null;
    }
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify the token by setting it and getting the user
    const { data: { user }, error } = await supabase.auth.getUser(adminSessionToken);
    
    if (error) {
      logger.warn('Admin authentication error while validating session token', {
        operation: 'admin_tier_config_verify_auth',
      });
      return null;
    }
    
    if (!user) {
      logger.warn('Admin authentication failed due to invalid session token', {
        operation: 'admin_tier_config_verify_auth'
      });
      return null;
    }

    logger.info('Admin authentication succeeded for tier configuration API', {
      operation: 'admin_tier_config_verify_auth',
      adminUserId: obfuscateId(user.id)
    });
    return user;
  } catch (error) {
    logger.error('Admin authentication exception in tier configuration API', error as Error, {
      operation: 'admin_tier_config_verify_auth'
    });
    return null;
  }
}

const TIER_DISPLAY_NAMES: Record<MarketingTier, string> = {
  marketing_offer: 'Marketing Offer',
  free_forever: 'Free Forever',
  free_forever_trial: 'Free Forever Trial',
  starter: 'Starter',
  starter_special: 'Starter Special',
  starter_tier_trial: 'Starter Tier Trial',
  pro: 'Pro',
  ultimate: 'Ultimate',
  unlimited: 'Unlimited'
};

// GET /api/admin/tier-configurations - Get current tier configurations
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Convert TIER_CONFIGURATIONS to the format expected by the UI
    const configurations = Object.entries(TIER_CONFIGURATIONS).map(([tier, limits]) => ({
      tier,
      displayName: TIER_DISPLAY_NAMES[tier as MarketingTier] || tier,
      limits,
      isMarketing: tier === 'marketing_offer'
    }));

    return NextResponse.json({
      success: true,
      configurations
    });

  } catch (error) {
    logger.error('Error fetching admin tier configurations', error as Error, {
      operation: 'admin_tier_config_get'
    });
    return NextResponse.json(
      { error: 'Failed to fetch tier configurations' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/tier-configurations - Update tier configurations
export async function PUT(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { configurations } = body;

    if (!configurations || !Array.isArray(configurations)) {
      return NextResponse.json(
        { error: 'Invalid configurations data' },
        { status: 400 }
      );
    }

    // Validate and update configurations
    const updatedConfigurations: Record<MarketingTier, TierLimits> = {} as any;

    for (const config of configurations) {
      const { tier, limits } = config;
      
      if (!tier || !limits) {
        return NextResponse.json(
          { error: 'Invalid configuration format' },
          { status: 400 }
        );
      }

      // Validate tier name
      if (!Object.keys(TIER_CONFIGURATIONS).includes(tier)) {
        return NextResponse.json(
          { error: `Invalid tier: ${tier}` },
          { status: 400 }
        );
      }

      // Validate limits structure
      const requiredFields = [
        'maxCustomers', 'maxVapiAgents', 'maxRetellAgents', 
        'maxUltravoxAgents', 'maxElevenlabsAgents', 'maxGhlAgents', 
        'maxKnovaAgents', 'maxNumberPools', 'saasMode'
      ];

      for (const field of requiredFields) {
        if (!(field in limits)) {
          return NextResponse.json(
            { error: `Missing field: ${field} in tier ${tier}` },
            { status: 400 }
          );
        }
      }

      // Validate numeric fields (can be null for unlimited)
      const numericFields = requiredFields.filter(f => f !== 'saasMode');
      for (const field of numericFields) {
        const value = limits[field];
        if (value !== null && (typeof value !== 'number' || value < 0)) {
          return NextResponse.json(
            { error: `Invalid value for ${field} in tier ${tier}` },
            { status: 400 }
          );
        }
      }

      // Validate saasMode
      if (typeof limits.saasMode !== 'boolean') {
        return NextResponse.json(
          { error: `Invalid saasMode value in tier ${tier}` },
          { status: 400 }
        );
      }

      updatedConfigurations[tier as MarketingTier] = limits;
    }

    // TODO: In a real implementation, you would save these to a database
    // For now, we'll just return success since the configurations are in-memory
    // You could extend this to save to a configuration table in the database

    // Log admin action without sensitive configuration data
    logger.info('Admin updated tier configurations', {
      operation: 'admin_tier_config_update',
      adminUserId: obfuscateId(adminUser.id),
      updatedTierCount: Object.keys(updatedConfigurations).length
    });

    return NextResponse.json({
      success: true,
      message: 'Tier configurations updated successfully',
      configurations: Object.entries(updatedConfigurations).map(([tier, limits]) => ({
        tier,
        displayName: TIER_DISPLAY_NAMES[tier as MarketingTier] || tier,
        limits,
        isMarketing: tier === 'marketing_offer'
      }))
    });

  } catch (error) {
    logger.error('Error updating admin tier configurations', error as Error, {
      operation: 'admin_tier_config_update'
    });
    return NextResponse.json(
      { error: 'Failed to update tier configurations' },
      { status: 500 }
    );
  }
}
