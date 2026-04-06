import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { signJWT } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import { obfuscateEmail, obfuscateId } from '@/lib/pii-obfuscation';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
      // First, try to find a team member with this email
      const teamMember = await prisma.partnerTeamMember.findFirst({
        where: { 
          email: email,
          status: 'active'
        },
        include: {
          partner: {
            select: {
              id: true,
              businessName: true,
              approvalStatus: true
            }
          }
        }
      });

      // If no team member found or no password set, return 401
      if (!teamMember || !teamMember.passwordHash) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      // Check if the partner is active
      if (teamMember.partner.approvalStatus !== 'ACTIVE') {
        return NextResponse.json(
          { error: 'Your partner account is pending approval or has been suspended' },
          { status: 403 }
        );
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, teamMember.passwordHash);
      if (!isValidPassword) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      // Generate JWT token for team member
      const jwtPayload = {
        partnerId: teamMember.partnerId,
        email: teamMember.email,
        teamMemberId: teamMember.id,
        role: teamMember.role,
        isTeamMember: true,
        hasChangedPassword: true // Team members set their password during invitation acceptance
      };

      logger.debug('Creating JWT for team member login', {
        partnerId: obfuscateId(teamMember.partnerId),
        teamMemberId: obfuscateId(teamMember.id),
        email: obfuscateEmail(teamMember.email),
        role: teamMember.role,
        operation: 'team_member_login_jwt_create',
      });
      const token = await signJWT(jwtPayload);

      // Update last login time
      await prisma.partnerTeamMember.update({
        where: { id: teamMember.id },
        data: { lastLogin: new Date() }
      });

      logger.info('Team member login successful', {
        partnerId: obfuscateId(teamMember.partnerId),
        teamMemberId: obfuscateId(teamMember.id),
        email: obfuscateEmail(teamMember.email),
        role: teamMember.role,
        operation: 'team_member_login',
      });

      // Set cookie with JWT token
      cookies().set('partner_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });

      return NextResponse.json({
        message: 'Login successful',
        requirePasswordChange: false,
        name: teamMember.name,
        partnerName: teamMember.partner.businessName,
        isTeamMember: true,
        role: teamMember.role,
        token
      });
    } catch (dbError) {
      logger.error('Team member login database error', dbError instanceof Error ? dbError : undefined, {
        operation: 'team_member_login',
      });
      return NextResponse.json(
        { error: 'An error occurred while processing your request' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Team member login request parsing error', error instanceof Error ? error : undefined, {
      operation: 'team_member_login',
    });
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
}
