import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only environment variables
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

// GET - Fetch a specific email template
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Fetch the template
    const template = await prisma.emailTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Email template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error fetching email template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email template' },
      { status: 500 }
    );
  }
}

// PUT - Update a specific email template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { name, description, subject, htmlContent, category, isActive } = body;

    // Validate required fields
    if (!name || !subject || !htmlContent) {
      return NextResponse.json(
        { error: 'Missing required fields: name, subject, or htmlContent' },
        { status: 400 }
      );
    }

    // Check if the template exists
    const existingTemplate = await prisma.emailTemplate.findUnique({
      where: { id }
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Email template not found' },
        { status: 404 }
      );
    }

    // Update the template
    const updatedTemplate = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name,
        description,
        subject,
        htmlContent,
        category: category || existingTemplate.category,
        isActive: isActive !== undefined ? isActive : existingTemplate.isActive
      }
    });

    return NextResponse.json({ template: updatedTemplate });
  } catch (error) {
    console.error('Error updating email template:', error);
    return NextResponse.json(
      { error: 'Failed to update email template' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific email template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Check if the template exists
    const existingTemplate = await prisma.emailTemplate.findUnique({
      where: { id }
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Email template not found' },
        { status: 404 }
      );
    }

    // Delete the template
    await prisma.emailTemplate.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting email template:', error);
    return NextResponse.json(
      { error: 'Failed to delete email template' },
      { status: 500 }
    );
  }
}
