/**
 * Marketing Welcome Email Template
 * 
 * This template is used for partners who sign up through marketing funnels
 * and may have different onboarding flows than regular signups.
 */

interface MarketingWelcomeProps {
  businessName: string;
  password?: string;
  couponCode?: string;
  couponName?: string;
  lifetimeOffer?: boolean;
  lifetimeOfferPrice?: number;
  originalPrice?: number;
  nextSteps: string[];
  redirectUrl?: string;
  source?: string;
  campaignId?: string;
}

export function generateMarketingWelcomeHTML(props: MarketingWelcomeProps): string {
  const {
    businessName,
    password,
    couponCode,
    couponName,
    lifetimeOffer,
    lifetimeOfferPrice,
    originalPrice,
    nextSteps,
    redirectUrl,
    source,
    campaignId
  } = props;

  const primaryColor = '#3B82F6';
  const secondaryColor = '#10B981';
  const logo = `${process.env.NEXT_PUBLIC_APP_URL || 'https://knotie-ai.pro'}/Knotie_logo.svg`;

  // Calculate savings if lifetime offer
  const savings = lifetimeOffer && lifetimeOfferPrice && originalPrice 
    ? originalPrice - lifetimeOfferPrice 
    : 0;
  const savingsPercentage = savings && originalPrice 
    ? Math.round((savings / originalPrice) * 100) 
    : 0;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Knotie AI Pro - ${businessName}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background-color: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .logo {
          max-width: 150px;
          height: auto;
          margin-bottom: 20px;
          filter: brightness(0) invert(1);
        }
        .content {
          padding: 30px;
        }
        .welcome-badge {
          background: linear-gradient(135deg, #f59e0b, #ef4444);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          display: inline-block;
          margin-bottom: 20px;
        }
        .coupon-box {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: center;
        }
        .coupon-code {
          font-family: 'Courier New', monospace;
          font-size: 18px;
          font-weight: bold;
          background: rgba(255, 255, 255, 0.2);
          padding: 8px 16px;
          border-radius: 4px;
          display: inline-block;
          margin: 10px 0;
        }
        .lifetime-offer {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: white;
          padding: 25px;
          border-radius: 12px;
          margin: 25px 0;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .lifetime-offer::before {
          content: '🎉';
          position: absolute;
          top: 10px;
          right: 15px;
          font-size: 24px;
        }
        .price-display {
          font-size: 32px;
          font-weight: bold;
          margin: 15px 0;
        }
        .original-price {
          text-decoration: line-through;
          color: rgba(255, 255, 255, 0.7);
          font-size: 18px;
          margin-right: 10px;
        }
        .savings {
          background: #ef4444;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }
        .next-steps {
          background: #f1f5f9;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .step {
          display: flex;
          align-items: flex-start;
          margin: 10px 0;
        }
        .step-number {
          background: ${primaryColor};
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          margin-right: 12px;
          flex-shrink: 0;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          text-align: center;
          margin: 20px 0;
          transition: transform 0.2s;
        }
        .cta-button:hover {
          transform: translateY(-2px);
        }
        .credentials-box {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .footer {
          background: #f8fafc;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #64748b;
        }
        .metadata {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logo}" alt="Knotie AI Pro" class="logo">
          <h1 style="margin: 0; font-size: 28px;">Welcome to Knotie AI Pro!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your AI Voice Agent Platform</p>
        </div>
        
        <div class="content">
          <div class="welcome-badge">🎉 Welcome to Knotie AI Pro!</div>

          <h2>Hello ${businessName}!</h2>
          <p>🚀 <strong>Congratulations!</strong> You're now part of the Knotie AI Pro family! Get ready to transform your business with cutting-edge AI voice agents.</p>
          
          ${couponCode ? `
            <div class="coupon-box">
              <h3 style="margin: 0 0 10px 0;">🎫 Coupon Applied Successfully!</h3>
              <div class="coupon-code">${couponCode}</div>
              ${couponName ? `<p style="margin: 10px 0 0 0; opacity: 0.9;">${couponName}</p>` : ''}
            </div>
          ` : ''}
          
          ${lifetimeOffer ? `
            <div class="lifetime-offer">
              <h3 style="margin: 0 0 15px 0;">🎉 Special Offer Available!</h3>
              <div class="price-display">
                ${originalPrice ? `<span class="original-price">$${originalPrice}</span>` : ''}
                ${lifetimeOfferPrice ? `$${lifetimeOfferPrice}` : 'Special Pricing'}
                ${savings > 0 ? `<span class="savings">Save $${savings} (${savingsPercentage}%)</span>` : ''}
              </div>
              <p style="margin: 15px 0 0 0; opacity: 0.9;">Take advantage of this exclusive offer while it lasts!</p>
            </div>
          ` : ''}
          
          ${password ? `
            <div class="credentials-box">
              <h3 style="margin: 0 0 15px 0; color: #92400e;">🔐 Your Access Credentials</h3>
              <p><strong>Email:</strong> Use the email address where you received this message</p>
              <p><strong>Password:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</code></p>
              <p style="font-size: 14px; color: #92400e; margin-top: 15px;">
                <strong>Security Tip:</strong> Please change your password after your first login to keep your account secure.
              </p>
            </div>
          ` : ''}
          
          <div class="next-steps">
            <h3 style="margin: 0 0 15px 0;">📋 What's Next?</h3>
            ${nextSteps.map((step, index) => `
              <div class="step">
                <div class="step-number">${index + 1}</div>
                <div>${step}</div>
              </div>
            `).join('')}
          </div>
          
          ${redirectUrl ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${redirectUrl}" class="cta-button">
                ${lifetimeOffer ? '🚀 Secure Your Lifetime Access' : '🎯 Launch Your AI Journey'}
              </a>
            </div>
          ` : ''}

          <p>🤝 <strong>We're here to help!</strong> If you have any questions or need assistance getting started, our expert support team is ready to guide you every step of the way.</p>
          
          <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>The Knotie AI Pro Team</strong>
          </p>
          

        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Knotie AI Pro. All rights reserved.</p>
          <p>🌟 Welcome to the future of AI-powered business automation!</p>
          <p>Need help? Contact us at <a href="mailto:support@knotie-ai.pro" style="color: ${primaryColor};">support@knotie-ai.pro</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}
