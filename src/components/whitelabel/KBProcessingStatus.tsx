'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  FiPlay,
  FiClock,
  FiCheck,
  FiAlertCircle,
  FiDollarSign,
  FiFileText,
  FiLoader,
  FiRefreshCw,
  FiInfo
} from 'react-icons/fi';

/**
 * KBProcessingStatus Component
 *
 * IMPORTANT: This component is currently configured to hide credit-related functionality
 * because knowledge base processing is not yet fully implemented with external embedding service.
 *
 * Current State:
 * - File upload works (stored in Supabase/R2)
 * - Processing is mocked (no actual embedding generation)
 * - Credit deduction is disabled to prevent charging for non-functional processing
 *
 * TODO: When implementing actual knowledge base processing:
 * 1. Enable credit display by setting SHOW_CREDITS = true
 * 2. Implement actual document processing pipeline
 * 3. Connect to external embedding service
 * 4. Enable credit deduction for actual processing
 * 5. Resolve partner vs customer credit balance discrepancy
 *
 * Credit System Notes:
 * - Currently checks partner.creditBalance but UI shows customer.creditBalance
 * - This creates UX confusion (customer sees 2078 credits but gets "insufficient credits")
 * - Need to decide: use partner credits OR customer credits consistently
 */

// Feature flag to hide credit-related UI until processing is fully implemented
const SHOW_CREDITS = false;

interface KBProcessingStatusProps {
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  partnerId: string;
  customerId: string;
  onProcessingComplete?: () => void;
  showCostBreakdown?: boolean;
  allowProcessing?: boolean;
  className?: string;
}

interface ProcessingStatus {
  canProcess: boolean;
  processingEnabled: boolean;
  estimatedCost: number;
  costBreakdown: {
    filesToProcess: number;
    totalFiles: number;
    totalSizeMB: number;
    baseCost: number;
    overageCost: number;
    maxIncludedSizeMB: number;
  };
  insufficientCredits: boolean;
  error?: string;
}

interface ProcessingResult {
  success: boolean;
  creditsDeducted?: number;
  newBalance?: number;
  processedFiles?: number;
  alreadyProcessed?: boolean;
  error?: string;
}

