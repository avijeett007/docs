interface WelcomeEmailProps {
  customerName: string;
  partnerName: string;
  partnerContactName: string;
  portalUrl?: string;
  branding?: {
    businessName: string;
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    portalTitle?: string;
  };
}

export function generateWelcomeEmailHTML(props: WelcomeEmailProps): string {
  const {
    customerName,
    partnerName,
    partnerContactName,
    portalUrl = 'https://knotie-ai.pro',
    branding
  } = props;

  // Use branding if available, otherwise use defaults
  const businessName = branding?.businessName || partnerName;
  const primaryColor = branding?.primaryColor || '#3B82F6';
  const secondaryColor = branding?.secondaryColor || '#10B981';
  const fontFamily = branding?.fontFamily || 'Arial, sans-serif';
  const portalTitle = branding?.portalTitle || `${businessName} Portal`;
  const logo = branding?.logo || `${process.env.NEXT_PUBLIC_APP_URL || 'https://knotie-ai.pro'}/Knotie_logo.svg`;

  // Create a gradient style for buttons
  const buttonGradient = `background: linear-gradient(to right, ${primaryColor}, ${secondaryColor || primaryColor});`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ${portalTitle}</title>
      <style>
        body {
          font-family: ${fontFamily}, 'Helvetica Neue', Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f9f9f9;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          padding: 20px 0;
          border-bottom: 1px solid #eaeaea;
        }
        .logo {
          max-width: 150px;
          height: auto;
        }
        .content {
          padding: 30px 20px;
        }
        h1 {
          color: ${primaryColor};
          font-size: 24px;
          margin-top: 0;
          margin-bottom: 20px;
        }
        p {
          margin-bottom: 16px;
          font-size: 16px;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          ${buttonGradient}
          color: white;
          text-decoration: none;
          border-radius: 4px;
          font-weight: bold;
          margin: 20px 0;
          text-align: center;
        }
        .footer {
          text-align: center;
          padding-top: 20px;
          border-top: 1px solid #eaeaea;
          color: #888;
          font-size: 12px;
        }
        .highlight {
          color: ${primaryColor};
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logo}" alt="${businessName} Logo" class="logo">
        </div>
        <div class="content">
          <h1>Welcome to ${portalTitle}!</h1>
          <p>Hello ${customerName},</p>
          <p>Thank you for signing up! We're excited to have you on board.</p>
          <p>Your account has been successfully created and you now have access to all the features of our platform.</p>
          <p>You can log in to your account using the email address you registered with.</p>
          <div style="text-align: center;">
            <a href="${portalUrl}" class="button" style="display: inline-block; padding: 12px 24px; background: linear-gradient(to right, ${primaryColor}, ${secondaryColor || primaryColor}); color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; text-align: center; font-family: Arial, sans-serif;">Access Your Dashboard</a>
          </div>

          <!-- Fallback text link in case the button doesn't work -->
          <p style="text-align: center; margin-top: 10px; margin-bottom: 20px;">
            If the button doesn't work, copy and paste this link into your browser:
            <br>
            <a href="${portalUrl}" style="color: ${primaryColor}; text-decoration: underline; word-break: break-all;">${portalUrl}</a>
          </p>
          <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
          <p>Best regards,<br>${partnerContactName}<br>${businessName}</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
          <p>This email was sent to you because you signed up for an account on our platform.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
