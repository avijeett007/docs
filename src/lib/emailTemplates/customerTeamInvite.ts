interface CustomerTeamInviteTemplateData {
  inviteeName: string;
  customerName: string;
  inviteUrl: string;
  expiryHours: number;
  branding: {
    businessName: string;
    logo?: string;
    primaryColor: string;
    secondaryColor?: string;
    fontFamily?: string;
    portalTitle?: string;
  };
}

export function generateCustomerTeamInviteHTML(data: CustomerTeamInviteTemplateData): string {
  const portalTitle = data.branding.portalTitle || `${data.branding.businessName} Portal`;
  const logoUrl = data.branding.logo || `${process.env.NEXT_PUBLIC_APP_URL || 'https://knotie-ai.pro'}/Knotie_logo.svg`;
  const primaryColor = data.branding.primaryColor || '#3B82F6';
  const fontFamily = data.branding.fontFamily || 'Arial, sans-serif';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
  <style>
    body {
      font-family: ${fontFamily};
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      max-width: 150px;
      margin-bottom: 20px;
    }
    .content {
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 30px;
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      background-color: ${primaryColor};
      color: white;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-weight: bold;
      margin: 20px 0;
    }
    .footer {
      font-size: 12px;
      color: #666;
      text-align: center;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="${data.branding.businessName} Logo" class="logo">
      <h1>You've Been Invited to Join a Team</h1>
    </div>

    <div class="content">
      <p>Hello ${data.inviteeName},</p>

      <p>You have been invited by <strong>${data.customerName}</strong> to join their team on the ${portalTitle}.</p>

      <p>As a team member, you'll be able to help manage their AI communication services.</p>

      <p>Click the button below to accept the invitation and set up your account:</p>

      <div style="text-align: center;">
        <!-- Button with inline styles for maximum compatibility -->
        <a href="${data.inviteUrl}" class="button" style="display: inline-block; background-color: ${primaryColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold; margin: 20px 0; font-family: Arial, sans-serif;">Accept Invitation</a>
      </div>

      <!-- Fallback text link in case the button doesn't work -->
      <p style="text-align: center; margin-top: 10px; margin-bottom: 20px;">
        If the button doesn't work, copy and paste this link into your browser:
        <br>
        <a href="${data.inviteUrl}" style="color: ${primaryColor}; text-decoration: underline; word-break: break-all;">${data.inviteUrl}</a>
      </p>

      <p><strong>Note:</strong> This invitation will expire in ${data.expiryHours} hours.</p>
    </div>

    <div class="footer">
      <p>This email was sent from ${portalTitle}.</p>
      <p>© ${new Date().getFullYear()} ${data.branding.businessName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
