import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { sendCampaignEmail, generateEmailWithAI, CampaignEmailData, Recipient } from '@/lib/emailCampaigns';

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration error');
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
    
    // Check for our custom admin session token
    const adminSessionToken = cookies['supabase-admin-session'];
    
    if (!adminSessionToken) {
      console.log('Authentication failed: missing token');
      return null;
    }
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify the token by setting it and getting the user
    const { data: { user }, error } = await supabase.auth.getUser(adminSessionToken);
    
    if (error) {
      console.error('Authentication error');
      return null;
    }
    
    if (!user) {
      console.log('Authentication failed: invalid token');
      return null;
    }
    
    console.log('Admin authentication successful');
    return user;
  } catch (error) {
    console.error('Authentication exception');
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      console.log('Email campaigns API: Authentication failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Email campaigns API: Authentication successful');

    // Parse request body
    const data = await request.json();
    
    // Validate required fields
    if (!data.recipients || !Array.isArray(data.recipients) || data.recipients.length === 0) {
      return NextResponse.json({ error: 'Recipients are required' }, { status: 400 });
    }
    
    if (!data.subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }
    
    if (!data.templateType) {
      return NextResponse.json({ error: 'Template type is required' }, { status: 400 });
    }
    
    // For custom template type, either customHtml or htmlContent is required
    if (data.templateType === 'custom' && !data.customHtml && !data.htmlContent) {
      return NextResponse.json({ error: 'HTML content is required for custom template' }, { status: 400 });
    }
    
    // Prepare the campaign email data
    const campaignData: CampaignEmailData = {
      recipients: data.recipients as Recipient[],
      subject: data.subject,
      templateType: data.templateType,
      customHtml: data.customHtml,
      htmlContent: data.htmlContent,
      productUpdatesData: data.productUpdatesData,
      specialEventsData: data.specialEventsData
    };
    
    console.log('Sending campaign with data:', {
      recipientCount: campaignData.recipients.length,
      subject: campaignData.subject,
      templateType: campaignData.templateType,
      hasHtmlContent: !!campaignData.htmlContent,
      hasCustomHtml: !!campaignData.customHtml
    });
    
    // Send the campaign email
    const result = await sendCampaignEmail(campaignData);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error sending campaign email:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while sending the campaign email' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const data = await request.json();
    
    // Validate required fields
    if (!data.prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }
    
    if (!data.templateType) {
      return NextResponse.json({ error: 'Template type is required' }, { status: 400 });
    }
    
    // Generate email content with AI
    const generatedContent = await generateEmailWithAI(data.prompt, data.templateType);
    
    return NextResponse.json({ content: generatedContent });
  } catch (error: any) {
    console.error('Error generating email with AI:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while generating email content' },
      { status: 500 }
    );
  }
}
