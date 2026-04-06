interface SupportTicketConfirmationProps {
  partnerName: string;
  supportId: string;
  subject: string;
  details: string;
  context: string;
  timestamp: string;
}

export function generateSupportTicketConfirmationHTML(props: SupportTicketConfirmationProps): string {
  const {
    partnerName,
    supportId,
    subject,
    details,
    context,
    timestamp
  } = props;

  const primaryColor = '#3B82F6';
  const secondaryColor = '#10B981';
  const logo = `${process.env.NEXT_PUBLIC_APP_URL || 'https://knotie-ai.pro'}/Knotie_logo.svg`;

  // Format timestamp
  const formattedDate = new Date(timestamp).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  // Context display mapping
  const contextDisplay = {
    'credits': 'Credits & Billing',
    'billing': 'Billing & Payments',
    'telephony': 'Telephony & Phone Numbers',
    'general': 'General Support'
  };

  const contextName = contextDisplay[context as keyof typeof contextDisplay] || 'General Support';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Support Ticket Confirmation - ${supportId}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f8fafc;
      color: #334155;
      line-height: 1.6;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .header {
      background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%);
      padding: 40px 30px;
      text-align: center;
      color: white;
    }
    
    .logo {
      max-width: 120px;
      height: auto;
      margin-bottom: 20px;
    }
    
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .header p {
      margin: 10px 0 0 0;
      font-size: 16px;
      opacity: 0.9;
    }
    
    .content {
      padding: 40px 30px;
    }
    
    .ticket-info {
      background-color: #f1f5f9;
      border-left: 4px solid ${primaryColor};
      padding: 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    
    .ticket-id {
      font-size: 18px;
      font-weight: 700;
      color: ${primaryColor};
      margin-bottom: 10px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .info-row:last-child {
      border-bottom: none;
    }
    
    .info-label {
      font-weight: 600;
      color: #64748b;
      min-width: 100px;
    }
    
    .info-value {
      color: #334155;
      text-align: right;
      flex: 1;
      margin-left: 20px;
    }
    
    .details-section {
      margin: 30px 0;
    }
    
    .details-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 15px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
    }
    
    .details-content {
      background-color: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    .next-steps {
      background-color: #ecfdf5;
      border: 1px solid #d1fae5;
      border-radius: 8px;
      padding: 20px;
      margin: 30px 0;
    }
    
    .next-steps h3 {
      color: #065f46;
      margin: 0 0 15px 0;
      font-size: 16px;
    }
    
    .next-steps ul {
      margin: 0;
      padding-left: 20px;
      color: #047857;
    }
    
    .next-steps li {
      margin-bottom: 8px;
    }
    
    .footer {
      background-color: #f8fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    
    .footer p {
      margin: 0 0 10px 0;
      color: #64748b;
      font-size: 14px;
    }
    
    .contact-info {
      color: ${primaryColor};
      font-weight: 600;
    }
    
    .divider {
      height: 1px;
      background: linear-gradient(to right, transparent, #e2e8f0, transparent);
      margin: 30px 0;
    }
    
    @media (max-width: 600px) {
      .container {
        margin: 0;
        border-radius: 0;
      }
      
      .header, .content, .footer {
        padding: 20px;
      }
      
      .info-row {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .info-value {
        text-align: left;
        margin-left: 0;
        margin-top: 5px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logo}" alt="Knotie AI Pro" class="logo">
      <h1>Support Ticket Created</h1>
      <p>We've received your support request and will get back to you soon!</p>
    </div>
    
    <div class="content">
      <p>Hello <strong>${partnerName}</strong>,</p>
      
      <p>Thank you for contacting Knotie AI Pro support. We've successfully created your support ticket and our team will review it shortly.</p>
      
      <div class="ticket-info">
        <div class="ticket-id">Ticket ID: ${supportId}</div>
        <div class="info-row">
          <span class="info-label">Category:</span>
          <span class="info-value">${contextName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Subject:</span>
          <span class="info-value">${subject}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Created:</span>
          <span class="info-value">${formattedDate}</span>
        </div>
      </div>
      
      <div class="details-section">
        <div class="details-title">Your Message</div>
        <div class="details-content">${details}</div>
      </div>
      
      <div class="next-steps">
        <h3>🚀 What happens next?</h3>
        <ul>
          <li><strong>Acknowledgment:</strong> You'll receive this confirmation email immediately</li>
          <li><strong>Review:</strong> Our support team will review your request within 24-48 hours</li>
          <li><strong>Response:</strong> We'll respond with a solution or follow-up questions within 48-72 hours</li>
          <li><strong>Resolution:</strong> We'll work with you until your issue is fully resolved</li>
        </ul>
      </div>
      
      <div class="divider"></div>
      
      <p><strong>Need urgent assistance?</strong> If this is a critical issue affecting your production systems, please contact us directly at <a href="mailto:support@knotie-ai.pro" style="color: ${primaryColor};">support@knotie-ai.pro</a>.</p>
      
      <p>Please keep this ticket ID (<strong>${supportId}</strong>) for your records and reference it in any follow-up communications.</p>
    </div>
    
    <div class="footer">
      <p>Best regards,<br><strong>Knotie AI Pro Support Team</strong></p>
      <p class="contact-info">support@knotie-ai.pro</p>
      <p>© ${new Date().getFullYear()} Knotie AI Pro. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}
