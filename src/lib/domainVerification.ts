import { promisify } from 'util';
import crypto from 'crypto';
import { logger } from './logger';

/**
 * Generate a random verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate a random subdomain target for CNAME
 */
export function generateRandomSubdomain(): string {
  return `${crypto.randomBytes(8).toString('hex')}.knotie-ai.pro`;
}

/**
 * Check if a CNAME record is correctly configured
 */
export async function checkCnameRecord(domain: string, expectedTarget: string): Promise<boolean> {
  try {
    // In a server environment, we would use the dns module:
    // const resolveCname = promisify(dns.resolveCname);
    // const records = await resolveCname(domain);

    // For now, we'll use a fetch to a DNS checking service
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=CNAME`);
    const data = await response.json();

    if (!data.Answer) {
      logger.error('No CNAME records found for domain', new Error('No CNAME records found'), {
        operation: 'domain_verification',
        domain
      });
      return false;
    }

    // Check if any of the answers match our expected target
    return data.Answer.some((answer: any) => {
      // Remove trailing dot if present
      const target = answer.data.endsWith('.') ? answer.data.slice(0, -1) : answer.data;
      return target === expectedTarget;
    });
  } catch (error) {
    logger.error('Error checking CNAME for domain', error as Error, {
      operation: 'domain_verification',
      domain
    });
    return false;
  }
}

/**
 * Check if a TXT record contains the expected verification token
 */
export async function checkTxtRecord(domain: string, expectedToken: string): Promise<boolean> {
  try {
    // In a server environment, we would use the dns module:
    // const resolveTxt = promisify(dns.resolveTxt);
    // const records = await resolveTxt(`_knotie-verification.${domain}`);

    // For now, we'll use a fetch to a DNS checking service
    const response = await fetch(`https://dns.google/resolve?name=_knotie-verification.${domain}&type=TXT`);
    const data = await response.json();

    if (!data.Answer) {
      logger.error('No TXT records found for domain verification', new Error('No TXT records found'), {
        operation: 'domain_verification',
        domain,
        verificationDomain: `_knotie-verification.${domain}`
      });
      return false;
    }

    // Check if any of the answers match our expected token
    return data.Answer.some((answer: any) => {
      // TXT records are returned with quotes, so we need to remove them
      const txtValue = answer.data.replace(/"/g, '');
      return txtValue === expectedToken;
    });
  } catch (error) {
    logger.error('Error checking TXT record for domain', error as Error, {
      operation: 'domain_verification',
      domain
    });
    return false;
  }
}

/**
 * Verify a domain's DNS configuration
 */
export async function verifyDomain(domain: string, verificationToken: string, cnameTarget: string): Promise<{
  cnameValid: boolean;
  txtValid: boolean;
}> {
  const cnameValid = await checkCnameRecord(domain, cnameTarget);
  const txtValid = await checkTxtRecord(domain, verificationToken);

  return {
    cnameValid,
    txtValid
  };
}

/**
 * Format domain verification instructions
 */
export function getDomainVerificationInstructions(
  domain: string,
  verificationToken: string,
  cnameTarget: string,
  txtToken?: string
): {
  cname: string;
  txt?: string;
  cnameRecord: { type: string; name: string; value: string; };
  txtRecord?: { type: string; name: string; value: string; };
} {
  // Extract the subdomain part if it's a subdomain
  const domainParts = domain.split('.');
  const isSubdomain = domainParts.length > 2;

  // If it's a subdomain, we need to use just the subdomain part as the name
  // For example, for "portal.example.com", we use "portal" as the name
  const recordName = isSubdomain ? domainParts[0] : '@';

  // For display purposes, show the full domain
  const displayName = isSubdomain ? domainParts[0] : domain;

  const instructions: any = {
    cname: `Create a CNAME record for ${displayName} pointing to ${cnameTarget}`,
    cnameRecord: {
      type: 'CNAME',
      name: recordName,
      value: cnameTarget
    }
  };

  // Add TXT record instructions if a token is provided
  if (txtToken) {
    const txtPrefix = '_knotie-verification';
    const txtRecordName = isSubdomain ? `${txtPrefix}.${domainParts[0]}` : txtPrefix;

    instructions.txt = `Create a TXT record for ${txtPrefix}.${displayName} with value ${txtToken}`;
    instructions.txtRecord = {
      type: 'TXT',
      name: txtRecordName,
      value: txtToken
    };
  }

  return instructions;
}
