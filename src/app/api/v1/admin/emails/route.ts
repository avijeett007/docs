import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Hash an API key using SHA-256 for lookup
function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// ── API Key Validation (shared pattern with credits route) ──
async function validateApiKey(request: NextRequest, requiredScope: string) {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
  if (!apiKey) return null;

  // Hash the incoming key and look up by hash
  const apiKeyHash = hashApiKey(apiKey);
  const keyRecord = await prisma.adminCreditApiKey.findUnique({ where: { apiKey: apiKeyHash } });
  if (!keyRecord || keyRecord.status !== 'active') return null;

  // Check scope permission
  const scopes = keyRecord.scopes || ['credits'];
  if (!scopes.includes('all') && !scopes.includes(requiredScope)) return null;

  // Check expiry
  if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
    await prisma.adminCreditApiKey.update({ where: { id: keyRecord.id }, data: { status: 'expired' } });
    return null;
  }

  // Daily rate limit check BEFORE incrementing usage
  const now = new Date();
  const shouldReset = keyRecord.lastResetAt.toDateString() !== now.toDateString();

  if (shouldReset) {
    await prisma.adminCreditApiKey.update({
      where: { id: keyRecord.id },
      data: { dailyUsage: 1, lastResetAt: now, usageCount: { increment: 1 }, lastUsedAt: now },
    });
  } else {
    // Check limit BEFORE incrementing to prevent off-by-one
    if (keyRecord.dailyLimit && keyRecord.dailyUsage >= keyRecord.dailyLimit) return null;
    await prisma.adminCreditApiKey.update({
      where: { id: keyRecord.id },
      data: { dailyUsage: { increment: 1 }, usageCount: { increment: 1 }, lastUsedAt: now },
    });
  }

  return keyRecord;
}

// ── Template variable processing ──
function processHtmlContent(html: string, recipient: { name?: string; email: string; businessName?: string }) {
  let processed = html;
  processed = processed.replace(/\{\{([^}]+)\}\}/g, (match: string, variable: string) => {
    const v = variable.trim();
    if (v === 'name') return recipient.name || '';
    if (v === 'email') return recipient.email;
    if (v === 'businessName') return recipient.businessName || recipient.name || '';
    if (v === 'unsubscribe') return '#unsubscribe-link';
    if (v === 'date') return new Date().toLocaleDateString();
    if (v === 'year') return new Date().getFullYear().toString();
    return match;
  });
  if (recipient.name) processed = processed.replace(/\[Name\]/g, recipient.name);
  return processed;
}

// ── Base64 decode helper ──
function decodeBase64Content(encoded: string): string {
  try {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    throw new Error('Invalid Base64 encoded content');
  }
}

// ── Request validation schema ──
const emailCampaignSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  htmlContent: z.string().optional(),
  htmlContentBase64: z.string().optional(),
  campaignName: z.string().optional(),
  targetType: z.enum([
    'all_partners', 'active_partners', 'all_waitlist',
    'limited_partners', 'limited_waitlist', 'custom_waitlist', 'everyone'
  ]).default('active_partners'),
  limit: z.number().int().min(1).max(10000).optional(),
  testMode: z.boolean().default(false),
  testRecipientEmail: z.string().email().optional(),
  metadata: z.record(z.any()).optional(),
}).refine(
  data => data.htmlContent || data.htmlContentBase64,
  { message: 'Either htmlContent or htmlContentBase64 is required' }
);

