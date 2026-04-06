'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiDollarSign,
  FiCalendar,
  FiClock,
  FiUsers,
  FiEye,
  FiSend,
  FiTrash2,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiPlus
} from 'react-icons/fi';
import { FormattedInvoice } from '@/types/invoice';

interface InvoiceListViewProps {
  invoices: FormattedInvoice[];
  onCancelInvoice: (invoiceId: string) => void;
  onCreateInvoice: () => void;
  isLoading?: boolean;
}

export default function InvoiceListView({
  invoices,
  onCancelInvoice,
  onCreateInvoice,
  isLoading = false
}: InvoiceListViewProps) {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: 'bg-gray-500/20 text-gray-400', icon: FiClock },
      sent: { color: 'bg-blue-500/20 text-blue-400', icon: FiSend },
      paid: { color: 'bg-green-500/20 text-green-400', icon: FiCheck },
      overdue: { color: 'bg-red-500/20 text-red-400', icon: FiAlertCircle },
      cancelled: { color: 'bg-gray-500/20 text-gray-400', icon: FiX },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatAmount = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Invoices</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            Invoices ({invoices.length})
          </h2>
          <button
            onClick={onCreateInvoice}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all text-sm"
          >
            <FiPlus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-12">
          <FiDollarSign className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No invoices found</p>
          <button
            onClick={onCreateInvoice}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all mx-auto"
          >
            <FiPlus className="w-4 h-4" />
            Create First Invoice
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-800">
          <AnimatePresence>
            {invoices.map((invoice) => (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-6 hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-white">{invoice.title}</h3>
                      {getStatusBadge(invoice.status)}
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="font-mono">#{invoice.invoiceNumber}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <FiDollarSign className="w-3 h-3" />
                        {formatAmount(invoice.amount)}
                      </span>
                      {invoice.customer && (
                        <span className="flex items-center gap-1">
                          <FiUsers className="w-3 h-3" />
                          {invoice.customer.name || invoice.customer.email}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <FiCalendar className="w-3 h-3" />
                        Created: {formatDate(invoice.createdAt)}
                      </span>
                      {invoice.dueDate && (
                        <span className="flex items-center gap-1">
                          <FiClock className="w-3 h-3" />
                          Due: {formatDate(invoice.dueDate)}
                        </span>
                      )}
                      {invoice.paidAt && (
                        <span className="flex items-center gap-1 text-green-400">
                          <FiCheck className="w-3 h-3" />
                          Paid: {formatDate(invoice.paidAt)}
                        </span>
                      )}
                    </div>
                    {invoice.description && (
                      <p className="text-sm text-gray-400 mt-2 line-clamp-2">{invoice.description}</p>
                    )}
                    
                    {/* Payment Information */}
                    {invoice.payments && invoice.payments.length > 0 && (
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                        <span>Payments: {invoice.payments.length}</span>
                        <span>
                          Last payment: {invoice.payments
                            .filter(p => p.paidAt)
                            .sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime())[0]?.paidAt
                            ? formatDate(invoice.payments
                                .filter(p => p.paidAt)
                                .sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime())[0].paidAt!)
                            : 'None'
                          }
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                      title="View Invoice Details"
                    >
                      <FiEye className="w-4 h-4" />
                    </button>
                    
                    {invoice.status === 'draft' && (
                      <button
                        className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                        title="Send Invoice"
                      >
                        <FiSend className="w-4 h-4" />
                      </button>
                    )}
                    
                    {(invoice.status === 'draft' || invoice.status === 'sent') && (
                      <button
                        onClick={() => onCancelInvoice(invoice.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Cancel Invoice"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