export default function KBProcessingStatus({
  knowledgeBaseId,
  knowledgeBaseName,
  partnerId,
  customerId,
  onProcessingComplete,
  showCostBreakdown = true,
  allowProcessing = true,
  className = ''
}: KBProcessingStatusProps) {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch processing status
  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/whitelabel/knowledge-base/${knowledgeBaseId}/process`, {
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
      toast.error('Failed to load processing status');
    } finally {
      setIsLoading(false);
    }
  };

  // Process knowledge base
  const handleProcess = async () => {
    if (!status?.canProcess || !allowProcessing) return;

    try {
      setIsProcessing(true);
      const response = await fetch(`/api/whitelabel/knowledge-base/${knowledgeBaseId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Partner-ID': partnerId,
          'X-Customer-ID': customerId,
        },
        body: JSON.stringify({
          triggeredBy: 'customer'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.alreadyProcessed) {
          toast.info('Knowledge base is already processed or currently processing');
        } else if (response.status === 402) {
          // Hide credit-related error when SHOW_CREDITS is false
          if (SHOW_CREDITS) {
            toast.error('Insufficient credits to process knowledge base');
          } else {
            toast.info('Processing is not available at this time');
          }
        } else if (response.status === 403) {
          toast.error('Knowledge base processing is not enabled for your account');
        } else {
          throw new Error(data.error || 'Failed to process knowledge base');
        }
        return;
      }

      const result: ProcessingResult = data.data;
      
      if (result.alreadyProcessed) {
        toast.info('Knowledge base is already processed');
      } else {
        toast.success(`Processing started! ${result.creditsDeducted} credits deducted.`);
      }

      // Refresh status after processing
      await fetchStatus();
      onProcessingComplete?.();

    } catch (error: any) {
      console.error('Error processing knowledge base:', error);
      toast.error(error.message || 'Failed to process knowledge base');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [knowledgeBaseId]);

  if (isLoading) {
    return (
      <div className={`bg-gray-800/50 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <FiLoader className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="ml-2 text-gray-300">Loading processing status...</span>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className={`bg-gray-800/50 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-center py-8 text-gray-400">
          <FiAlertCircle className="w-6 h-6 mr-2" />
          <span>Failed to load processing status</span>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    if (!SHOW_CREDITS) {
      // Simplified status icons when credits are hidden
      if ((status.costBreakdown?.filesToProcess || 0) === 0) {
        return <FiCheck className="w-5 h-5 text-green-400" />;
      }
      return <FiFileText className="w-5 h-5 text-blue-400" />;
    }

    // Original credit-based logic (enabled when SHOW_CREDITS = true)
    if (!status.processingEnabled) {
      return <FiClock className="w-5 h-5 text-amber-400" />;
    }
    if (status.canProcess && (status.costBreakdown?.filesToProcess || 0) > 0) {
      return <FiPlay className="w-5 h-5 text-blue-400" />;
    }
    if ((status.costBreakdown?.filesToProcess || 0) === 0) {
      return <FiCheck className="w-5 h-5 text-green-400" />;
    }
    return <FiAlertCircle className="w-5 h-5 text-red-400" />;
  };

  const getStatusText = () => {
    if (!SHOW_CREDITS) {
      // Hide credit-related status messages when processing is disabled
      if ((status.costBreakdown?.filesToProcess || 0) === 0) {
        return 'All files uploaded';
      }
      return 'Files ready for processing';
    }

    // Original credit-based logic (enabled when SHOW_CREDITS = true)
    if (!status.processingEnabled) {
      return 'Processing not enabled';
    }
    if (status.insufficientCredits) {
      return 'Insufficient credits';
    }
    if ((status.costBreakdown?.filesToProcess || 0) === 0) {
      return 'All files processed';
    }
    if (status.canProcess) {
      return 'Ready to process';
    }
    return status.error || 'Cannot process';
  };

  const getStatusColor = () => {
    if (!SHOW_CREDITS) {
      // Simplified status colors when credits are hidden
      if ((status.costBreakdown?.filesToProcess || 0) === 0) return 'text-green-400';
      return 'text-blue-400';
    }

    // Original credit-based logic (enabled when SHOW_CREDITS = true)
    if (!status.processingEnabled) return 'text-amber-400';
    if (status.insufficientCredits) return 'text-red-400';
    if ((status.costBreakdown?.filesToProcess || 0) === 0) return 'text-green-400';
    if (status.canProcess) return 'text-blue-400';
    return 'text-red-400';
  };

  return (
    <div className={`bg-gray-800/50 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className="text-lg font-semibold text-white">{knowledgeBaseName}</h3>
            <p className={`text-sm ${getStatusColor()}`}>{getStatusText()}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Show details"
          >
            <FiInfo className="w-4 h-4" />
          </button>
          
          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh status"
          >
            <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Processing Stats */}
      <div className={`grid gap-4 mb-4 ${SHOW_CREDITS ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
        <div className="bg-gray-700/30 rounded-lg p-3">
          <div className="text-xs text-gray-400">Total Files</div>
          <div className="text-lg font-semibold text-white">{status.costBreakdown?.totalFiles || 0}</div>
        </div>

        <div className="bg-gray-700/30 rounded-lg p-3">
          <div className="text-xs text-gray-400">Ready to Process</div>
          <div className="text-lg font-semibold text-blue-400">{status.costBreakdown?.filesToProcess || 0}</div>
        </div>

        <div className="bg-gray-700/30 rounded-lg p-3">
          <div className="text-xs text-gray-400">Total Size</div>
          <div className="text-lg font-semibold text-white">{(status.costBreakdown?.totalSizeMB || 0).toFixed(1)} MB</div>
        </div>

        {/* Hide cost display when credits are disabled */}
        {SHOW_CREDITS && (
          <div className="bg-gray-700/30 rounded-lg p-3">
            <div className="text-xs text-gray-400">Cost</div>
            <div className="text-lg font-semibold text-green-400">{status.estimatedCost || 0} credits</div>
          </div>
        )}
      </div>

      {/* Cost Breakdown Details - Hidden when credits are disabled */}
      {SHOW_CREDITS && showDetails && showCostBreakdown && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 p-4 bg-gray-700/20 rounded-lg"
        >
          <h4 className="text-sm font-medium text-white mb-3">Cost Breakdown</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Base cost (up to {status.costBreakdown?.maxIncludedSizeMB || 0} MB):</span>
              <span className="text-white">{status.costBreakdown?.baseCost || 0} credits</span>
            </div>
            {(status.costBreakdown?.overageCost || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Overage cost:</span>
                <span className="text-amber-400">+{status.costBreakdown?.overageCost || 0} credits</span>
              </div>
            )}
            <div className="border-t border-gray-600 pt-2 flex justify-between font-medium">
              <span className="text-white">Total:</span>
              <span className="text-green-400">{status.estimatedCost || 0} credits</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* File Processing Information - Shown when credits are disabled */}
      {!SHOW_CREDITS && showDetails && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 p-4 bg-gray-700/20 rounded-lg"
        >
          <h4 className="text-sm font-medium text-white mb-3">Processing Information</h4>
          <div className="space-y-2 text-sm text-gray-300">
            <p>• Files are uploaded and stored successfully</p>
            <p>• Document processing and embedding generation is not yet implemented</p>
            <p>• Semantic search will be available once processing is enabled</p>
            <p>• No credits will be charged until actual processing is implemented</p>
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {SHOW_CREDITS ? (
          // Original credit-based action buttons (enabled when SHOW_CREDITS = true)
          <>
            {status.canProcess && (status.costBreakdown?.filesToProcess || 0) > 0 && allowProcessing && (
              <button
                onClick={handleProcess}
                disabled={isProcessing || !status.processingEnabled}
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
                    Process ({status.estimatedCost || 0} credits)
                  </>
                )}
              </button>
            )}

            {!status.processingEnabled && (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-600/20 text-amber-400 rounded-lg text-sm">
                <FiClock className="w-4 h-4" />
                Processing not enabled by partner
              </div>
            )}

            {status.insufficientCredits && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg text-sm">
                <FiDollarSign className="w-4 h-4" />
                Insufficient credits
              </div>
            )}

            {(status.costBreakdown?.filesToProcess || 0) === 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-400 rounded-lg text-sm">
                <FiCheck className="w-4 h-4" />
                All files processed
              </div>
            )}
          </>
        ) : (
          // Simplified status display when credits are hidden
          <>
            {(status.costBreakdown?.filesToProcess || 0) === 0 ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-400 rounded-lg text-sm">
                <FiCheck className="w-4 h-4" />
                All files uploaded successfully
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg text-sm">
                <FiFileText className="w-4 h-4" />
                Files ready for processing (coming soon)
              </div>
            )}
          </>
        )}
      </div>

      {/* Error Message - Hide credit-related errors when SHOW_CREDITS is false */}
      {status.error && (SHOW_CREDITS || !status.error.toLowerCase().includes('credit')) && (
        <div className="mt-4 p-3 bg-red-600/20 border border-red-600/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <FiAlertCircle className="w-4 h-4" />
            {status.error}
          </div>
        </div>
      )}
    </div>
  );
}
