import { NextResponse, NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET;

export interface JWTPayload {
  partnerId: string;
  email: string;
}

export async function verifyPartnerJWT(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      ),
      isValid: false
    };
  }

  const token = authHeader.split(' ')[1];
  
  if (!JWT_SECRET) {
    return {
      error: NextResponse.json(
        { error: 'JWT secret not configured' },
        { status: 500 }
      ),
      isValid: false
    };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return {
      payload: decoded,
      isValid: true
    };
  } catch (error) {
    return {
      error: NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      ),
      isValid: false
    };
  }
}

export function generatePartnerJWT(payload: JWTPayload) {
  if (!JWT_SECRET) {
    throw new Error('JWT secret not configured');
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export async function getPartnerFromToken(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ') || !JWT_SECRET) {
    return null;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    const partner = await prisma.partner.findUnique({
      where: { id: decoded.partnerId }
    });
    return partner;
  } catch (error) {
    return null;
  }
}

export async function verifyPartnerToken(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      ),
      success: false,
      partner: null
    };
  }

  const token = authHeader.split(' ')[1];

  if (!JWT_SECRET) {
    return {
      error: NextResponse.json(
        { error: 'JWT secret not configured' },
        { status: 500 }
      ),
      success: false,
      partner: null
    };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    const partner = await prisma.partner.findUnique({
      where: { id: decoded.partnerId }
    });

    if (!partner) {
      return {
        error: NextResponse.json(
          { error: 'Partner not found' },
          { status: 401 }
        ),
        success: false,
        partner: null
      };
    }

    return {
      payload: decoded,
      success: true,
      partner: partner
    };
  } catch (error) {
    return {
      error: NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      ),
      success: false,
      partner: null
    };
  }
}