import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendEmail, buildPartnerEmailSettings } from '@/lib/email';
import { convertExperienceProspectToCustomer } from '@/lib/services/experienceBookingService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/whitelabel/experience-leads/[alias]
 *
 * Public endpoint (no auth required) — called from experience landing pages.
 * Saves a lead qualification submission as a Prospect record.
 *
 * The partner is determined from the x-partner-id header or hostname.
 * The experience is looked up by alias (e.g., "openclaw" → "/openclaw").
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { alias: string } }
) {
  const { alias } = params;
  const normalizedAlias = alias.startsWith('/') ? alias : `/${alias}`;

  try {
    const body = await request.json();
    const { name, email, phone, businessName, website, industry, challenges, revenue, notes, experienceType } = body as {
      name?: string; email?: string; phone?: string; businessName?: string;
      website?: string; industry?: string; challenges?: string; revenue?: string;
      notes?: string; experienceType?: string;
    };

    if (!email || !name) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Determine the partner from the hostname
    const hostname = request.headers.get('host') || '';
    const partnerId = request.headers.get('x-partner-id');

    const PARTNER_SELECT = {
      id: true, businessName: true, emailAddress: true,
      logo: true, primaryColor: true, secondaryColor: true,
      subdomain: true, customDomain: true, customDomainVerified: true,
      // Fields required by convertExperienceProspectToCustomer
      autoDeployEnabled: true, planId: true, approvalStatus: true, customLandingPageUrl: true,
      // AI Gateway / Credits auto-enablement for new customers
      customerGatewayEnabled: true, customerGatewayForNewCustomers: true,
      // SMTP / SES for branded emails
      useCustomSmtp: true, smtpHost: true, smtpPort: true,
      smtpUsername: true, smtpPassword: true, smtpFromEmail: true, smtpFromName: true,
      sesDomainEnabled: true, useSESDomain: true, sesDomain: true,
      sesDomainStatus: true, sesFromEmail: true, sesFromName: true,
    } as const;

    let partner: {
      id: string; businessName: string; emailAddress: string;
      logo: string | null; primaryColor: string | null; secondaryColor: string | null;
      subdomain: string | null; customDomain: string | null; customDomainVerified: boolean;
      autoDeployEnabled: boolean; planId: string | null; approvalStatus: string | null; customLandingPageUrl: string | null;
      useCustomSmtp: boolean; smtpHost: string | null; smtpPort: number | null;
      smtpUsername: string | null; smtpPassword: string | null;
      smtpFromEmail: string | null; smtpFromName: string | null;
      sesDomainEnabled: boolean; useSESDomain: boolean; sesDomain: string | null;
      sesDomainStatus: string | null; sesFromEmail: string | null; sesFromName: string | null;
    } | null = null;

    if (partnerId) {
      partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: PARTNER_SELECT,
      });
    } else {
      const host = hostname.split(':')[0];
      let subdomain: string | null = null;
      if (host.includes('.lvh.me')) subdomain = host.split('.')[0];
      else if (host.includes('.knotie-ai.pro')) subdomain = host.split('.')[0];

      if (subdomain) {
        partner = await prisma.partner.findFirst({
          where: { subdomain: { equals: subdomain, mode: 'insensitive' } },
          select: PARTNER_SELECT,
        });
      }
      if (!partner) {
        partner = await prisma.partner.findFirst({
          where: { customDomain: { equals: host, mode: 'insensitive' } },
          select: PARTNER_SELECT,
        });
      }
    }

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Look up the experience record — reject if it doesn't exist or is disabled
    const experience = await prisma.partnerExperience.findFirst({
      where: { partnerId: partner.id, alias: normalizedAlias, enabled: true },
      select: { id: true, landingPageConfig: true },
    });

    if (!experience) {
      logger.warn('Experience lead submission to missing/disabled experience', {
        operation: 'experience_lead_submit',
        alias: normalizedAlias,
        partnerId: partner.id,
      });
      return NextResponse.json({ error: 'Experience not found or not available' }, { status: 404 });
    }

    // Split name into first/last
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Build serviceCategories JSON to capture qualification data
    const serviceCategories = {
      ...(industry ? { industry } : {}),
      ...(challenges ? { primaryChallenge: challenges } : {}),
      ...(revenue ? { revenueRange: revenue } : {}),
      ...(notes ? { notes } : {}),
    };

    // Find an existing prospect for THIS partner with this email to avoid
    // cross-partner conflicts (same email can exist for different partners).
    const existing = await prisma.prospect.findFirst({
      where: { partnerId: partner.id, email: normalizedEmail },
      select: { id: true },
    });

    let prospect;
    if (existing) {
      prospect = await prisma.prospect.update({
        where: { id: existing.id },
        data: {
          firstName,
          lastName,
          phone: phone || null,
          businessName: businessName || null,
          businessWebsite: website || null,
          serviceCategories,
          experienceType: experienceType || null,
          experienceId: experience?.id || null,
        },
      });
    } else {
      prospect = await prisma.prospect.create({
        data: {
          partnerId: partner.id,
          firstName,
          lastName,
          email: normalizedEmail,
          phone: phone || null,
          businessName: businessName || null,
          businessWebsite: website || null,
          serviceCategories,
          experienceType: experienceType || null,
          experienceId: experience?.id || null,
          currentStep: 1,
          completedSteps: [1],
        },
      });
    }

    // Increment totalProspects on the experience record
    if (experience?.id) {
      await prisma.partnerExperience.update({
        where: { id: experience.id },
        data: { totalProspects: { increment: 1 } },
      }).catch(() => { /* non-critical */ });
    }

    logger.info('Experience lead saved', {
      operation: 'experience_lead_submit',
      prospectId: prospect.id,
      partnerId: partner.id,
      alias: normalizedAlias,
      experienceType,
    });

    // ── Free booking: convert prospect to customer immediately ───────────────
    // If the experience has no prepaid booking configured (or amount is 0), the
    // prospect gets portal access right away without going through Stripe.
    const landingConfig = (experience?.landingPageConfig as Record<string, unknown>) || {};
    // Booking link to include in confirmation email when embedded calendar is disabled
    const emailCalendarUrl = typeof landingConfig.calendarUrl === 'string' ? landingConfig.calendarUrl : undefined;
    const showEmbeddedCalendar = landingConfig.showEmbeddedCalendar === true;
    // Include the booking link in the email only when it exists but embedding is disabled
    const bookingLinkForEmail = emailCalendarUrl && !showEmbeddedCalendar ? emailCalendarUrl : undefined;
    const prepaid = landingConfig.prepaidBooking as Record<string, unknown> | undefined;
    const isFreebooking = !prepaid?.enabled || !prepaid?.amount || Number(prepaid.amount) <= 0;

    if (isFreebooking && !prospect.convertedToCustomerId) {
      try {
        await convertExperienceProspectToCustomer(
          {
            id: prospect.id,
            partnerId: partner.id,
            firstName: prospect.firstName,
            lastName: prospect.lastName,
            email: prospect.email,
            phone: prospect.phone ?? null,
            businessName: prospect.businessName ?? null,
            ghlContactId: prospect.ghlContactId ?? null,
            convertedToCustomerId: prospect.convertedToCustomerId ?? null,
          },
          partner,
        );
        logger.info('[ExperienceLead] Free-booking prospect converted to customer', {
          operation: 'experience_lead_submit',
          prospectId: prospect.id,
          partnerId: partner.id,
        });
      } catch (convErr) {
        // Non-fatal: log and continue so the lead is still saved
        logger.error('[ExperienceLead] Failed to convert free prospect to customer (non-fatal)', convErr instanceof Error ? convErr : new Error(String(convErr)), {
          operation: 'experience_lead_submit',
          prospectId: prospect.id,
          partnerId: partner.id,
        });
      }
    }

    // ── Email notifications (non-blocking) ──────────────────────────────────
    const partnerName = partner.businessName;
    const primaryColor = partner.primaryColor || '#F97316';

    // Guide Link — takes the partner to the prospects page in their dashboard
    const guideLink = `${process.env.NEXT_PUBLIC_PARTNER_URL || 'https://knotie-ai.pro'}/partner/prospects`;

    // Build partner SMTP settings for branded prospect confirmation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partnerSmtpSettings = await buildPartnerEmailSettings(partner as any, partnerName).catch(() => undefined);

    // 1️⃣  Prospect confirmation — sent via partner SMTP/SES (branded)
    sendEmail(
      {
        to: normalizedEmail,
        subject: `You're booked in with ${partnerName} — what happens next`,
        html: buildProspectConfirmationHtml({ firstName, partnerName, primaryColor, logo: partner.logo, calendarUrl: bookingLinkForEmail }),
        from: partnerSmtpSettings?.smtpFromEmail || partnerSmtpSettings?.sesFromEmail || undefined,
        fromName: partnerSmtpSettings?.smtpFromName || partnerSmtpSettings?.sesFromName || partnerName,
        partnerId: partner.id,
        emailType: 'experience_lead_confirmation',
      },
      partnerSmtpSettings
    ).catch(err => logger.warn('Failed to send prospect confirmation email', { operation: 'experience_lead_submit', error: String(err) }));

    // 2️⃣  Agency notification — sent via Knotie platform email
    sendEmail({
      to: partner.emailAddress,
      subject: `📋 New setup request from ${firstName}${businessName ? ` (${businessName})` : ''}`,
      html: buildAgencyNotificationHtml({
        firstName, lastName, email: normalizedEmail, phone, businessName, industry, revenue, notes,
        partnerName, guideLink, primaryColor,
      }),
      from: 'notification@knotie-ai.pro',
      fromName: 'Knotie AI Notifications',
      partnerId: partner.id,
      emailType: 'experience_lead_agency_notification',
    }).catch(err => logger.warn('Failed to send agency notification email', { operation: 'experience_lead_submit', error: String(err) }));

    return NextResponse.json({ success: true, prospectId: prospect.id });
  } catch (error) {
    logger.error('Error saving experience lead', error as Error, {
      operation: 'experience_lead_submit',
      alias,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ── XSS prevention ──────────────────────────────────────────────────────────

/** Escape HTML special characters in user-supplied strings before interpolation into HTML. */
function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Email HTML builders ──────────────────────────────────────────────────────

function buildProspectConfirmationHtml({
  firstName, partnerName, primaryColor, logo, calendarUrl,
}: { firstName: string; partnerName: string; primaryColor: string; logo: string | null; calendarUrl?: string }) {
  const safeFirstName = escapeHtml(firstName);
  const safePartnerName = escapeHtml(partnerName);
  const safeCalendarUrl = calendarUrl ? escapeHtml(calendarUrl) : undefined;

  const bookingBlock = safeCalendarUrl
    ? `<div style="text-align:center;margin:24px 0">
        <p style="color:#4A5568;font-size:14px;margin:0 0 14px">Ready to book your setup call? Click the button below to pick a time that suits you:</p>
        <a href="${safeCalendarUrl}" target="_blank" rel="noopener noreferrer"
          style="display:inline-block;background:${primaryColor};color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:700">
          📅 Book My Setup Call
        </a>
        <p style="color:#A0AEC0;font-size:11px;margin:10px 0 0">
          Or copy this link: <a href="${safeCalendarUrl}" style="color:${primaryColor};word-break:break-all">${safeCalendarUrl}</a>
        </p>
      </div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
  <div style="background:${primaryColor};padding:32px 40px;text-align:center">
    ${logo ? `<img src="${escapeHtml(logo)}" alt="${safePartnerName}" style="height:48px;object-fit:contain;margin-bottom:12px"><br>` : ''}
    <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700">${safePartnerName}</h1>
  </div>
  <div style="padding:40px">
    <h2 style="color:#1A1A2E;margin:0 0 16px;font-size:20px">Hi ${safeFirstName}, we&rsquo;ve received your request! 🎉</h2>
    <p style="color:#4A5568;line-height:1.6;margin:0 0 20px">
      Thank you for reaching out to <strong>${safePartnerName}</strong>. We&rsquo;ve got your setup request and will be in touch shortly to confirm your call details.
    </p>
    <div style="background:#F8F9FC;border-left:4px solid ${primaryColor};border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px">
      <p style="margin:0;color:#4A5568;font-size:14px"><strong>What to expect:</strong></p>
      <ul style="margin:8px 0 0;padding-left:20px;color:#4A5568;font-size:14px;line-height:1.8">
        <li>A team member will reach out within 1 business day</li>
        <li>${safeCalendarUrl ? 'Use the button below to book your setup call at a time that works for you' : 'We&rsquo;ll confirm your setup call time and send a calendar invite'}</li>
        <li>During the call we&rsquo;ll configure your AI tools together</li>
      </ul>
    </div>
    ${bookingBlock}
  </div>
  <div style="background:#F8F9FC;padding:20px 40px;border-top:1px solid #E2E8F0;text-align:center">
    <p style="color:#A0AEC0;font-size:12px;margin:0">&copy; ${new Date().getFullYear()} ${safePartnerName}. All rights reserved.</p>
  </div>
</div>
</body></html>`;
}

function buildAgencyNotificationHtml({
  firstName, lastName, email, phone, businessName, industry, revenue, notes,
  partnerName, guideLink, primaryColor,
}: {
  firstName: string; lastName: string; email: string; phone?: string;
  businessName?: string; industry?: string; revenue?: string; notes?: string;
  partnerName: string; guideLink: string; primaryColor: string;
}) {
  // Escape all user-provided fields before interpolation
  const safeName = escapeHtml(`${firstName} ${lastName}`.trim());
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeBusiness = escapeHtml(businessName);
  const safeIndustry = escapeHtml(industry);
  const safeRevenue = escapeHtml(revenue);
  const safeNotes = escapeHtml(notes);
  const safePartnerName = escapeHtml(partnerName);

  const row = (label: string, value?: string) =>
    value ? `<tr><td style="padding:8px 12px;color:#718096;font-size:13px;width:36%;vertical-align:top">${label}</td><td style="padding:8px 12px;color:#1A1A2E;font-size:13px;font-weight:500">${value}</td></tr>` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
  <div style="background:${primaryColor};padding:28px 40px">
    <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700">📋 New Setup Request</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px">${safePartnerName} · OpenClaw Setup Service</p>
  </div>
  <div style="padding:32px 40px">
    <p style="color:#4A5568;font-size:15px;margin:0 0 24px">
      A new prospect has submitted a setup request through your landing page. Review their details below and reach out to confirm their call.
    </p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;margin-bottom:28px">
      <tbody>
        ${row('Name', safeName)}
        ${row('Email', safeEmail)}
        ${row('Phone', safePhone)}
        ${row('Business', safeBusiness)}
        ${row('Industry', safeIndustry)}
        ${row('Revenue Range', safeRevenue)}
        ${row('Notes', safeNotes)}
      </tbody>
    </table>
    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:20px;margin-bottom:24px">
      <h3 style="color:#C2410C;margin:0 0 8px;font-size:15px">📖 Guide Link — Maximize This Booking</h3>
      <p style="color:#9A3412;font-size:13px;margin:0 0 14px;line-height:1.5">
        Use the link below to view this prospect in your dashboard and manage next steps. Check out our best practices guide to ensure you deliver an excellent setup call experience.
      </p>
      <a href="${guideLink}" style="display:inline-block;background:${primaryColor};color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:700">
        View Prospect in Dashboard →
      </a>
    </div>
    <p style="color:#A0AEC0;font-size:12px;margin:0;line-height:1.5">
      This notification was sent because a prospect submitted a setup request through your whitelabel landing page.
      Powered by <strong>Knotie AI Pro</strong>.
    </p>
  </div>
</div>
</body></html>`;
}

