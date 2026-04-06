import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Comprehensive list of reserved subdomains
const RESERVED_SUBDOMAINS = [
  // Core system subdomains
  'api', 'admin', 'www', 'app', 'mail', 'smtp', 'pop', 'imap', 'ftp', 
  'test', 'testing', 'dev', 'development', 'staging', 'prod', 'production',
  
  // Business/marketing related
  'crm', 'customers', 'marketing', 'email', 'accounts', 'billing', 'support', 
  'help', 'docs', 'blog', 'news', 'sales', 'leads',
  
  // Technical infrastructure
  'analytics', 'webhooks', 'connecthub', 'vault', 'ops', 'automate', 
  'monitoring', 'logs', 'metrics', 'status', 'health', 'ping',
  
  // Knotie-specific
  'knolabs', 'knotie', 'kno2gether', 'knotieai', 'knotie-ai',
  
  // Time/scheduling related
  'timesheet', 'times', 'calendar', 'schedule', 'booking', 'appointments',
  
  // Email services
  'clkmail', 'sendgrid', 'mailgun', 'postmark', 'ses', 'smtp-relay',
  
  // Third-party integrations
  'freshrss', 'logto', 'logto-admin', 'ntfy', 'stripe', 'paypal', 
  'twilio', 'retell', 'vapi', 'elevenlabs', 'ultravox',
  
  // Generic reserved
  'custom', 'customs', 'settings', 'config', 'dashboard', 'portal', 
  'login', 'signup', 'register', 'auth', 'oauth', 'sso',
  
  // Security and compliance
  'security', 'privacy', 'terms', 'legal', 'compliance', 'gdpr',
  
  // Common variations
  'demo', 'sandbox', 'preview', 'beta', 'alpha', 'v1', 'v2', 'v3',
  
  // Infrastructure services
  'cdn', 'static', 'assets', 'media', 'uploads', 'files', 'storage',
  
  // Monitoring and observability
  'grafana', 'prometheus', 'kibana', 'elasticsearch', 'redis', 'postgres',
  
  // Common business terms
  'invoice', 'invoices', 'payments', 'subscriptions', 'plans', 'pricing'
];

interface SubdomainCheckResponse {
  available: boolean;
  reason: 'available' | 'reserved' | 'taken' | 'invalid';
  message: string;
  suggestions?: string[];
}

// Generate random number suffix for suggestions
function generateRandomSuffix(): string {
  return Math.floor(Math.random() * 900 + 100).toString(); // 3-digit number
}

// Generate suggestions for taken subdomains
async function generateSuggestions(baseSubdomain: string, excludePartnerId?: string): Promise<string[]> {
  const suggestions: string[] = [];
  const maxAttempts = 10;
  let attempts = 0;

  while (suggestions.length < 3 && attempts < maxAttempts) {
    const suffix = generateRandomSuffix();
    const suggestion = `${baseSubdomain}${suffix}`;
    
    // Check if this suggestion is available
    const isReserved = RESERVED_SUBDOMAINS.includes(suggestion.toLowerCase());
    if (isReserved) {
      attempts++;
      continue;
    }

    const existingPartner = await prisma.partner.findFirst({
      where: {
        subdomain: suggestion,
        ...(excludePartnerId && { id: { not: excludePartnerId } })
      }
    });

    if (!existingPartner) {
      suggestions.push(suggestion);
    }
    
    attempts++;
  }

  return suggestions;
}

export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = authResult.partner.id;
    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get('subdomain');

    if (!subdomain) {
      return NextResponse.json(
        { error: 'Subdomain parameter is required' },
        { status: 400 }
      );
    }

    // Validate subdomain format
    const subdomainLower = subdomain.toLowerCase().trim();
    
    if (!/^[a-z0-9-]+$/.test(subdomainLower)) {
      return NextResponse.json({
        available: false,
        reason: 'invalid',
        message: 'Subdomain must contain only letters, numbers, and hyphens'
      } as SubdomainCheckResponse);
    }

    if (subdomainLower.length < 3 || subdomainLower.length > 30) {
      return NextResponse.json({
        available: false,
        reason: 'invalid',
        message: 'Subdomain must be between 3 and 30 characters'
      } as SubdomainCheckResponse);
    }

    // Check if subdomain is reserved
    if (RESERVED_SUBDOMAINS.includes(subdomainLower)) {
      return NextResponse.json({
        available: false,
        reason: 'reserved',
        message: 'This subdomain is reserved for system use. Please choose a different subdomain.'
      } as SubdomainCheckResponse);
    }

    // Check if subdomain is already taken by another partner
    const existingPartner = await prisma.partner.findFirst({
      where: {
        subdomain: subdomainLower,
        id: { not: partnerId } // Exclude current partner
      }
    });

    if (existingPartner) {
      // Generate suggestions for taken subdomains
      const suggestions = await generateSuggestions(subdomainLower, partnerId);
      
      return NextResponse.json({
        available: false,
        reason: 'taken',
        message: 'This subdomain is already taken. Here are some available alternatives:',
        suggestions
      } as SubdomainCheckResponse);
    }

    // Subdomain is available
    return NextResponse.json({
      available: true,
      reason: 'available',
      message: 'This subdomain is available!'
    } as SubdomainCheckResponse);

  } catch (error) {
    console.error('Error checking subdomain availability:', error);
    return NextResponse.json(
      { error: 'Failed to check subdomain availability' },
      { status: 500 }
    );
  }
}
