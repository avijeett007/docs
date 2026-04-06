/**
 * Webhook API: Prospect Onboarding Completion
 *
 * POST /api/v1/webhook/prospect-onboarding
 *
 * Allows partners to programmatically complete prospect onboarding
 * via external channels (GHL, N8N, WhatsApp, SMS campaigns, etc.)
 *
 * Authentication: Partner API key via x-api-key header
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyApiKeyAuth } from '@/lib/auth/apiKeyAuth';
import { validateWebhookOnboardingRequest } from '@/lib/validators/webhookOnboardingValidator';
import { processProspectOnboarding } from '@/lib/services/prospectOnboardingService';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authenticate via partner API key
    const keyInfo = await verifyApiKeyAuth(request);

    if (!keyInfo) {
      return NextResponse.json(
        { error: 'Invalid or missing API key. Use x-api-key header with a valid partner API key.' },
        { status: 401 }
      );
    }

    // Only partner API keys are allowed (not customer keys)
    if (keyInfo.type !== 'partner') {
      return NextResponse.json(
        { error: 'Only partner API keys are authorized for this endpoint.' },
        { status: 403 }
      );
    }

    const partnerId = keyInfo.partnerId;

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validation = validateWebhookOnboardingRequest(body);
    if (!validation.success || !validation.data) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const requestData = validation.data;
    const { prospect_identifier } = requestData;

    // 3. Look up prospect by email (primary) or phone (fallback)
    let prospect = null;

    if (prospect_identifier.email) {
      prospect = await prisma.prospect.findFirst({
        where: {
          partnerId,
          email: prospect_identifier.email.toLowerCase().trim(),
        },
      });
    }

    if (!prospect && prospect_identifier.phone) {
      prospect = await prisma.prospect.findFirst({
        where: {
          partnerId,
          phone: prospect_identifier.phone,
        },
      });
    }

    // If no prospect found, create a new one
    if (!prospect) {
      prospect = await prisma.prospect.create({
        data: {
          partnerId,
          email: prospect_identifier.email?.toLowerCase().trim() || null,
          phone: prospect_identifier.phone || null,
          currentStep: 1,
          completedSteps: '[]',
        },
      });

      logger.info('[WebhookOnboarding] Created new prospect', {
        prospectId: prospect.id,
        partnerId,
      });
    }

    // 4. Check if already completed (idempotent)
    if (prospect.isCompleted && !requestData.complete_from_step) {
      return NextResponse.json({
        success: true,
        message: 'Onboarding already completed',
        prospect: {
          id: prospect.id,
          current_step: 9,
          is_completed: true,
          completed_steps: (() => {
            try {
              return JSON.parse(prospect.completedSteps as string || '[]');
            } catch { return []; }
          })(),
        },
        steps_processed: [],
        steps_skipped: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      });
    }

    // 5. Process onboarding steps
    const result = await processProspectOnboarding(partnerId, prospect, requestData);

    const duration = Date.now() - startTime;
    logger.info('[WebhookOnboarding] Request completed', {
      prospectId: prospect.id,
      partnerId,
      success: result.success,
      stepsProcessed: result.steps_processed,
      durationMs: duration,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 207, // 207 Multi-Status for partial success
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[WebhookOnboarding] Unhandled error', error instanceof Error ? error : undefined, {
      durationMs: duration,
    });

    return NextResponse.json(
      { error: 'Internal server error', message: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

