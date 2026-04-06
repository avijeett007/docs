'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiAlertTriangle, 
  FiCheck, 
  FiX, 
  FiClock, 
  FiUser, 
  FiRepeat,
  FiCalendar,
  FiDollarSign,
  FiMessageSquare
} from 'react-icons/fi';
import { toast } from 'sonner';

interface CancellationRequest {
  id: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
  partnerNotes?: string;
  invoice: {
    invoiceNumber: string;
    title: string;
    amount: number;
    currency: string;
    recurringInterval?: string;
    nextPaymentDate?: string;
  };
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface CancellationRequestsManagerProps {
  className?: string;
}

export default function CancellationRequestsManager({ className = '' }: CancellationRequestsManagerProps) {
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('pending');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CancellationRequest | null>(null);
  const [partnerNotes, setPartnerNotes] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'deny' | null>(null);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`/api/partner/billing/cancellation-requests?status=${filter}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cancellation requests');
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error fetching cancellation requests:', error);
      toast.error('Failed to load cancellation requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleAction = (request: CancellationRequest, action: 'approve' | 'deny') => {
    setSelectedRequest(request);
    setActionType(action);
    setPartnerNotes('');
    setShowNotesModal(true);
  };

  const processRequest = async () => {
    if (!selectedRequest || !actionType) return;

    setProcessingRequestId(selectedRequest.id);
    try {
      const response = await fetch('/api/partner/billing/cancellation-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action: actionType,
          partnerNotes: partnerNotes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process cancellation request');
      }

      toast.success(`Cancellation request ${actionType}d successfully`);
      setShowNotesModal(false);
      setSelectedRequest(null);
      setActionType(null);
      setPartnerNotes('');
      fetchRequests();
    } catch (error) {
      console.error('Error processing cancellation request:', error);
      toast.error('Failed to process cancellation request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <FiClock className="w-4 h-4 text-yellow-400" />;
      case 'approved':
        return <FiCheck className="w-4 h-4 text-green-400" />;
      case 'denied':
        return <FiX className="w-4 h-4 text-red-400" />;
      default:
        return <FiAlertTriangle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
      case 'approved':
        return 'bg-green-500/20 text-green-400 border-green-500/20';
      case 'denied':
        return 'bg-red-500/20 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Cancellation Requests</h2>
          <p className="text-gray-400 text-sm">Manage customer recurring invoice cancellation requests</p>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex bg-gray-800 rounded-lg p-1">
          {(['pending', 'approved', 'denied', 'all'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="text-center py-12">
          <FiAlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Cancellation Requests</h3>
          <p className="text-gray-400">
            {filter === 'pending' 
              ? 'No pending cancellation requests at the moment.'
              : `No ${filter} cancellation requests found.`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {requests.map((request) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-gray-800 border border-gray-700 rounded-lg p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm border ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      <span className="capitalize">{request.status}</span>
                    </div>
                    <span className="text-gray-400 text-sm">
                      Requested {formatDate(request.requestedAt)}
                    </span>
                  </div>
                  
                  {request.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAction(request, 'deny')}
                        disabled={processingRequestId === request.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        <FiX className="w-4 h-4" />
                        Deny
                      </button>
                      <button
                        onClick={() => handleAction(request, 'approve')}
                        disabled={processingRequestId === request.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50"
                      >
                        <FiCheck className="w-4 h-4" />
                        Approve
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Info */}
                  <div>
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                      <FiUser className="w-4 h-4" />
                      Customer
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p className="text-white">
                        {request.customer.firstName} {request.customer.lastName}
                      </p>
                      <p className="text-gray-400">{request.customer.email}</p>
                    </div>
                  </div>

                  {/* Invoice Info */}
                  <div>
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                      <FiRepeat className="w-4 h-4" />
                      Recurring Invoice
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p className="text-white">{request.invoice.invoiceNumber}</p>
                      <p className="text-gray-400">{request.invoice.title}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1 text-green-400">
                          <FiDollarSign className="w-3 h-3" />
                          {formatAmount(request.invoice.amount, request.invoice.currency)}
                        </span>
                        {request.invoice.recurringInterval && (
                          <span className="text-purple-400 capitalize">
                            {request.invoice.recurringInterval}
                          </span>
                        )}
                        {request.invoice.nextPaymentDate && (
                          <span className="flex items-center gap-1 text-blue-400">
                            <FiCalendar className="w-3 h-3" />
                            Next: {formatDate(request.invoice.nextPaymentDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="mt-4">
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                    <FiMessageSquare className="w-4 h-4" />
                    Reason for Cancellation
                  </h4>
                  <p className="text-gray-300 bg-gray-700/50 rounded-lg p-3 text-sm">
                    {request.reason}
                  </p>
                </div>

                {/* Partner Notes (if processed) */}
                {request.partnerNotes && (
                  <div className="mt-4">
                    <h4 className="text-white font-medium mb-2">Partner Notes</h4>
                    <p className="text-gray-300 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
                      {request.partnerNotes}
                    </p>
                  </div>
                )}

                {/* Processing Info */}
                {request.processedAt && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-gray-400 text-sm">
                      Processed by {request.processedBy} on {formatDate(request.processedAt)}
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNotesModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              {actionType === 'approve' ? 'Approve' : 'Deny'} Cancellation Request
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={partnerNotes}
                onChange={(e) => setPartnerNotes(e.target.value)}
                placeholder="Add any notes for the customer..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowNotesModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={processRequest}
                disabled={processingRequestId === selectedRequest.id}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                  actionType === 'approve'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {actionType === 'approve' ? <FiCheck className="w-4 h-4" /> : <FiX className="w-4 h-4" />}
                {processingRequestId === selectedRequest.id ? 'Processing...' : 
                  (actionType === 'approve' ? 'Approve' : 'Deny')
                }
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
