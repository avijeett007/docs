import { MailDataRequired } from '@sendgrid/mail';

// Template IDs
export const TEMPLATE_IDS = {
  PARTNER_WELCOME: 'd-909bbbadcafb4bc6b7547ba8e654514e',
  PARTNER_RESET_PASSWORD: 'd-994c241822864f72ba2395c221ea540d',
  PRODUCT_UPDATES: 'd-1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
  SPECIAL_EVENTS: 'd-6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1'
};

// Email template types
export interface BaseEmailData {
  to: string;
  subject?: string;
}

export interface ContactVariables {
  name?: string;
  email?: string;
  businessName?: string;
  phone?: string;
  role?: string;
  [key: string]: string | undefined;
}

// Product Updates Template Sections
export interface ProductUpdateSection {
  title: string;
  details: string;
  imageUrl?: string;
}

export interface ProductUpdatesEmailData extends BaseEmailData {
  mainTitle: string;
  introduction: string;
  partnerFeatures?: ProductUpdateSection[];
  customerFeatures?: ProductUpdateSection[];
  platformUpdates?: ProductUpdateSection[];
  adminUpdates?: ProductUpdateSection[];
  events?: ProductUpdateSection[];
  conclusion?: string;
  contactVariables?: ContactVariables;
}

// Special Events Template
export interface EventDetails {
  title: string;
  date: string;
  time?: string;
  location?: string;
  description: string;
  registrationLink?: string;
  imageUrl?: string;
}

export interface SpecialEventsEmailData extends BaseEmailData {
  mainTitle: string;
  introduction: string;
  events: EventDetails[];
  conclusion?: string;
  contactVariables?: ContactVariables;
}

/**
 * Process template variables in a string
 * Replaces {variable.name} with actual values from the variables object
 */
export function processTemplateVariables(
  text: string,
  variables: ContactVariables
): string {
  if (!text) return '';
  
  return text.replace(/\{([^}]+)\}/g, (match, key) => {
    const keys = key.split('.');
    let value: any = variables;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return match; // Keep original placeholder if variable not found
      }
    }
    
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Process all template variables in an object recursively
 */
export function processAllTemplateVariables(
  data: any,
  variables: ContactVariables
): any {
  if (!data) return data;
  
  if (typeof data === 'string') {
    return processTemplateVariables(data, variables);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => processAllTemplateVariables(item, variables));
  }
  
  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const key in data) {
      result[key] = processAllTemplateVariables(data[key], variables);
    }
    return result;
  }
  
  return data;
}

/**
 * Generate HTML for product updates email
 */
