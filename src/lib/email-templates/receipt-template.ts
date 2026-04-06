interface ReceiptData {
  customerName: string;
  customerEmail: string;
  businessName: string;
  amount: number;
  couponCode: string;
  couponName: string;
  transactionId: string;
  invoiceNumber?: string;
  date: string;
  receiptUrl?: string;
  invoiceUrl?: string;
}

export function generateReceiptHTML(data: ReceiptData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Receipt - Knotie AI Pro</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e2e8f0;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #3b82f6;
            margin-bottom: 10px;
        }
        .receipt-title {
            font-size: 24px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 10px;
        }
        .success-badge {
            display: inline-block;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 20px;
        }
        .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 30px 0;
        }
        .detail-item {
            padding: 15px;
            background: #f8fafc;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
        }
        .detail-label {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 5px;
        }
        .detail-value {
            font-size: 16px;
            color: #1e293b;
            font-weight: 600;
        }
        .amount-section {
            text-align: center;
            margin: 40px 0;
            padding: 30px;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            border-radius: 12px;
            color: white;
        }
        .amount {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .coupon-info {
            background: linear-gradient(135deg, #10b981, #059669);
            padding: 20px;
            border-radius: 8px;
            color: white;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 14px;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 10px;
        }
        .features {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .feature-list {
            list-style: none;
            padding: 0;
        }
        .feature-list li {
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
        }
        .feature-list li:last-child {
            border-bottom: none;
        }
        .feature-list li:before {
            content: "✅";
            margin-right: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎯 Knotie AI Pro</div>
            <div class="receipt-title">Payment Receipt</div>
            <div class="success-badge">✅ Payment Successful</div>
        </div>

        <div class="amount-section">
            <div class="amount">$${data.amount.toFixed(2)}</div>
            <div>Lifetime Access - One-time Payment</div>
        </div>

        <div class="coupon-info">
            <h3 style="margin: 0 0 10px 0;">🎉 Special Offer Applied</h3>
            <p style="margin: 0;"><strong>${data.couponName}</strong> (${data.couponCode})</p>
        </div>

        <div class="details-grid">
            <div class="detail-item">
                <div class="detail-label">Customer</div>
                <div class="detail-value">${data.businessName}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Email</div>
                <div class="detail-value">${data.customerEmail}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Transaction ID</div>
                <div class="detail-value">${data.transactionId}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Date</div>
                <div class="detail-value">${data.date}</div>
            </div>
        </div>

        <div class="features">
            <h3>🚀 Your Lifetime Access Includes:</h3>
            <ul class="feature-list">
                <li>Unlimited AI Voice Agents</li>
                <li>Multi-Provider Support (VAPI, Retell, Ultravox)</li>
                <li>White-label Partner Portal</li>
                <li>Customer Management System</li>
                <li>Analytics & Reporting</li>
                <li>API Access & Webhooks</li>
                <li>Priority Support</li>
                <li>All Future Updates</li>
            </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/partner/login" class="button">
                🎯 Access Your Dashboard
            </a>
            ${data.invoiceUrl ? `<a href="${data.invoiceUrl}" class="button">📄 Download Invoice</a>` : ''}
        </div>

        <div class="footer">
            <p><strong>Thank you for choosing Knotie AI Pro!</strong></p>
            <p>Your lifetime access is now active. Start building amazing AI voice experiences today.</p>
            <p>Need help? Contact us at <a href="mailto:support@knotie-ai.pro">support@knotie-ai.pro</a></p>
            <p style="margin-top: 20px; font-size: 12px;">
                This receipt was generated automatically. Please keep it for your records.<br>
                Knotie AI Pro - Powered by SONTI LTD
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

export function generateReceiptText(data: ReceiptData): string {
  return `
KNOTIE AI PRO - PAYMENT RECEIPT
===============================

✅ PAYMENT SUCCESSFUL

Amount Paid: $${data.amount.toFixed(2)}
Product: Knotie AI Pro - Lifetime Access
Special Offer: ${data.couponName} (${data.couponCode})

CUSTOMER DETAILS:
- Business Name: ${data.businessName}
- Email: ${data.customerEmail}
- Transaction ID: ${data.transactionId}
- Date: ${data.date}

YOUR LIFETIME ACCESS INCLUDES:
✅ Unlimited AI Voice Agents
✅ Multi-Provider Support (VAPI, Retell, Ultravox)
✅ White-label Partner Portal
✅ Customer Management System
✅ Analytics & Reporting
✅ API Access & Webhooks
✅ Priority Support
✅ All Future Updates

NEXT STEPS:
🎯 Access your dashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/partner/login

Thank you for choosing Knotie AI Pro!
Your lifetime access is now active.

Need help? Contact us at support@knotie-ai.pro

---
This receipt was generated automatically.
Knotie AI Pro - Powered by SONTI LTD
  `;
}
