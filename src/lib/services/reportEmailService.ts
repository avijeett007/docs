import { ReportData, ReportMetric } from '@/types/customerReport';
import { getPartnerEmailSettings, sendEmail } from '@/lib/email';
import { generateReportEmailTemplate } from '@/lib/emailTemplates/reportEmailTemplate';
import { logger } from '@/lib/logger';

export interface SendReportEmailParams {
  partnerId: string;
  customerId: string;
  customerEmail: string;
  reportData: ReportData;
  includedMetrics: ReportMetric[];
}

export interface SendReportEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Sends a customer analytics report email using partner's branded email settings
 * 
 * This utility combines:
 * 1. Partner email settings retrieval (SMTP/SES/default)
 * 2. HTML template generation with report data
 * 3. Email sending with automatic logging to EmailLog table
 * 
 * @param params - Email parameters including partner, customer, and report data
 * @returns Result object with success status and optional error/messageId
 */
export async function sendReportEmail(
  params: SendReportEmailParams
): Promise<SendReportEmailResult> {
  const { partnerId, customerId, customerEmail, reportData, includedMetrics } = params;
  
  try {
    logger.info('Sending customer report email', {
      operation: 'report_email',
      partnerId,
      customerId,
      customerEmail,
      frequency: reportData.frequency,
      period: reportData.period
    });
    
    // Step 1: Get partner's email settings (SES/SMTP/default)
    const partnerEmailSettings = await getPartnerEmailSettings(
      partnerId,
      reportData.partnerBusinessName
    );
    
    // Step 2: Generate HTML email template
    const htmlContent = generateReportEmailTemplate(reportData, includedMetrics);
    
    // Step 3: Determine email subject based on frequency
    const subject = reportData.frequency === 'instant' 
      ? `Analytics Report - ${reportData.period.startDate}` 
      : reportData.frequency === 'daily' 
      ? `Daily Analytics Report - ${new Date(reportData.period.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` 
      : `Weekly Analytics Report - ${new Date(reportData.period.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${new Date(reportData.period.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    
    // Step 4: Send email using the main app's email system
    // This automatically logs to EmailLog table and uses partner branding
    const result = await sendEmail(
      {
        to: customerEmail,
        subject,
        html: htmlContent,
        partnerId,
        customerId,
        emailType: 'customer_report',
        fromName: reportData.partnerBusinessName
      },
      partnerEmailSettings
    );
    
    if (!result.success) {
      logger.error('Failed to send report email', new Error('error' in result && result.error ? result.error : 'Unknown error'), {
        operation: 'report_email',
        partnerId,
        customerId,
        customerEmail
      });
      
      return {
        success: false,
        error: 'error' in result && result.error ? result.error : 'Failed to send email'
      };
    }
    
    logger.info('Report email sent successfully', {
      operation: 'report_email',
      partnerId,
      customerId,
      customerEmail,
      messageId: 'messageId' in result ? result.messageId : undefined
    });
    
    return {
      success: true,
      messageId: 'messageId' in result ? result.messageId : undefined
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logger.error('Report email service error', error as Error, {
      operation: 'report_email',
      partnerId,
      customerId,
      customerEmail
    });
    
    return {
      success: false,
      error: errorMessage
    };
  }
}