export function generateProductUpdatesHTML(data: ProductUpdatesEmailData): string {
  let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${data.subject || 'Knotie-AI Pro Product Updates'}</title>
    <style type="text/css">
      /* Basic resets for email clients */
      body {
        margin: 0;
        padding: 0;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
        font-family: Arial, sans-serif;
        background-color: #1a1a1a;
        color: #ffffff;
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
        max-width: 100%;
      }
      .section {
        margin-bottom: 30px;
        padding: 20px;
        background-color: #2a2a2a;
        border-radius: 8px;
      }
      .section-title {
        color: #5ab0e2;
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 15px;
      }
      .section-content {
        color: #ffffff;
        font-size: 16px;
        line-height: 24px;
      }
    </style>
  </head>
  <body style="background-color: #1a1a1a; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: Arial, Helvetica, sans-serif;">
    <!-- Main Container -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%;">
      <tr>
        <td align="center" valign="top">
          <!-- Content Container -->
          <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #1a1a1a; color: #ffffff;">
            <!-- Header -->
            <tr>
              <td align="center" style="padding: 30px 0 20px 0; border-bottom: 1px solid #333333;">
                <!-- Logo Text-based Version -->
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="text-align: center; color: #ffffff; font-size: 24px; font-weight: bold;">
                      <span style="color: #5ab0e2;">K</span>notie-AI <span style="color: #2dd4bf; font-size: 16px;">Pro</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            
            <!-- Main Content -->
            <tr>
              <td style="padding: 40px 30px;">
                <!-- Heading -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="color: #ffffff; font-size: 24px; font-weight: bold; padding-bottom: 10px;">
                      ${data.mainTitle}
                    </td>
                  </tr>
                </table>
                
                <!-- Introduction -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
                  <tr>
                    <td style="color: #ffffff; font-size: 16px; line-height: 24px;">
                      ${data.introduction}
                    </td>
                  </tr>
                </table>
  `;

  // Partner Features Section
  if (data.partnerFeatures && data.partnerFeatures.length > 0) {
    html += `
                <!-- Partner Features Section -->
                <div class="section">
                  <div class="section-title">Partner Features</div>
                  <div class="section-content">
    `;
    
    data.partnerFeatures.forEach(feature => {
      html += `
                    <h3 style="color: #ffffff; margin-top: 20px; margin-bottom: 10px;">${feature.title}</h3>
                    <p>${feature.details}</p>
                    ${feature.imageUrl ? `<img src="${feature.imageUrl}" alt="${feature.title}" style="max-width: 100%; margin: 10px 0; border-radius: 4px;">` : ''}
      `;
    });
    
    html += `
                  </div>
                </div>
    `;
  }

  // Customer Features Section
  if (data.customerFeatures && data.customerFeatures.length > 0) {
    html += `
                <!-- Customer Features Section -->
                <div class="section">
                  <div class="section-title">Customer Features</div>
                  <div class="section-content">
    `;
    
    data.customerFeatures.forEach(feature => {
      html += `
                    <h3 style="color: #ffffff; margin-top: 20px; margin-bottom: 10px;">${feature.title}</h3>
                    <p>${feature.details}</p>
                    ${feature.imageUrl ? `<img src="${feature.imageUrl}" alt="${feature.title}" style="max-width: 100%; margin: 10px 0; border-radius: 4px;">` : ''}
      `;
    });
    
    html += `
                  </div>
                </div>
    `;
  }

  // Platform Updates Section
  if (data.platformUpdates && data.platformUpdates.length > 0) {
    html += `
                <!-- Platform Updates Section -->
                <div class="section">
                  <div class="section-title">Platform Updates</div>
                  <div class="section-content">
    `;
    
    data.platformUpdates.forEach(update => {
      html += `
                    <h3 style="color: #ffffff; margin-top: 20px; margin-bottom: 10px;">${update.title}</h3>
                    <p>${update.details}</p>
                    ${update.imageUrl ? `<img src="${update.imageUrl}" alt="${update.title}" style="max-width: 100%; margin: 10px 0; border-radius: 4px;">` : ''}
      `;
    });
    
    html += `
                  </div>
                </div>
    `;
  }

  // Admin Updates Section
  if (data.adminUpdates && data.adminUpdates.length > 0) {
    html += `
                <!-- Admin Updates Section -->
                <div class="section">
                  <div class="section-title">Admin Updates</div>
                  <div class="section-content">
    `;
    
    data.adminUpdates.forEach(update => {
      html += `
                    <h3 style="color: #ffffff; margin-top: 20px; margin-bottom: 10px;">${update.title}</h3>
                    <p>${update.details}</p>
                    ${update.imageUrl ? `<img src="${update.imageUrl}" alt="${update.title}" style="max-width: 100%; margin: 10px 0; border-radius: 4px;">` : ''}
      `;
    });
    
    html += `
                  </div>
                </div>
    `;
  }

  // Events Section
  if (data.events && data.events.length > 0) {
    html += `
                <!-- Events Section -->
                <div class="section">
                  <div class="section-title">Interesting Events</div>
                  <div class="section-content">
    `;
    
    data.events.forEach(event => {
      html += `
                    <h3 style="color: #ffffff; margin-top: 20px; margin-bottom: 10px;">${event.title}</h3>
                    <p>${event.details}</p>
                    ${event.imageUrl ? `<img src="${event.imageUrl}" alt="${event.title}" style="max-width: 100%; margin: 10px 0; border-radius: 4px;">` : ''}
      `;
    });
    
    html += `
                  </div>
                </div>
    `;
  }

  // Conclusion
  if (data.conclusion) {
    html += `
                <!-- Conclusion -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 30px;">
                  <tr>
                    <td style="color: #ffffff; font-size: 16px; line-height: 24px;">
                      ${data.conclusion}
                    </td>
                  </tr>
                </table>
    `;
  }

  // Footer
  html += `
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td align="center" style="padding: 20px 30px; border-top: 1px solid #333333; color: #888888; font-size: 14px; line-height: 20px;">
                <p style="margin: 0 0 10px 0;">© 2025 Knotie-AI Pro. All rights reserved.</p>
                <p style="margin: 0;">
                  <a href="https://knotie-ai.pro/privacy-policy" style="color: #5ab0e2; text-decoration: none;">Privacy Policy</a> | 
                  <a href="https://knotie-ai.pro/terms" style="color: #5ab0e2; text-decoration: none;">Terms of Service</a> | 
                  <a href="{{unsubscribe}}" style="color: #5ab0e2; text-decoration: none;">Unsubscribe</a>
                </p>
              </td>
            </tr>
            
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  return html;
}

