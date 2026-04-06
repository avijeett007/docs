'use client';

import React, { useState, useEffect } from 'react';
import { FiDatabase, FiLoader, FiAlertCircle, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  totalFiles: number;
  totalWebsiteUrls: number;
  isReady: boolean;
  processingStatus: 'pending' | 'processing' | 'partial' | 'completed';
}

interface KnowledgeBaseSelectorProps {
  customerId: string;
  selectedKnowledgeBaseId?: string;
  onKnowledgeBaseSelect: (kbId: string, kbName: string) => void;
  disabled?: boolean;
  autoSelectIfSingle?: boolean; // Auto-select if customer has only one KB
}

export const KnowledgeBaseSelector: React.FC<KnowledgeBaseSelectorProps> = ({
  customerId,
  selectedKnowledgeBaseId,
  onKnowledgeBaseSelect,
  disabled = false,
  autoSelectIfSingle = true
}) => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  useEffect(() => {
    if (customerId) {
      loadKnowledgeBases();
    }
  }, [customerId]);

  // Auto-select if only one knowledge base
  useEffect(() => {
    if (autoSelectIfSingle && !hasAutoSelected && knowledgeBases.length === 1 && !selectedKnowledgeBaseId) {
      const kb = knowledgeBases[0];
      onKnowledgeBaseSelect(kb.id, kb.name);
      setHasAutoSelected(true);
    }
  }, [knowledgeBases, autoSelectIfSingle, hasAutoSelected, selectedKnowledgeBaseId, onKnowledgeBaseSelect]);

  const loadKnowledgeBases = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/partner/customers/${customerId}/knowledge-bases`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load knowledge bases');
      }

      const data = await response.json();
      
      if (data.success && data.data?.knowledgeBases) {
        setKnowledgeBases(data.data.knowledgeBases);
      } else {
        setKnowledgeBases([]);
      }
    } catch (error: any) {
      console.error('Failed to load knowledge bases:', error);
      setError(error.message);
      toast.error('Failed to load knowledge bases');
    } finally {
      setLoading(false);
    }
  };

  const handleKnowledgeBaseChange = (kbId: string) => {
    const kb = knowledgeBases.find(k => k.id === kbId);
    if (kb) {
      onKnowledgeBaseSelect(kbId, kb.name);
    } else if (kbId === '') {
      // Clear selection
      onKnowledgeBaseSelect('', '');
    }
  };

  const getStatusBadge = (kb: KnowledgeBase) => {
    if (kb.isReady) {
      return <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">Ready</span>;
    }
    if (kb.processingStatus === 'processing') {
      return <span className="ml-2 text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">Processing</span>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-gray-700/50 rounded-lg">
        <FiLoader className="h-4 w-4 animate-spin text-blue-400" />
        <span className="text-sm text-gray-400">Loading knowledge bases...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
        <FiAlertCircle className="h-4 w-4 text-red-400" />
        <span className="text-sm text-red-400">{error}</span>
        <button
          onClick={loadKnowledgeBases}
          className="ml-auto text-xs text-blue-400 hover:text-blue-300"
        >
          Retry
        </button>
      </div>
    );
  }

  if (knowledgeBases.length === 0) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <FiAlertCircle className="h-4 w-4 text-yellow-400" />
        <span className="text-sm text-yellow-400">
          No knowledge bases found for this customer. Create one first in the Knowledge Base section.
        </span>
      </div>
    );
  }

  const selectedKb = knowledgeBases.find(kb => kb.id === selectedKnowledgeBaseId);

  return (
    <div className="space-y-2">
      <div className="relative">
        <select
          value={selectedKnowledgeBaseId || ''}
          onChange={(e) => handleKnowledgeBaseChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 pl-10 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select a knowledge base...</option>
          {knowledgeBases.map((kb) => (
            <option key={kb.id} value={kb.id}>
              {kb.name} ({kb.totalFiles} files, {kb.totalWebsiteUrls} URLs)
              {kb.isReady ? ' ✓' : kb.processingStatus === 'processing' ? ' ⏳' : ''}
            </option>
          ))}
        </select>
        <FiDatabase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>
      {selectedKb && (
        <div className="flex items-center text-xs text-green-400">
          <FiCheck className="w-3 h-3 mr-1" />
          Selected: {selectedKb.name}
          {getStatusBadge(selectedKb)}
        </div>
      )}
    </div>
  );
};