// ── POST /api/v1/admin/emails — Send email campaign via API key ──
export async function POST(request: NextRequest) {
  try {
    const keyRecord = await validateApiKey(request, 'email');
    if (!keyRecord) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Invalid API key, insufficient scope, or rate limit exceeded.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = emailCampaignSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const {
      subject, htmlContent, htmlContentBase64, campaignName,
      targetType, limit, testMode, testRecipientEmail, metadata,
    } = validation.data;

    const apiKeyName = keyRecord.name;

    // Decode HTML content (prefer Base64, fallback to raw)
    let finalHtml: string;
    try {
      finalHtml = htmlContentBase64 ? decodeBase64Content(htmlContentBase64) : htmlContent!;
    } catch (decodeError) {
      return NextResponse.json(
        { success: false, error: decodeError instanceof Error ? decodeError.message : 'Failed to decode Base64 content' },
        { status: 400 }
      );
    }

    // Validate decoded HTML is not empty
    if (!finalHtml || finalHtml.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Email HTML content cannot be empty' },
        { status: 400 }
      );
    }

    // ── Test mode: send to a single test recipient ──
    if (testMode) {
      if (!testRecipientEmail) {
        return NextResponse.json(
          { success: false, error: 'testRecipientEmail is required when testMode is true' },
          { status: 400 }
        );
      }



      const testRecipient = { name: 'Test Recipient', email: testRecipientEmail, businessName: 'Test' };
      const processedHtml = processHtmlContent(finalHtml, testRecipient);

      // Create campaign record for audit
      const campaign = await prisma.emailCampaign.create({
        data: {
          name: campaignName || `API Test Campaign ${new Date().toISOString()}`,
          subject,
          htmlContent: finalHtml,
          recipientType: `api_test_${targetType}`,
          targetCount: 1,
          status: 'test',
          description: `API test email via key: ${apiKeyName}. Target: ${testRecipientEmail}`,
        },
      });

      await sendEmail({
        to: testRecipientEmail,
        subject,
        html: processedHtml,
        fromName: 'Knotie-AI Admin',
      });

      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { sentCount: 1, status: 'completed', sentAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: `Test email sent to ${testRecipientEmail}`,
        campaign: { id: campaign.id, name: campaign.name, status: 'completed' },
        metadata: { apiKey: apiKeyName, testMode: true },
      });
    }

    // ── Full campaign mode: resolve recipients and send ──
    let recipients: { id: string; name: string; email: string; type: string; businessName?: string }[] = [];

    switch (targetType) {
      case 'all_partners': {
        const partners = await prisma.partner.findMany({
          select: { id: true, businessName: true, emailAddress: true },
          orderBy: { businessName: 'asc' },
        });
        recipients = partners.map(p => ({ id: p.id, name: p.businessName, email: p.emailAddress, type: 'partner', businessName: p.businessName }));
        break;
      }
      case 'active_partners': {
        const partners = await prisma.partner.findMany({
          select: { id: true, businessName: true, emailAddress: true },
          where: { approvalStatus: 'ACTIVE' },
          orderBy: { businessName: 'asc' },
        });
        recipients = partners.map(p => ({ id: p.id, name: p.businessName, email: p.emailAddress, type: 'partner', businessName: p.businessName }));
        break;
      }
      case 'all_waitlist': {
        const members = await prisma.waitlist.findMany({
          select: { id: true, name: true, email: true },
          orderBy: { name: 'asc' },
        });
        recipients = members.map(m => ({ id: m.id, name: m.name, email: m.email, type: 'waitlist' }));
        break;
      }
      case 'limited_partners': {
        const partners = await prisma.partner.findMany({
          select: { id: true, businessName: true, emailAddress: true },
          where: { approvalStatus: 'ACTIVE' },
          orderBy: { businessName: 'asc' },
          take: limit || 10,
        });
        recipients = partners.map(p => ({ id: p.id, name: p.businessName, email: p.emailAddress, type: 'partner', businessName: p.businessName }));
        break;
      }
      case 'limited_waitlist':
      case 'custom_waitlist': {
        const members = await prisma.waitlist.findMany({
          select: { id: true, name: true, email: true },
          orderBy: { name: 'asc' },
          take: limit || 10,
        });
        recipients = members.map(m => ({ id: m.id, name: m.name, email: m.email, type: 'waitlist' }));
        break;
      }
      case 'everyone': {
        const [partners, waitlist] = await Promise.all([
          prisma.partner.findMany({
            select: { id: true, businessName: true, emailAddress: true },
            where: { approvalStatus: 'ACTIVE' },
            orderBy: { businessName: 'asc' },
          }),
          prisma.waitlist.findMany({
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' },
          }),
        ]);
        recipients = [
          ...partners.map(p => ({ id: p.id, name: p.businessName, email: p.emailAddress, type: 'partner', businessName: p.businessName })),
          ...waitlist.map(m => ({ id: m.id, name: m.name, email: m.email, type: 'waitlist' })),
        ];
        break;
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No recipients found for the specified targeting criteria' },
        { status: 404 }
      );
    }

    // Create campaign record
    const campaign = await prisma.emailCampaign.create({
      data: {
        name: campaignName || `API Campaign ${new Date().toISOString()}`,
        subject,
        htmlContent: finalHtml,
        recipientType: `api_${targetType}`,
        targetCount: recipients.length,
        status: 'sending',
        description: `API campaign via key: ${apiKeyName}. Target: ${targetType}${limit ? ` (limit: ${limit})` : ''}`,
      },
    });

    // Send emails in batches
    const batchSize = 10;
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      for (const recipient of batch) {
        try {
          const processedHtml = processHtmlContent(finalHtml, recipient);
          await sendEmail({ to: recipient.email, subject, html: processedHtml, fromName: 'Knotie-AI Admin' });
          successCount++;
        } catch (error) {
          console.error(`API email campaign: failed to send to ${recipient.email}:`, error);
          failedCount++;
        }
      }
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        sentCount: successCount,
        status: successCount === recipients.length ? 'completed' : 'partial',
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Campaign sent to ${recipients.length} recipients. ${successCount} succeeded, ${failedCount} failed.`,
      campaign: { id: campaign.id, name: campaign.name, status: successCount === recipients.length ? 'completed' : 'partial' },
      stats: { totalRecipients: recipients.length, successCount, failedCount },
      metadata: { apiKey: apiKeyName, targetType, ...(metadata || {}) },
    });
  } catch (error) {
    console.error('Error in external email campaign API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ── GET /api/v1/admin/emails — Get campaign history ──
export async function GET(request: NextRequest) {
  try {
    const keyRecord = await validateApiKey(request, 'email');
    if (!keyRecord) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Invalid API key, insufficient scope, or rate limit exceeded.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    // Only show API-created campaigns
    where.recipientType = { startsWith: 'api_' };

    const [campaigns, total] = await Promise.all([
      prisma.emailCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true, name: true, subject: true, status: true,
          sentCount: true, targetCount: true, recipientType: true,
          sentAt: true, createdAt: true, description: true,
        },
      }),
      prisma.emailCampaign.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        campaigns,
        pagination: { total, limit, offset, hasMore: offset + limit < total },
      },
    });
  } catch (error) {
    console.error('Error fetching email campaigns via API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}