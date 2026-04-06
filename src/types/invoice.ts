// Invoice-related TypeScript types

export interface Invoice {
  id: string;
  invoiceNumber: string;
  title: string;
  description?: string;
  amount: number; // in cents
  currency: string;
  status: InvoiceStatus;
  type: InvoiceType;
  recurringInterval?: RecurringInterval;
  recurringCount?: number;
  nextPaymentDate?: Date;
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  hostedInvoiceUrl?: string;
  dueDate?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  partnerId: string;
  customerId: string;
}

export interface InvoiceWithDetails extends Invoice {
  partner: {
    id: string;
    businessName: string;
    emailAddress: string;
  };
  customer: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  payments: InvoicePayment[];
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  stripePaymentIntentId: string;
  amount: number; // in cents
  status: PaymentStatus;
  paidAt?: Date;
  createdAt: Date;
}

export type InvoiceStatus = 
  | 'draft'      // Invoice created but not sent
  | 'sent'       // Invoice sent to customer
  | 'paid'       // Invoice fully paid
  | 'overdue'    // Invoice past due date
  | 'cancelled'; // Invoice cancelled

export type InvoiceType = 
  | 'one_time'   // One-time payment
  | 'recurring'; // Recurring payment

export type RecurringInterval = 
  | 'weekly'
  | 'monthly'
  | 'yearly';

export type PaymentStatus = 
  | 'pending'    // Payment initiated but not completed
  | 'succeeded'  // Payment completed successfully
  | 'failed';    // Payment failed

// API Request/Response types
export interface CreateInvoiceRequest {
  customerId: string;
  title: string;
  description?: string;
  amount: number;
  currency?: string;
  dueDate?: Date;
  type: InvoiceType;
  recurringInterval?: RecurringInterval;
  recurringCount?: number;
  metadata?: Record<string, any>;
}

export interface UpdateInvoiceRequest {
  title?: string;
  description?: string;
  amount?: number;
  dueDate?: Date;
  status?: InvoiceStatus;
  metadata?: Record<string, any>;
}

export interface InvoiceListResponse {
  invoices: FormattedInvoice[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface CustomerInvoiceListResponse extends InvoiceListResponse {
  summary: {
    totalInvoices: number;
    pendingInvoices: number;
    overdueInvoices: number;
    paidInvoices: number;
    totalAmountDue: number;
  };
}

export interface FormattedInvoice {
  id: string;
  invoiceNumber: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  type: InvoiceType;
  hostedInvoiceUrl?: string;
  dueDate?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  customer?: {
    id: string;
    email: string;
    name?: string;
  };
  partner?: {
    id: string;
    businessName: string;
    emailAddress: string;
  };
  payments: Array<{
    id: string;
    amount: number;
    status: PaymentStatus;
    paidAt?: Date;
  }>;
  // Customer-specific fields
  isOverdue?: boolean;
  daysUntilDue?: number;
  canPay?: boolean;
  isPaid?: boolean;
  isCancelled?: boolean;
  formattedAmount?: string;
}

export interface PaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  applicationFeeAmount: number;
  currency: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    title: string;
    description?: string;
  };
}

export interface CustomerPaymentIntentResponse extends PaymentIntentResponse {
  formattedAmount: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    title: string;
    description?: string;
    dueDate?: Date;
    isOverdue: boolean;
    partner: {
      businessName: string;
      emailAddress: string;
    };
  };
  processingInfo: {
    applicationFeeAmount: number;
    platformFeePercentage: string;
    partnerReceivesAmount: number;
    formattedPartnerReceives: string;
  };
}

// Invoice statistics and analytics
export interface InvoiceStats {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  averageInvoiceAmount: number;
  paymentRate: number; // percentage of invoices paid
  averagePaymentTime: number; // days from creation to payment
}

export interface MonthlyInvoiceStats {
  month: string;
  year: number;
  invoiceCount: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

// Invoice filters and sorting
export interface InvoiceFilters {
  status?: InvoiceStatus;
  type?: InvoiceType;
  customerId?: string;
  partnerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  search?: string; // Search in title, description, invoice number
}

export interface InvoiceSortOptions {
  field: 'createdAt' | 'updatedAt' | 'dueDate' | 'amount' | 'status' | 'invoiceNumber';
  direction: 'asc' | 'desc';
}

export interface InvoiceListOptions {
  limit?: number;
  offset?: number;
  filters?: InvoiceFilters;
  sort?: InvoiceSortOptions;
}

// Email notification types
export interface InvoiceEmailData {
  invoice: FormattedInvoice;
  partner: {
    businessName: string;
    emailAddress: string;
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  customer: {
    email: string;
    name?: string;
  };
  paymentUrl: string;
  dueDate?: Date;
  isReminder?: boolean;
  reminderLevel?: number;
}

export interface PaymentConfirmationEmailData {
  invoice: FormattedInvoice;
  payment: {
    id: string;
    amount: number;
    paidAt: Date;
    receiptUrl?: string;
  };
  partner: {
    businessName: string;
    emailAddress: string;
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  customer: {
    email: string;
    name?: string;
  };
}
