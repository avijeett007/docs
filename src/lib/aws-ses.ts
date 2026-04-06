import { 
  SESClient, 
  GetIdentityVerificationAttributesCommand,
  GetIdentityDkimAttributesCommand,
  VerifyDomainIdentityCommand,
  VerifyDomainDkimCommand,
  SendEmailCommand,
  DeleteIdentityCommand
} from '@aws-sdk/client-ses';
import { logger } from './logger';
import { obfuscateEmail } from './pii-obfuscation';

export interface DomainVerificationResult {
  verificationToken: string;
  dkimTokens: string[];
}

export interface DomainVerificationStatus {
  verified: boolean;
  dkimVerified: boolean;
  verificationToken?: string;
  dkimTokens: string[];
}

export interface DNSRecord {
  type: 'TXT' | 'CNAME';
  name: string;
  value: string;
  description: string;
}

export class SESService {
  private client: SESClient;

  constructor() {
    if (!process.env.AWS_SES_REGION || !process.env.AWS_SES_ACCESS_KEY_ID || !process.env.AWS_SES_SECRET_ACCESS_KEY) {
      throw new Error('AWS SES credentials not configured. Please set AWS_SES_REGION, AWS_SES_ACCESS_KEY_ID, and AWS_SES_SECRET_ACCESS_KEY environment variables.');
    }

    this.client = new SESClient({
      region: process.env.AWS_SES_REGION,
      credentials: {
        accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY
      }
    });
  }

  /**
   * Verify a domain with AWS SES and enable DKIM
   */
  async verifyDomain(domain: string): Promise<DomainVerificationResult> {
    try {
      logger.info('Starting domain verification', {
        operation: 'aws_ses_domain_verification',
        domain
      });

      // Verify domain identity
      const domainCommand = new VerifyDomainIdentityCommand({
        Domain: domain
      });
      const domainResponse = await this.client.send(domainCommand);

      // Enable DKIM for the domain
      const dkimCommand = new VerifyDomainDkimCommand({
        Domain: domain
      });
      const dkimResponse = await this.client.send(dkimCommand);

      const result = {
        verificationToken: domainResponse.VerificationToken || '',
        dkimTokens: dkimResponse.DkimTokens || []
      };

      logger.info('Domain verification initiated', {
        operation: 'aws_ses_domain_verification',
        domain,
        verificationToken: result.verificationToken,
        dkimTokenCount: result.dkimTokens.length
      });
      return result;
    } catch (error) {
      logger.error('Failed to verify domain', error as Error, {
        operation: 'aws_ses_domain_verification',
        domain
      });
      throw error;
    }
  }

  /**
   * Get the current verification status of a domain
   */
  async getDomainVerificationStatus(domain: string): Promise<DomainVerificationStatus> {
    try {
      // Check domain verification status
      const verificationCommand = new GetIdentityVerificationAttributesCommand({
        Identities: [domain]
      });
      const verificationResponse = await this.client.send(verificationCommand);
      
      // Check DKIM verification status
      const dkimCommand = new GetIdentityDkimAttributesCommand({
        Identities: [domain]
      });
      const dkimResponse = await this.client.send(dkimCommand);

      const domainVerification = verificationResponse.VerificationAttributes?.[domain];
      const dkimVerification = dkimResponse.DkimAttributes?.[domain];

      const status = {
        verified: domainVerification?.VerificationStatus === 'Success',
        dkimVerified: dkimVerification?.DkimVerificationStatus === 'Success',
        verificationToken: domainVerification?.VerificationToken,
        dkimTokens: dkimVerification?.DkimTokens || []
      };

      logger.info('Domain verification status retrieved', {
        operation: 'aws_ses_domain_status',
        domain,
        verified: status.verified,
        dkimVerified: status.dkimVerified
      });
      return status;
    } catch (error) {
      logger.error('Failed to get verification status', error as Error, {
        operation: 'aws_ses_domain_status',
        domain
      });
      throw error;
    }
  }

  /**
   * Generate DNS records that need to be added for domain verification
   */
  generateDNSRecords(domain: string, verificationToken: string, dkimTokens: string[]): DNSRecord[] {
    const records: DNSRecord[] = [];

    // Domain verification TXT record
    records.push({
      type: 'TXT',
      name: `_amazonses.${domain}`,
      value: verificationToken,
      description: 'Domain verification record'
    });

    // DKIM CNAME records
    dkimTokens.forEach((token, index) => {
      records.push({
        type: 'CNAME',
        name: `${token}._domainkey.${domain}`,
        value: `${token}.dkim.amazonses.com`,
        description: `DKIM authentication record ${index + 1}`
      });
    });

    return records;
  }

  /**
   * Send an email using AWS SES
   */
  async sendEmail(params: {
    to: string;
    from: string;
    fromName?: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    try {
      const fromAddress = params.fromName 
        ? `"${params.fromName}" <${params.from}>`
        : params.from;

      const command = new SendEmailCommand({
        Source: fromAddress,
        Destination: {
          ToAddresses: [params.to]
        },
        Message: {
          Subject: {
            Data: params.subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: params.html,
              Charset: 'UTF-8'
            },
            ...(params.text && {
              Text: {
                Data: params.text,
                Charset: 'UTF-8'
              }
            })
          }
        }
      });

      const result = await this.client.send(command);
      logger.info('Email sent successfully via SES', {
        operation: 'aws_ses_email_send',
        messageId: result.MessageId,
        to: obfuscateEmail(params.to),
        subject: params.subject
      });
      
      return { 
        success: true, 
        messageId: result.MessageId 
      };
    } catch (error) {
      logger.error('SES email send error', error as Error, {
        operation: 'aws_ses_email_send',
        to: obfuscateEmail(params.to),
        subject: params.subject
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown SES error' 
      };
    }
  }

  /**
   * Remove a domain from SES (cleanup)
   */
  async removeDomain(domain: string): Promise<void> {
    try {
      const command = new DeleteIdentityCommand({
        Identity: domain
      });
      
      await this.client.send(command);
      logger.info('Domain removed from SES', {
        operation: 'aws_ses_domain_removal',
        domain
      });
    } catch (error) {
      logger.error('Failed to remove domain from SES', error as Error, {
        operation: 'aws_ses_domain_removal',
        domain
      });
      throw error;
    }
  }

  /**
   * Validate domain format
   */
  static isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  /**
   * Generate recommended SPF and DMARC records for better deliverability
   */
  static generateRecommendedDNSRecords(domain: string): DNSRecord[] {
    return [
      {
        type: 'TXT',
        name: domain,
        value: 'v=spf1 include:amazonses.com ~all',
        description: 'SPF record for email authentication'
      },
      {
        type: 'TXT',
        name: `_dmarc.${domain}`,
        value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@' + domain,
        description: 'DMARC policy for email authentication'
      }
    ];
  }
}
