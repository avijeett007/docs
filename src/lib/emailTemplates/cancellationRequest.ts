interface CancellationRequestEmailData {
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  invoiceTitle: string;
  invoiceAmount: number;
  currency: string;
  reason: string;
  requestId: string;
  partnerBusinessName: string;
  branding?: {
    businessName: string;
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    portalTitle?: string;
  };
}

/**
 * Generate HTML email for partner notification about cancellation request
 */
export function generatePartnerCancellationNotificationHTML(data: CancellationRequestEmailData): string {
  const primaryColor = data.branding?.primaryColor || '#3B82F6';
  const logoUrl = data.branding?.logo || `${process.env.NEXT_PUBLIC_APP_URL || 'https://knotie-ai.pro'}/Knotie_logo.svg`;
  const fontFamily = data.branding?.fontFamily || 'Arial, sans-serif';
  const formattedAmount = `${data.currency.toUpperCase()} ${(data.invoiceAmount / 100).toFixed(2)}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cancellation Request - ${data.invoiceNumber}</title>
  <style>
    body {
      font-family: ${fontFamily};
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f8f9fa;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #eee;
    }
    .logo {
      max-width: 150px;
      height: auto;
      margin-bottom: 20px;
    }
    .title {
      color: ${primaryColor};
      font-size: 24px;
      font-weight: bold;
      margin: 0;
    }
    .alert-box {
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 6px;
      padding: 15px;
      margin: 20px 0;
    }
    .alert-title {
      color: #856404;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin: 20px 0;
    }
    .info-item {
      background-color: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      border-left: 4px solid ${primaryColor};
    }
    .info-label {
      font-weight: bold;
      color: #666;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .info-value {
      color: #333;
      font-size: 14px;
    }
    .reason-box {
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 15px;
      margin: 20px 0;
    }
    .reason-title {
      font-weight: bold;
      color: #333;
      margin-bottom: 10px;
    }
    .reason-text {
      color: #666;
      font-style: italic;
      line-height: 1.5;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="Logo" class="logo">
      <h1 class="title">Cancellation Request Received</h1>
    </div>

    <div class="alert-box">
      <div class="alert-title">⚠️ Action Required</div>
      <p>A customer has requested to cancel their recurring invoice. Please review the details below and take appropriate action.</p>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Customer</div>
        <div class="info-value">${data.customerName}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Email</div>
        <div class="info-value">${data.customerEmail}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Invoice #</div>
        <div class="info-value">${data.invoiceNumber}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Amount</div>
        <div class="info-value">${formattedAmount}</div>
      </div>
    </div>

    <div class="info-item" style="margin: 20px 0;">
      <div class="info-label">Invoice Title</div>
      <div class="info-value">${data.invoiceTitle}</div>
    </div>

    <div class="reason-box">
      <div class="reason-title">Cancellation Reason:</div>
      <div class="reason-text">"${data.reason}"</div>
    </div>

    <p><strong>Request ID:</strong> ${data.requestId}</p>
    
    <p>Please log into your partner portal to review this cancellation request and take appropriate action. You can approve or deny the request, and communicate directly with the customer if needed.</p>

    <div class="footer">
      <p>This is an automated notification from Knotie AI Pro</p>
      <p>© ${new Date().getFullYear()} ${data.partnerBusinessName}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate HTML email for customer confirmation of cancellation request
 */
export function generateCustomerCancellationConfirmationHTML(data: CancellationRequestEmailData): string {
  const primaryColor = data.branding?.primaryColor || '#3B82F6';
  const logoUrl = data.branding?.logo || `${process.env.NEXT_PUBLIC_APP_URL || 'https://knotie-ai.pro'}/Knotie_logo.svg`;
  const fontFamily = data.branding?.fontFamily || 'Arial, sans-serif';
  const portalTitle = data.branding?.portalTitle || `${data.partnerBusinessName} Portal`;
  const formattedAmount = `${data.currency.toUpperCase()} ${(data.invoiceAmount / 100).toFixed(2)}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cancellation Request Submitted</title>
  <style>
    body {
      font-family: ${fontFamily};
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f8f9fa;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #eee;
    }
    .logo {
      max-width: 150px;
      height: auto;
      margin-bottom: 20px;
    }
    .title {
      color: ${primaryColor};
      font-size: 24px;
      font-weight: bold;
      margin: 0;
    }
    .success-box {
      background-color: #d4edda;
      border: 1px solid #c3e6cb;
      border-radius: 6px;
      padding: 15px;
      margin: 20px 0;
    }
    .success-title {
      color: #155724;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .info-box {
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 15px;
      margin: 20px 0;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="Logo" class="logo">
      <h1 class="title">Cancellation Request Submitted</h1>
    </div>

    <div class="success-box">
      <div class="success-title">✅ Request Received</div>
      <p>Your cancellation request has been successfully submitted and is now being reviewed.</p>
    </div>

    <p>Hello ${data.customerName},</p>
    
    <p>We have received your request to cancel the following recurring invoice:</p>

    <div class="info-box">
      <p><strong>Invoice:</strong> ${data.invoiceNumber} - ${data.invoiceTitle}</p>
      <p><strong>Amount:</strong> ${formattedAmount}</p>
      <p><strong>Request ID:</strong> ${data.requestId}</p>
    </div>

    <p><strong>Your reason for cancellation:</strong></p>
    <div class="info-box">
      <em>"${data.reason}"</em>
    </div>

    <p>Your request is now being reviewed by our team. We will contact you within 1-2 business days with an update on your cancellation request.</p>
    
    <p>If you have any questions or need immediate assistance, please don't hesitate to contact us.</p>

    <p>Thank you for your understanding.</p>

    <div class="footer">
      <p>Best regards,<br>The ${data.partnerBusinessName} Team</p>
      <p>© ${new Date().getFullYear()} ${data.partnerBusinessName}</p>
    </div>
  </div>
</body>
</html>`;
}