/**
 * Generate HTML for special events email
 */
export function generateSpecialEventsHTML(data: SpecialEventsEmailData): string {
  let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${data.subject || 'Knotie-AI Pro Special Events'}</title>
    <style type="text/css">
      /* Basic resets for email clients */
      body {
        margin: 0;
        padding: 0;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
        font-family: Arial, sans-serif;
        background-color: #1a1a1a;
        color: #ffffff;
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
        max-width: 100%;
      }
      .event-card {
        margin-bottom: 30px;
        padding: 20px;
        background-color: #2a2a2a;
        border-radius: 8px;
      }
      .event-title {
        color: #5ab0e2;
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 10px;
      }
      .event-meta {
        color: #aaaaaa;
        font-size: 14px;
        margin-bottom: 15px;
      }
      .event-description {
        color: #ffffff;
        font-size: 16px;
        line-height: 24px;
        margin-bottom: 15px;
      }
      .event-button {
        display: inline-block;
        background-color: #4294d0;
        color: #ffffff;
        text-decoration: none;
        padding: 10px 20px;
        border-radius: 4px;
        font-weight: bold;
      }
    </style>
  </head>
  <body style="background-color: #1a1a1a; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: Arial, Helvetica, sans-serif;">
    <!-- Main Container -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%;">
      <tr>
        <td align="center" valign="top">
          <!-- Content Container -->
          <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #1a1a1a; color: #ffffff;">
            <!-- Header -->
            <tr>
              <td align="center" style="padding: 30px 0 20px 0; border-bottom: 1px solid #333333;">
                <!-- Logo Text-based Version -->
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="text-align: center; color: #ffffff; font-size: 24px; font-weight: bold;">
                      <span style="color: #5ab0e2;">K</span>notie-AI <span style="color: #2dd4bf; font-size: 16px;">Pro</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            
            <!-- Main Content -->
            <tr>
              <td style="padding: 40px 30px;">
                <!-- Heading -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="color: #ffffff; font-size: 24px; font-weight: bold; padding-bottom: 10px;">
                      ${data.mainTitle}
                    </td>
                  </tr>
                </table>
                
                <!-- Introduction -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
                  <tr>
                    <td style="color: #ffffff; font-size: 16px; line-height: 24px;">
                      ${data.introduction}
                    </td>
                  </tr>
                </table>
  `;

  // Events
  data.events.forEach(event => {
    html += `
                <!-- Event Card -->
                <div class="event-card">
                  <div class="event-title">${event.title}</div>
                  <div class="event-meta">
                    ${event.date}${event.time ? ` at ${event.time}` : ''}
                    ${event.location ? ` • ${event.location}` : ''}
                  </div>
                  ${event.imageUrl ? `<img src="${event.imageUrl}" alt="${event.title}" style="max-width: 100%; margin-bottom: 15px; border-radius: 4px;">` : ''}
                  <div class="event-description">${event.description}</div>
                  ${event.registrationLink ? `<a href="${event.registrationLink}" class="event-button">Register Now</a>` : ''}
                </div>
    `;
  });

  // Conclusion
  if (data.conclusion) {
    html += `
                <!-- Conclusion -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 30px;">
                  <tr>
                    <td style="color: #ffffff; font-size: 16px; line-height: 24px;">
                      ${data.conclusion}
                    </td>
                  </tr>
                </table>
    `;
  }

  // Footer
  html += `
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td align="center" style="padding: 20px 30px; border-top: 1px solid #333333; color: #888888; font-size: 14px; line-height: 20px;">
                <p style="margin: 0 0 10px 0;">© 2025 Knotie-AI Pro. All rights reserved.</p>
                <p style="margin: 0;">
                  <a href="https://knotie-ai.pro/privacy-policy" style="color: #5ab0e2; text-decoration: none;">Privacy Policy</a> | 
                  <a href="https://knotie-ai.pro/terms" style="color: #5ab0e2; text-decoration: none;">Terms of Service</a> | 
                  <a href="{{unsubscribe}}" style="color: #5ab0e2; text-decoration: none;">Unsubscribe</a>
                </p>
              </td>
            </tr>
            
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  return html;
}
