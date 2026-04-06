import { sendEmail } from './email';
import {
  ContactVariables,
  ProductUpdatesEmailData,
  SpecialEventsEmailData,
  generateProductUpdatesHTML,
  generateSpecialEventsHTML
} from './emailTemplates';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type RecipientType = 'partner' | 'waitlist';

export interface Recipient {
  id: string;
  name: string;
  email: string;
  type: RecipientType;
  businessName?: string;
}

export interface CampaignEmailData {
  recipients: Recipient[];
  subject: string;
  templateType: 'product-updates' | 'special-events' | 'custom';
  customHtml?: string;
  productUpdatesData?: ProductUpdatesEmailData;
  specialEventsData?: SpecialEventsEmailData;
  htmlContent?: string; // For direct HTML content with variables
}

/**
 * Send a campaign email to multiple recipients
 */
export async function sendCampaignEmail(data: CampaignEmailData) {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as any[]
  };

  // Process each recipient
  for (const recipient of data.recipients) {
    try {
      // Create contact variables for this recipient
      const contactVariables: ContactVariables = {
        name: recipient.name,
        email: recipient.email,
        businessName: recipient.businessName || recipient.name,
      };

      let html = '';

      // Generate HTML based on template type
      if (data.templateType === 'product-updates' && data.productUpdatesData) {
        // Clone the data to avoid modifying the original
        const emailData = { ...data.productUpdatesData, to: recipient.email };
        html = generateProductUpdatesHTML(emailData);
      }
      else if (data.templateType === 'special-events' && data.specialEventsData) {
        // Clone the data to avoid modifying the original
        const emailData = { ...data.specialEventsData, to: recipient.email };
        html = generateSpecialEventsHTML(emailData);
      }
      else if (data.templateType === 'custom' && (data.customHtml || data.htmlContent)) {
        // Use custom HTML template
        const rawHtml = data.htmlContent || data.customHtml || '';

        // Process variables in the HTML content
        // Replace {{name}}, {{email}}, etc. with the actual values
        html = rawHtml.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
          // Trim whitespace from variable name
          const trimmedVariable = variable.trim();
          const value = contactVariables[trimmedVariable];

          // Add special handling for common variables
          if (trimmedVariable === 'unsubscribe') {
            return '#unsubscribe-link';
          } else if (trimmedVariable === 'date') {
            return new Date().toLocaleDateString();
          } else if (trimmedVariable === 'year') {
            return new Date().getFullYear().toString();
          }

          return value !== undefined ? value : match;
        });

        // Log the variables that were replaced for debugging
        logger.info('Email variables replaced for recipient', {
          operation: 'email_campaigns',
          recipientEmail: recipient.email,
          recipientName: recipient.name
        });
      }
      else {
        throw new Error('Invalid template type or missing data');
      }

      // Send the email
      const result = await sendEmail({
        to: recipient.email,
        subject: data.subject,
        html,
        contactVariables
      });

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        // Use type narrowing to safely access the error property
        const errorDetails = 'error' in result ? result.error : 'Unknown error';
        results.errors.push({
          recipient: recipient.email,
          error: errorDetails
        });
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        recipient: recipient.email,
        error
      });
    }
  }

  return results;
}

/**
 * Get all recipients (partners and waitlist members)
 */
export async function getAllRecipients(): Promise<Recipient[]> {
  try {
    // Get all partners
    const partners = await prisma.partner.findMany({
      select: {
        id: true,
        businessName: true,
        emailAddress: true,
        approvalStatus: true
      },
      where: {
        approvalStatus: 'APPROVED'
      }
    });

    // Get all waitlist members
    const waitlistMembers = await prisma.waitlist.findMany({
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    // Combine and format the results
    const recipients: Recipient[] = [
      ...partners.map(partner => ({
        id: partner.id,
        name: partner.businessName,
        email: partner.emailAddress,
        type: 'partner' as RecipientType,
        businessName: partner.businessName
      })),
      ...waitlistMembers.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        type: 'waitlist' as RecipientType
      }))
    ];

    return recipients;
  } catch (error) {
    logger.error('Error fetching recipients', error as Error, {
      operation: 'email_campaigns'
    });
    return [];
  }
}

/**
 * Generate email content using AI
 */
export async function generateEmailWithAI(prompt: string, templateType: string): Promise<string> {
  try {
    // In a real implementation, this would call an AI service like OpenAI
    // For now, we'll return a placeholder

    // This is where you would integrate with an AI service
    // Example with OpenAI (commented out as it requires API key setup):
    /*
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an email content generator for Knotie-AI Pro.
                    Generate professional HTML email content for a ${templateType} email.
                    Format it according to our brand guidelines with dark theme.`
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    return completion.choices[0].message.content || "";
    */

    // Placeholder implementation
    return `<p>This is AI-generated content based on your prompt: "${prompt}" for template type: ${templateType}</p>
            <p>In the actual implementation, this would be generated by an AI service like OpenAI.</p>`;
  } catch (error) {
    logger.error('Error generating email with AI', error as Error, {
      operation: 'email_campaigns',
      prompt
    });
    return `<p>Error generating content. Please try again.</p>`;
  }
}
