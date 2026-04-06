'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiCheck, FiClock, FiAlertCircle, FiRefreshCw, FiGlobe, FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface Activation {
  id: string;
  country: string;
  businessName: string;
  status: string;
  regulatoryBundleStatus: string;
  regulatoryBundleType: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  twilioSubaccountSid: string | null;
}

interface PhoneActivationStatusProps {
  onResubmit?: (activationId: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; bgColor: string }> = {
  draft: { label: 'Draft', color: 'text-gray-400', icon: <FiClock className="w-4 h-4" />, bgColor: 'bg-gray-400/10' },
  submitted: { label: 'Submitted', color: 'text-blue-400', icon: <FiClock className="w-4 h-4" />, bgColor: 'bg-blue-400/10' },
  processing: { label: 'Processing', color: 'text-yellow-400', icon: <FiRefreshCw className="w-4 h-4 animate-spin" />, bgColor: 'bg-yellow-400/10' },
  pending_review: { label: 'Under Review', color: 'text-orange-400', icon: <FiClock className="w-4 h-4" />, bgColor: 'bg-orange-400/10' },
  under_review: { label: 'Team Reviewing', color: 'text-orange-400', icon: <FiClock className="w-4 h-4" />, bgColor: 'bg-orange-400/10' },
  active: { label: 'Active', color: 'text-green-400', icon: <FiCheck className="w-4 h-4" />, bgColor: 'bg-green-400/10' },
  approved: { label: 'Approved', color: 'text-green-400', icon: <FiCheck className="w-4 h-4" />, bgColor: 'bg-green-400/10' },
  rejected: { label: 'Rejected', color: 'text-red-400', icon: <FiAlertCircle className="w-4 h-4" />, bgColor: 'bg-red-400/10' },
  resubmission_needed: { label: 'Resubmission Needed', color: 'text-red-400', icon: <FiAlertCircle className="w-4 h-4" />, bgColor: 'bg-red-400/10' },
  more_info_needed: { label: 'More Info Needed', color: 'text-yellow-400', icon: <FiAlertCircle className="w-4 h-4" />, bgColor: 'bg-yellow-400/10' },
};

export default function PhoneActivationStatus({ onResubmit }: PhoneActivationStatusProps) {
  const [activations, setActivations] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadActivations = useCallback(async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/phone-activation/status', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setActivations(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to load activations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivations();
    // Poll for updates every 30 seconds
    const interval = setInterval(loadActivations, 30000);
    return () => clearInterval(interval);
  }, [loadActivations]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-16 bg-gray-700/50 rounded-lg" />
        <div className="h-16 bg-gray-700/50 rounded-lg" />
      </div>
    );
  }

  if (activations.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
        <FiGlobe className="w-4 h-4" />
        Phone Service Activations
      </h3>

      {activations.map((activation) => {
        const config = STATUS_CONFIG[activation.status] || STATUS_CONFIG.draft;
        const isExpanded = expandedId === activation.id;

        return (
          <div key={activation.id} className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/50">
            <button
              onClick={() => setExpandedId(isExpanded ? null : activation.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}>
                  {config.icon}
                  {config.label}
                </span>
                <span className="text-sm font-medium text-white">{activation.businessName}</span>
                <span className="text-xs text-gray-400">{activation.country}</span>
              </div>
              {isExpanded ? <FiChevronUp className="w-4 h-4 text-gray-400" /> : <FiChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {isExpanded && (
              <div className="px-4 pb-3 border-t border-gray-700 pt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Bundle Type:</span>
                    <span className="ml-1 text-gray-200 capitalize">{activation.regulatoryBundleType || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Submitted:</span>
                    <span className="ml-1 text-gray-200">
                      {activation.submittedAt ? new Date(activation.submittedAt).toLocaleDateString() : 'Not yet'}
                    </span>
                  </div>
                  {activation.approvedAt && (
                    <div>
                      <span className="text-gray-400">Approved:</span>
                      <span className="ml-1 text-gray-200">{new Date(activation.approvedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Show friendly team-review message for rejected/processing/pending statuses */}
                {(activation.status === 'rejected' || activation.status === 'pending_review' || activation.status === 'under_review' || activation.status === 'processing') && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mt-2">
                    <p className="text-sm text-blue-300 font-medium mb-1">📋 Our team is reviewing your submission</p>
                    <p className="text-sm text-blue-300/80">
                      We&apos;ve informed our team to review your documents and help you with the activation process.
                      You don&apos;t need to take any action right now. If we need you to resubmit any documents, we&apos;ll contact you.
                    </p>
                    <p className="text-sm text-blue-300/80 mt-2">
                      Need help? Reach out to us on{' '}
                      <a href="https://discord.gg/knotie" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">Discord</a>
                      {' '}or email{' '}
                      <a href="mailto:support@knotie-ai.pro" className="text-blue-400 underline hover:text-blue-300">support@knotie-ai.pro</a>
                    </p>
                  </div>
                )}

                {/* Show more info needed message */}
                {activation.status === 'more_info_needed' && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-2">
                    <p className="text-sm text-yellow-300 font-medium mb-1">⚠️ Additional information needed</p>
                    <p className="text-sm text-yellow-300/80">
                      Our team needs some additional information to complete your activation.
                      Please reach out to us on{' '}
                      <a href="https://discord.gg/knotie" target="_blank" rel="noopener noreferrer" className="text-yellow-400 underline hover:text-yellow-300">Discord</a>
                      {' '}or email{' '}
                      <a href="mailto:support@knotie-ai.pro" className="text-yellow-400 underline hover:text-yellow-300">support@knotie-ai.pro</a>
                    </p>
                  </div>
                )}

                {activation.status === 'resubmission_needed' && onResubmit && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-2">
                    <p className="text-sm text-red-300 font-medium mb-1">🔄 Resubmission required</p>
                    <p className="text-sm text-red-300/80 mb-2">
                      Our team has reviewed your submission and needs you to resubmit your documents.
                    </p>
                    <button
                      onClick={() => onResubmit(activation.id)}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Resubmit Documents
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

