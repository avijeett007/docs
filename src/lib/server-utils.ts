/**
 * Server-only utility functions that require database access
 * 
 * These functions should only be used in server-side contexts (API routes, server components)
 * and should NOT be imported in client-side code to avoid Edge Runtime compatibility issues.
 */

import { customAlphabet } from 'nanoid';
import { prisma } from './prisma';

const nanoid = customAlphabet('123456789ABCDEFGHIJKLMNPQRSTUVWXYZ', 8);

export async function generatePartnerCode(): Promise<string> {
  let partnerCode: string;
  let isUnique = false;

  // Keep generating until we find a unique code
  while (!isUnique) {
    partnerCode = `KP${nanoid()}`;
    const existingPartner = await prisma.partner.findUnique({
      where: { partnerCode },
    });
    if (!existingPartner) {
      isUnique = true;
      return partnerCode;
    }
  }

  throw new Error('Could not generate unique partner code');
}
