import { ReportData, ReportMetric } from '@/types/customerReport';

/**
 * Formats duration from seconds to human-readable format (e.g., "5m 30s")
 */
function formatDuration(seconds: number): string {
  if (seconds === 0) return '0s';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  if (minutes === 0) return `${remainingSeconds}s`;
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Formats percentage to one decimal place (e.g., "85.5%")
 */
function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Generates a responsive HTML email template for customer analytics reports
 * Works in Gmail, Outlook, Apple Mail, and other major email clients
 */
export function generateReportEmailTemplate(
  data: ReportData,
  includedMetrics: ReportMetric[]
): string {
  const { partnerBusinessName, customerName, period, agents, totals, frequency } = data;
  
  // Determine report title based on frequency
  const reportTitle = frequency === 'instant' 
    ? 'Analytics Report' 
    : frequency === 'daily' 
    ? 'Daily Analytics Report' 
    : 'Weekly Analytics Report';
  
  // Format period dates
  const startDate = new Date(period.startDate).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const endDate = new Date(period.endDate).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const periodText = startDate === endDate ? startDate : `${startDate} – ${endDate}`;
  
  // Build table headers based on included metrics
  const headers: string[] = [];
  if (includedMetrics.includes('agentName')) headers.push('Agent');
  if (includedMetrics.includes('totalCalls')) headers.push('Calls');
  if (includedMetrics.includes('totalDuration')) headers.push('Duration');
  if (includedMetrics.includes('avgDuration')) headers.push('Avg');
  if (includedMetrics.includes('successRate')) headers.push('Success');
  if (includedMetrics.includes('failureRate')) headers.push('Failure');
  
  // Build agent rows
  const agentRows = agents.map(agent => {
    const cells: string[] = [];
    if (includedMetrics.includes('agentName')) {
      cells.push(`<td class="cell cell-name" style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-weight: 500; font-size: 13px;">${agent.agentName}</td>`);
    }
    if (includedMetrics.includes('totalCalls')) {
      cells.push(`<td class="cell" style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #4b5563; font-size: 13px;">${agent.totalCalls}</td>`);
    }
    if (includedMetrics.includes('totalDuration')) {
      cells.push(`<td class="cell" style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #4b5563; font-size: 13px;">${formatDuration(agent.totalDuration)}</td>`);
    }
    if (includedMetrics.includes('avgDuration')) {
      cells.push(`<td class="cell" style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #4b5563; font-size: 13px;">${formatDuration(agent.avgDuration)}</td>`);
    }
    if (includedMetrics.includes('successRate')) {
      cells.push(`<td class="cell" style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #059669; font-size: 13px;">${formatPercentage(agent.successRate)}</td>`);
    }
    if (includedMetrics.includes('failureRate')) {
      cells.push(`<td class="cell" style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #dc2626; font-size: 13px;">${formatPercentage(agent.failureRate)}</td>`);
    }
    return `<tr>${cells.join('')}</tr>`;
  }).join('');
  
  // Build totals row
  const totalCells: string[] = [];
  if (includedMetrics.includes('agentName')) {
    totalCells.push(`<td class="cell cell-name" style="padding: 10px 8px; border-top: 2px solid #9ca3af; color: #1f2937; font-weight: 700; font-size: 13px;">Total</td>`);
  }
  if (includedMetrics.includes('totalCalls')) {
    totalCells.push(`<td class="cell" style="padding: 10px 8px; border-top: 2px solid #9ca3af; text-align: right; color: #1f2937; font-weight: 700; font-size: 13px;">${totals.totalCalls}</td>`);
  }
  if (includedMetrics.includes('totalDuration')) {
    totalCells.push(`<td class="cell" style="padding: 10px 8px; border-top: 2px solid #9ca3af; text-align: right; color: #1f2937; font-weight: 700; font-size: 13px;">${formatDuration(totals.totalDuration)}</td>`);
  }
  if (includedMetrics.includes('avgDuration')) {
    totalCells.push(`<td class="cell" style="padding: 10px 8px; border-top: 2px solid #9ca3af; text-align: right; color: #1f2937; font-weight: 700; font-size: 13px;">${formatDuration(totals.avgDuration)}</td>`);
  }
  if (includedMetrics.includes('successRate')) {
    totalCells.push(`<td class="cell" style="padding: 10px 8px; border-top: 2px solid #9ca3af; text-align: right; color: #059669; font-weight: 700; font-size: 13px;">${formatPercentage(totals.successRate)}</td>`);
  }
  if (includedMetrics.includes('failureRate')) {
    totalCells.push(`<td class="cell" style="padding: 10px 8px; border-top: 2px solid #9ca3af; text-align: right; color: #dc2626; font-weight: 700; font-size: 13px;">${formatPercentage(totals.failureRate)}</td>`);
  }
  
  // Build header cells HTML
  const headerCells = headers.map(header => 
    `<th class="cell" style="padding: 10px 8px; border-bottom: 2px solid #d1d5db; text-align: ${header === 'Agent' ? 'left' : 'right'}; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">${header}</th>`
  ).join('');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${reportTitle}</title>
  <style>
    @media only screen and (max-width: 480px) {
      .outer-pad { padding: 16px 8px !important; }
      .header-pad { padding: 24px 16px 16px 16px !important; }
      .header-pad h1 { font-size: 20px !important; }
      .greeting-pad { padding: 16px 16px 8px 16px !important; }
      .table-pad { padding: 0 12px 24px 12px !important; }
      .footer-pad { padding: 0 12px 24px 12px !important; }
      .cell { padding: 6px 4px !important; font-size: 11px !important; }
      .cell-name { max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }
  </style>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    .cell { padding: 8px !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb;">
    <tr>
      <td class="outer-pad" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td class="header-pad" style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: 700; line-height: 1.2;">${reportTitle}</h1>
              <p style="margin: 0; color: #e0e7ff; font-size: 14px;">${periodText}</p>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td class="greeting-pad" style="padding: 24px 32px 16px 32px;">
              <p style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px; line-height: 1.5;">Hello ${customerName},</p>
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">Here's your analytics summary from ${partnerBusinessName}.</p>
            </td>
          </tr>
          
          <!-- Analytics Table -->
          <tr>
            <td class="table-pad" style="padding: 0 32px 32px 32px;">
              <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; min-width: 320px;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    ${headerCells}
                  </tr>
                </thead>
                <tbody>
                  ${agentRows}
                  <tr>
                    ${totalCells.join('')}
                  </tr>
                </tbody>
              </table>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="footer-pad" style="padding: 0 32px 32px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 16px 0 0 0; color: #9ca3af; font-size: 12px; line-height: 1.5; text-align: center;">
                This report was automatically generated by ${partnerBusinessName}.<br>
                Generated on ${new Date(data.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' })}
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
