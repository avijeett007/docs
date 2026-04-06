import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { sendEmail } from '@/lib/email';
import { createClient } from '@supabase/supabase-js';

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase URL or Key is missing');
      return null;
    }

    // Extract cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';
    console.log('Cookie header:', cookieHeader);

    // Parse cookies to find our custom admin session cookie
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    // Check for our custom admin session token
    const adminSessionToken = cookies['supabase-admin-session'];

    if (!adminSessionToken) {
      console.log('No admin session token found in cookies');
      return null;
    }

    console.log('Admin session token found, verifying...');

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the token by setting it and getting the user
    const { data: { user }, error } = await supabase.auth.getUser(adminSessionToken);

    if (error) {
      console.error('Error verifying admin token:', error.message);
      return null;
    }

    if (!user) {
      console.log('No user found for the provided token');
      return null;
    }

    console.log('Admin user authenticated successfully:', user.email);
    return user;
  } catch (error) {
    console.error('Exception in verifyAdminAuth:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await request.json();
    const { to, subject, html, recipientName, recipientType } = body;

    // Validate required fields
    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, or html' },
        { status: 400 }
      );
    }

    // Process HTML content to replace template variables
    let processedHtml = html;

    // Replace template variables with actual values
    processedHtml = processedHtml.replace(/\{\{([^}]+)\}\}/g, (match: string, variable: string) => {
      // Trim whitespace from variable name
      const trimmedVariable = variable.trim();

      // Handle different variable types
      if (trimmedVariable === 'name') {
        return recipientName || '';
      } else if (trimmedVariable === 'email') {
        return to;
      } else if (trimmedVariable === 'businessName') {
        // Use recipientName as fallback for businessName
        return body.recipientBusinessName || recipientName || '';
      } else if (trimmedVariable === 'unsubscribe') {
        return '#unsubscribe-link';
      } else if (trimmedVariable === 'date') {
        return new Date().toLocaleDateString();
      } else if (trimmedVariable === 'year') {
        return new Date().getFullYear().toString();
      }

      // Return the original match if no replacement is found
      return match;
    });

    // Also handle the [Name] format for backward compatibility
    if (recipientName) {
      processedHtml = processedHtml.replace(/\[Name\]/g, recipientName);
    }

    // Send the email
    const result = await sendEmail({
      to,
      subject,
      html: processedHtml,
      fromName: "Knotie-AI Admin",
    });

    if (!result.success) {
      // Use type narrowing to safely access the error property
      const errorDetails = 'error' in result ? result.error : 'Unknown error';

      return NextResponse.json(
        { error: 'Failed to send email', details: errorDetails },
        { status: 500 }
      );
    }

    // Log the email sent for audit purposes
    console.log(`Admin email sent to ${to} (${recipientType}) with subject: ${subject}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending admin email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to send email', details: errorMessage },
      { status: 500 }
    );
  }
}
