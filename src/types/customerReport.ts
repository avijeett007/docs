/**
 * Customer Report Generation Types
 * Shared types used across frontend, API routes, and KnotieManager
 */

// --- Enums / Unions ---
export type ReportFrequency = 'none' | 'daily' | 'weekly';
export type ReportPeriod = 'day' | 'week';
export type ReportMetric = 'agentName' | 'totalCalls' | 'totalDuration' | 'avgDuration' | 'successRate' | 'failureRate';

// All available metrics for the UI checkboxes
export const ALL_REPORT_METRICS: { key: ReportMetric; label: string }[] = [
  { key: 'agentName', label: 'Active Agent Name' },
  { key: 'totalCalls', label: 'Number of Calls' },
  { key: 'totalDuration', label: 'Total Duration' },
  { key: 'avgDuration', label: 'Average Duration' },
  { key: 'successRate', label: 'Call Success Rate' },
  { key: 'failureRate', label: 'Call Failure Rate' },
];

// --- API Request/Response Types ---
export interface ReportConfigResponse {
  id: string;
  customerId: string;
  partnerId: string;
  frequency: ReportFrequency;
  includedMetrics: ReportMetric[];
  isEnabled: boolean;
  lastSentAt: string | null;
  nextScheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateReportConfigRequest {
  frequency: ReportFrequency;
  includedMetrics: ReportMetric[];
  isEnabled: boolean;
}

export interface SendInstantReportRequest {
  period: ReportPeriod;
}

// --- Report Data (stored in DB as JSON, used in email template) ---
export interface AgentReportData {
  agentName: string;
  provider: string;
  totalCalls: number;
  totalDuration: number;   // seconds
  avgDuration: number;     // seconds
  successRate: number;     // percentage 0-100
  failureRate: number;     // percentage 0-100
}

export interface ReportData {
  customerName: string;
  customerEmail: string;
  partnerBusinessName: string;
  period: { startDate: string; endDate: string };
  frequency: ReportFrequency | 'instant';
  agents: AgentReportData[];
  totals: {
    totalCalls: number;
    totalDuration: number;
    avgDuration: number;
    successRate: number;
    failureRate: number;
  };
  generatedAt: string;
}

export interface ReportLogEntry {
  id: string;
  reportType: 'instant' | 'scheduled';
  period: ReportPeriod;
  reportData: ReportData;
  sentAt: string;
  emailStatus: 'sent' | 'failed';
}

export interface ReportLogsResponse {
  logs: ReportLogEntry[];
  total: number;
}
