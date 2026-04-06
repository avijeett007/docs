import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { sendEmail } from '@/lib/email';
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

// Helper function to process HTML content with recipient data
function processHtmlContent(html: string, recipient: any) {
  let processedHtml = html;
  
  // Replace template variables with actual values
  processedHtml = processedHtml.replace(/\{\{([^}]+)\}\}/g, (match: string, variable: string) => {
    // Trim whitespace from variable name
    const trimmedVariable = variable.trim();
    
    // Handle different variable types
    if (trimmedVariable === 'name') {
      return recipient.name || '';
    } else if (trimmedVariable === 'email') {
      return recipient.email;
    } else if (trimmedVariable === 'businessName') {
      return recipient.businessName || recipient.name || '';
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
  if (recipient.name) {
    processedHtml = processedHtml.replace(/\[Name\]/g, recipient.name);
  }
  
  return processedHtml;
}

// POST - Send bulk emails
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

    // Parse request body
    const body = await request.json();
    const {
      subject,
      htmlContent,
      recipientType,
      campaignName,
      testMode,
      // New advanced targeting options
      targetType,
      limit,
      customLimit
    } = body;

    // Validate required fields
    if (!subject || !htmlContent) {
      return NextResponse.json(
        { error: 'Missing required fields: subject, htmlContent' },
        { status: 400 }
      );
    }

    // Determine targeting method - use new advanced targeting if available, fallback to legacy
    let recipients: any[] = [];

    if (targetType) {
      // Use new advanced targeting system
      switch (targetType) {
        case 'all_partners':
          const allPartners = await prisma.partner.findMany({
            select: {
              id: true,
              businessName: true,
              emailAddress: true,
              approvalStatus: true,
            },
            orderBy: {
              businessName: 'asc',
            },
          });

          recipients = allPartners.map((partner) => ({
            id: partner.id,
            name: partner.businessName,
            email: partner.emailAddress,
            type: 'partner',
            businessName: partner.businessName,
            approvalStatus: partner.approvalStatus
          }));
          break;

        case 'active_partners':
          const activePartners = await prisma.partner.findMany({
            select: {
              id: true,
              businessName: true,
              emailAddress: true,
              approvalStatus: true,
            },
            where: {
              approvalStatus: 'ACTIVE'
            },
            orderBy: {
              businessName: 'asc',
            },
          });

          recipients = activePartners.map((partner) => ({
            id: partner.id,
            name: partner.businessName,
            email: partner.emailAddress,
            type: 'partner',
            businessName: partner.businessName,
            approvalStatus: partner.approvalStatus
          }));
          break;

        case 'all_waitlist':
          const allWaitlist = await prisma.waitlist.findMany({
            select: {
              id: true,
              name: true,
              email: true,
            },
            orderBy: {
              name: 'asc',
            },
          });

          recipients = allWaitlist.map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            type: 'waitlist'
          }));
          break;

        case 'limited_partners':
          const limitedPartners = await prisma.partner.findMany({
            select: {
              id: true,
              businessName: true,
              emailAddress: true,
              approvalStatus: true,
            },
            where: {
              approvalStatus: 'ACTIVE'
            },
            orderBy: {
              businessName: 'asc',
            },
            take: limit || 10,
          });

          recipients = limitedPartners.map((partner) => ({
            id: partner.id,
            name: partner.businessName,
            email: partner.emailAddress,
            type: 'partner',
            businessName: partner.businessName,
            approvalStatus: partner.approvalStatus
          }));
          break;

        case 'limited_waitlist':
          const limitedWaitlist = await prisma.waitlist.findMany({
            select: {
              id: true,
              name: true,
              email: true,
            },
            orderBy: {
              name: 'asc',
            },
            take: limit || 10,
          });

          recipients = limitedWaitlist.map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            type: 'waitlist'
          }));
          break;

        case 'custom_waitlist':
          const customWaitlist = await prisma.waitlist.findMany({
            select: {
              id: true,
              name: true,
              email: true,
            },
            orderBy: {
              name: 'asc',
            },
            take: customLimit || 10,
          });

          recipients = customWaitlist.map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            type: 'waitlist'
          }));
          break;

        case 'everyone':
          const everyonePartners = await prisma.partner.findMany({
            select: {
              id: true,
              businessName: true,
              emailAddress: true,
              approvalStatus: true,
            },
            where: {
              approvalStatus: 'ACTIVE'
            },
            orderBy: {
              businessName: 'asc',
            },
          });

          const everyoneWaitlist = await prisma.waitlist.findMany({
            select: {
              id: true,
              name: true,
              email: true,
            },
            orderBy: {
              name: 'asc',
            },
          });

          recipients = [
            ...everyonePartners.map((partner) => ({
              id: partner.id,
              name: partner.businessName,
              email: partner.emailAddress,
              type: 'partner',
              businessName: partner.businessName,
              approvalStatus: partner.approvalStatus
            })),
            ...everyoneWaitlist.map((member) => ({
              id: member.id,
              name: member.name,
              email: member.email,
              type: 'waitlist'
            }))
          ];
          break;

        default:
          return NextResponse.json(
            { error: 'Invalid target type' },
            { status: 400 }
          );
      }
    } else {
      // Legacy targeting system for backward compatibility
      if (!recipientType) {
        return NextResponse.json(
          { error: 'Missing recipientType or targetType' },
          { status: 400 }
        );
      }

      if (recipientType === 'partner' || recipientType === 'all') {
        const partners = await prisma.partner.findMany({
          select: {
            id: true,
            businessName: true,
            emailAddress: true,
          },
          where: {
            approvalStatus: 'ACTIVE'
          },
          orderBy: {
            businessName: 'asc',
          },
        });

        const partnerRecipients = partners.map((partner) => ({
          id: partner.id,
          name: partner.businessName,
          email: partner.emailAddress,
          type: 'partner',
          businessName: partner.businessName
        }));

        recipients = [...recipients, ...partnerRecipients];
      }

      if (recipientType === 'waitlist' || recipientType === 'all') {
        const waitlistMembers = await prisma.waitlist.findMany({
          select: {
            id: true,
            name: true,
            email: true,
          },
          orderBy: {
            name: 'asc',
          },
        });

        const waitlistRecipients = waitlistMembers.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          type: 'waitlist'
        }));

        recipients = [...recipients, ...waitlistRecipients];
      }
    }

    // Create a campaign record
    const campaign = await prisma.emailCampaign.create({
      data: {
        name: campaignName || `Campaign ${new Date().toISOString()}`,
        subject,
        htmlContent,
        recipientType: targetType || recipientType || 'active_partners',
        targetCount: recipients.length,
        status: testMode ? 'test' : 'sending',
        description: targetType ? `Advanced targeting: ${targetType}${limit ? ` (limit: ${limit})` : ''}${customLimit ? ` (custom: ${customLimit})` : ''}` : undefined
      }
    });

    // If in test mode, only send to the first recipient
    if (testMode) {
      if (recipients.length > 0) {
        const testRecipient = recipients[0];
        const processedHtml = processHtmlContent(htmlContent, testRecipient);
        
        await sendEmail({
          to: testRecipient.email,
          subject,
          html: processedHtml,
          fromName: "Knotie-AI Admin",
        });
        
        // Update campaign
        await prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: {
            sentCount: 1,
            status: 'completed',
            sentAt: new Date()
          }
        });
        
        return NextResponse.json({ 
          success: true, 
          message: `Test email sent to ${testRecipient.name} (${testRecipient.email})`,
          campaign
        });
      } else {
        return NextResponse.json(
          { error: 'No recipients found for test email' },
          { status: 400 }
        );
      }
    }

    // Send emails to all recipients in batches to avoid timeouts
    const batchSize = 10; // Increased batch size for better performance
    let successCount = 0;
    let totalProcessed = 0;

    // Process all recipients in batches
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      // Process current batch
      for (const recipient of batch) {
        try {
          const processedHtml = processHtmlContent(htmlContent, recipient);

          await sendEmail({
            to: recipient.email,
            subject,
            html: processedHtml,
            fromName: "Knotie-AI Admin",
          });

          successCount++;
        } catch (error) {
          console.error(`Error sending email to ${recipient.email}:`, error);
        }
        totalProcessed++;
      }

      // Add a small delay between batches to avoid overwhelming the email service
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    // Update campaign with initial batch results
    await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        sentCount: successCount,
        status: successCount === recipients.length ? 'completed' : 'sending',
        sentAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: `Campaign sent to ${recipients.length} recipients. Successfully sent ${successCount} emails.`,
      campaign,
      totalRecipients: recipients.length,
      successCount,
      failedCount: recipients.length - successCount
    });
  } catch (error) {
    console.error('Error sending bulk emails:', error);
    return NextResponse.json(
      { error: 'Failed to send bulk emails', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
