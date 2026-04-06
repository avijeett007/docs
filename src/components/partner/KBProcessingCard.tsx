'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  FiPlay,
  FiCheck,
  FiAlertCircle,
  FiFileText,
  FiLoader,
  FiDollarSign,
  FiClock
} from 'react-icons/fi';

interface KBProcessingCardProps {
  knowledgeBase: {
    id: string;
    name: string;
    totalFiles?: number;
    processedFiles?: number;
    isProcessed?: boolean;
  };
  partnerId: string;
  customerId: string;
  onProcessingComplete?: (kbId: string) => void;
  compact?: boolean;
}

interface ProcessingStatus {
  canProcess: boolean;
  estimatedCost: number;
  costBreakdown: {
    filesToProcess: number;
    totalFiles: number;
    totalSizeMB: number;
  };
  insufficientCredits: boolean;
  error?: string;
}

export default function KBProcessingCard({
  knowledgeBase,
  partnerId,
  customerId,
  onProcessingComplete,
  compact = false
}: KBProcessingCardProps) {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch processing status
  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/whitelabel/knowledge-base/${knowledgeBase.id}/process`, {
        method: 'GET',
        headers: {
          'X-Partner-ID': partnerId,
          'X-Customer-ID': customerId,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch processing status');
      }

      const data = await response.json();
      setStatus(data.data);
    } catch (error) {
      console.error('Error fetching processing status:', error);
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Process knowledge base (partner-triggered)
  const handleProcess = async () => {
    if (!status?.canProcess) return;

    try {
      setIsProcessing(true);
      const response = await fetch(`/api/whitelabel/knowledge-base/${knowledgeBase.id}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Partner-ID': partnerId,
          'X-Customer-ID': customerId,
        },
        body: JSON.stringify({
          triggeredBy: 'partner'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.alreadyProcessed) {
          toast.info('Knowledge base is already processed');
        } else if (response.status === 402) {
          toast.error('Insufficient credits to process knowledge base');
        } else {
          throw new Error(data.error || 'Failed to process knowledge base');
        }
        return;
      }

      const result = data.data;
      
      if (result.alreadyProcessed) {
        toast.info('Knowledge base is already processed');
      } else {
        toast.success(`Processing started! ${result.creditsDeducted} credits deducted.`);
      }

      // Refresh status and notify parent
      await fetchStatus();
      onProcessingComplete?.(knowledgeBase.id);

    } catch (error: any) {
      console.error('Error processing knowledge base:', error);
      toast.error(error.message || 'Failed to process knowledge base');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [knowledgeBase.id]);

  const getStatusInfo = () => {
    if (isLoading) {
      return {
        icon: <FiLoader className="w-4 h-4 animate-spin text-blue-400" />,
        text: 'Loading...',
        color: 'text-blue-400'
      };
    }

    if (!status) {
      return {
        icon: <FiAlertCircle className="w-4 h-4 text-red-400" />,
        text: 'Status unknown',
        color: 'text-red-400'
      };
    }

    if (status.costBreakdown.filesToProcess === 0) {
      return {
        icon: <FiCheck className="w-4 h-4 text-green-400" />,
        text: 'Processed',
        color: 'text-green-400'
      };
    }

    if (status.insufficientCredits) {
      return {
        icon: <FiDollarSign className="w-4 h-4 text-red-400" />,
        text: 'Insufficient credits',
        color: 'text-red-400'
      };
    }

    if (status.canProcess) {
      return {
        icon: <FiClock className="w-4 h-4 text-amber-400" />,
        text: 'Needs processing',
        color: 'text-amber-400'
      };
    }

    return {
      icon: <FiAlertCircle className="w-4 h-4 text-red-400" />,
      text: status.error || 'Cannot process',
      color: 'text-red-400'
    };
  };

  const statusInfo = getStatusInfo();
  const needsProcessing = status && status.canProcess && status.costBreakdown.filesToProcess > 0;

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
        <div className="flex items-center gap-3">
          <FiFileText className="w-4 h-4 text-gray-400" />
          <div>
            <div className="text-sm font-medium text-white">{knowledgeBase.name}</div>
            <div className={`text-xs ${statusInfo.color} flex items-center gap-1`}>
              {statusInfo.icon}
              {statusInfo.text}
            </div>
          </div>
        </div>

        {needsProcessing && (
          <button
            onClick={handleProcess}
            disabled={isProcessing}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white text-xs rounded font-medium transition-colors"
          >
            {isProcessing ? 'Processing...' : `Process (${status.estimatedCost})`}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <FiFileText className="w-5 h-5 text-gray-400" />
          <div>
            <h4 className="text-lg font-medium text-white">{knowledgeBase.name}</h4>
            <div className={`text-sm ${statusInfo.color} flex items-center gap-1 mt-1`}>
              {statusInfo.icon}
              {statusInfo.text}
            </div>
          </div>
        </div>
      </div>

      {status && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="text-xs text-gray-400">Total Files</div>
            <div className="text-lg font-semibold text-white">{status.costBreakdown.totalFiles}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">To Process</div>
            <div className="text-lg font-semibold text-blue-400">{status.costBreakdown.filesToProcess}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Cost</div>
            <div className="text-lg font-semibold text-green-400">{status.estimatedCost}</div>
          </div>
        </div>
      )}

      {needsProcessing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-3 bg-yellow-600/10 border border-yellow-600/20 rounded-lg mb-3"
        >
          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <FiAlertCircle className="w-4 h-4" />
            This knowledge base needs to be processed before it can be used by agents.
          </div>
        </motion.div>
      )}

      <div className="flex items-center gap-3">
        {needsProcessing && (
          <button
            onClick={handleProcess}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {isProcessing ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <FiPlay className="w-4 h-4" />
                Process ({status.estimatedCost} credits)
              </>
            )}
          </button>
        )}

        {status?.costBreakdown.filesToProcess === 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-400 rounded-lg text-sm">
            <FiCheck className="w-4 h-4" />
            Ready for use
          </div>
        )}

        {status?.insufficientCredits && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg text-sm">
            <FiDollarSign className="w-4 h-4" />
            Insufficient credits
          </div>
        )}
      </div>

      {status?.error && (
        <div className="mt-3 p-3 bg-red-600/20 border border-red-600/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <FiAlertCircle className="w-4 h-4" />
            {status.error}
          </div>
        </div>
      )}
    </div>
  );
}
