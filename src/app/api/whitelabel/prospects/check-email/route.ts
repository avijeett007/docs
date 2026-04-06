import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let partnerId: string | undefined;
  let email: string | undefined;

  try {
    const body = await request.json();
    email = body.email;
    partnerId = body.partnerId;

    if (!email || !partnerId) {
      logger.warn('Email duplicate check - missing parameters', {
        operation: 'email_duplicate_check',
        hasEmail: !!email,
        hasPartnerId: !!partnerId
      });
      return NextResponse.json({ error: 'Email and partnerId are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // First, check if customer already exists (most authoritative check)
    const existingCustomer = await prisma.customerCredential.findUnique({
      where: {
        partnerId_email: {
          partnerId: partnerId,
          email: normalizedEmail
        }
      },
      include: {
        customer: true
      }
    });

    if (existingCustomer) {
      logger.info('Email duplicate check - customer exists', {
        operation: 'email_duplicate_check',
        partnerId,
        emailExists: true,
        isCustomer: true,
        responseTimeMs: Date.now() - startTime
      });

      return NextResponse.json({
        exists: true,
        isCustomer: true,
        message: 'This email is already registered. Please log in to continue your journey.',
        customerId: existingCustomer.customerId
      });
    }

    // Check if email exists in prospects table - prioritize converted prospects
    const existingProspects = await prisma.prospect.findMany({
      where: {
        email: normalizedEmail,
        partnerId: partnerId
      },
      orderBy: [
        { convertedToCustomerId: { sort: 'desc', nulls: 'last' } }, // Converted prospects first
        { updatedAt: 'desc' } // Then by most recent
      ]
    });

    if (existingProspects.length > 0) {
      const primaryProspect = existingProspects[0];

      // Check if this prospect has been converted to a customer
      if (primaryProspect.convertedToCustomerId) {
        logger.info('Email duplicate check - converted prospect exists', {
          operation: 'email_duplicate_check',
          partnerId,
          emailExists: true,
          isCustomer: true,
          prospectId: primaryProspect.id,
          responseTimeMs: Date.now() - startTime
        });

        return NextResponse.json({
          exists: true,
          isCustomer: true,
          message: 'This email is already registered. Please log in to continue your journey.',
          prospectId: primaryProspect.id,
          customerId: primaryProspect.convertedToCustomerId
        });
      } else {
        logger.info('Email duplicate check - prospect exists', {
          operation: 'email_duplicate_check',
          partnerId,
          emailExists: true,
          isCustomer: false,
          prospectId: primaryProspect.id,
          currentStep: primaryProspect.currentStep,
          responseTimeMs: Date.now() - startTime
        });

        return NextResponse.json({
          exists: true,
          isCustomer: false,
          message: 'This email is already in our system. Please log in to continue your onboarding.',
          prospectId: primaryProspect.id,
          currentStep: primaryProspect.currentStep
        });
      }
    }

    // Email doesn't exist, safe to proceed
    logger.info('Email duplicate check - email available', {
      operation: 'email_duplicate_check',
      partnerId,
      emailExists: false,
      responseTimeMs: Date.now() - startTime
    });

    return NextResponse.json({
      exists: false,
      message: 'Email is available for registration'
    });

  } catch (error) {
    logger.error('Email duplicate check error', error as Error, {
      operation: 'email_duplicate_check',
      partnerId,
      email: email ? 'provided' : 'missing',
      responseTimeMs: Date.now() - startTime
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
