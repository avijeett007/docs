/**
 * Customer Portal Invite Email Template
 * 
 * This template is used to send white-label portal access invitations to customers.
 * It uses the partner's branding (logo, colors, etc.) to create a personalized email.
 */

interface PartnerBranding {
  businessName: string;
  logo?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  portalTitle?: string;
}

interface TemplateData {
  firstName: string;
  password: string;
  portalUrl: string;
  branding: PartnerBranding;
}

/**
 * Generates the HTML for a customer portal invite email
 */
export function generateCustomerPortalInviteHTML(data: TemplateData): string {
  // Use default values if branding properties are missing
  const businessName = data.branding.businessName;
  const portalTitle = data.branding.portalTitle || `${businessName} Portal`;
  const primaryColor = data.branding.primaryColor || '#3B82F6';
  const secondaryColor = data.branding.secondaryColor || '#10B981';
  const fontFamily = data.branding.fontFamily || 'Arial, sans-serif';
  
  // Create a gradient for buttons and headers
  const gradient = `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`;
  
  // Create a logo or fallback to a text-based logo
  const logoHtml = data.branding.logo 
    ? `<img src="${data.branding.logo}" alt="${businessName}" style="max-width: 150px; max-height: 60px; margin-bottom: 20px;">`
    : `<div style="font-size: 24px; font-weight: bold; margin-bottom: 20px; color: ${primaryColor};">${businessName}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your Portal Access for ${businessName}</title>
  <style type="text/css">
    /* Basic resets for email clients */
    body {
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      font-family: ${fontFamily}, Arial, sans-serif;
    }
    table, td {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    p {
      margin: 10px 0;
    }
  </style>
</head>
<body style="background-color: #f9f9f9; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: ${fontFamily}, Arial, sans-serif;">
  <!-- Main Container -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%;">
    <tr>
      <td align="center" valign="top" style="padding: 40px 10px;">
        <!-- Content Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 40px 30px 20px 30px; border-bottom: 1px solid #f0f0f0;">
              <!-- Logo -->
              ${logoHtml}
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <!-- Greeting -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #333333; font-size: 16px; line-height: 24px; padding-bottom: 20px;">
                    <p>Hello ${data.firstName},</p>
                    <p>Your access to the ${portalTitle} has been enabled. You can now log in to view your AI voice agents, call history, and analytics.</p>
                  </td>
                </tr>
              </table>
              
              <!-- Access Details Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9f9f9; border-radius: 8px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="color: #333333; font-size: 18px; font-weight: bold; padding-bottom: 15px;">
                          Your Portal Access Details
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 15px;">
                          <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="100" style="color: #666666; font-size: 14px; padding-bottom: 5px;">Portal URL:</td>
                              <td style="color: #333333; font-size: 14px; padding-bottom: 5px;">
                                <a href="${data.portalUrl}" style="color: ${primaryColor}; text-decoration: none; font-weight: bold;">${data.portalUrl}</a>
                              </td>
                            </tr>
                            <tr>
                              <td width="100" style="color: #666666; font-size: 14px;">Password:</td>
                              <td style="color: #333333; font-size: 14px; font-weight: bold;">${data.password}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px; font-style: italic;">
                          For security reasons, we recommend changing your password after your first login.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="border-radius: 50px; background-image: ${gradient};">
                          <a href="${data.portalUrl}" target="_blank" style="display: inline-block; padding: 15px 30px; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none;">Access Your Portal</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Features Section -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #333333; font-size: 16px; line-height: 24px; padding-bottom: 10px;">
                    <p>In your portal, you'll be able to:</p>
                  </td>
                </tr>
                <!-- Feature 1 -->
                <tr>
                  <td style="padding-bottom: 10px;">
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: ${primaryColor}; font-size: 16px; padding-right: 10px;">•</td>
                        <td style="color: #333333; font-size: 14px; line-height: 20px;">
                          View your AI voice agents and their performance
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Feature 2 -->
                <tr>
                  <td style="padding-bottom: 10px;">
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: ${primaryColor}; font-size: 16px; padding-right: 10px;">•</td>
                        <td style="color: #333333; font-size: 14px; line-height: 20px;">
                          Access detailed call history and transcripts
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Feature 3 -->
                <tr>
                  <td style="padding-bottom: 10px;">
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: ${primaryColor}; font-size: 16px; padding-right: 10px;">•</td>
                        <td style="color: #333333; font-size: 14px; line-height: 20px;">
                          Monitor usage statistics and analytics
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Closing Text -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 30px;">
                <tr>
                  <td style="color: #333333; font-size: 16px; line-height: 24px;">
                    <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
                    <p>Thank you,<br>The ${businessName} Team</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px 30px; border-top: 1px solid #f0f0f0; color: #999999; font-size: 14px; line-height: 20px;">
              <p style="margin: 0;">© ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
