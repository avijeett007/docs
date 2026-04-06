'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiSettings, FiZap, FiLoader, FiAlertCircle, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import ToolSelector from './ToolSelector';
import FunctionCallEditor from './FunctionCallEditor';

// Import ToolSchema interface
interface ToolSchema {
  appName: string;
  toolName: string;
  displayName: string;
  description: string;
  category?: string;
  inputSchema: any;
  outputSchema?: any;
  examples?: any;
}

interface FunctionCall {
  id?: string;
  appName: string;
  toolName: string;
  customName: string;
  customDescription: string;
  isConfigured?: boolean;
  webhookUrl?: string;
  parameterValues?: Record<string, any>; // Store pre-filled parameter values
  parameters?: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  }; // JSON schema for Retell
  // Retell-specific execution settings
  speakDuringExecution?: boolean;
  speakAfterExecution?: boolean;
  executionMessageDescription?: string;
  timeoutMs?: number;
  // GHL-specific settings
  calendarId?: string;
  calendarName?: string;
}

interface FunctionCallsPanelProps {
  customerId: string;
  agentId?: string;
  functionCalls: FunctionCall[];
  onChange: (functionCalls: FunctionCall[]) => void;
  isLoading?: boolean;
  mode: 'create' | 'edit';
}

const FunctionCallsPanel: React.FC<FunctionCallsPanelProps> = ({
  customerId,
  agentId,
  functionCalls,
  onChange,
  isLoading = false,
  mode
}) => {
  console.log('[FunctionCallsPanel] Received props:', {
    customerId,
    agentId,
    functionCallsCount: functionCalls?.length || 0,
    functionCalls,
    mode
  });
  const [isToolSelectorOpen, setIsToolSelectorOpen] = useState(false);
  const [editingFunctionCall, setEditingFunctionCall] = useState<FunctionCall | null>(null);
  const [availableApps, setAvailableApps] = useState<Record<string, ToolSchema[]>>({});
  const [loadingApps, setLoadingApps] = useState(false);

  // Load available apps for the customer
  useEffect(() => {
    if (customerId && isToolSelectorOpen) {
      loadAvailableApps();
    }
  }, [customerId, isToolSelectorOpen]);

  const loadAvailableApps = async () => {
    setLoadingApps(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/customers/${customerId}/tool-schemas`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load available tools');
      }

      const data = await response.json();
      setAvailableApps(data.data || {});
    } catch (error) {
      console.error('Error loading available apps:', error);
      toast.error('Failed to load available tools');
    } finally {
      setLoadingApps(false);
    }
  };

  const handleAddFunctionCall = (toolSelection: { appName: string; toolName: string; toolSchema: any }) => {
    const newFunctionCall: FunctionCall = {
      appName: toolSelection.appName,
      toolName: toolSelection.toolName,
      customName: generateCustomName(toolSelection.appName, toolSelection.toolName),
      customDescription: toolSelection.toolSchema.description || `Execute ${toolSelection.toolName} in ${toolSelection.appName}`,
      isConfigured: false
    };

    setEditingFunctionCall(newFunctionCall);
    setIsToolSelectorOpen(false);
  };

  const handleSaveFunctionCall = (functionCall: FunctionCall) => {
    const existingIndex = functionCalls.findIndex(fc => 
      fc.appName === functionCall.appName && fc.toolName === functionCall.toolName
    );

    let updatedFunctionCalls;
    if (existingIndex >= 0) {
      // Update existing
      updatedFunctionCalls = [...functionCalls];
      updatedFunctionCalls[existingIndex] = { ...functionCall, isConfigured: true };
    } else {
      // Add new
      updatedFunctionCalls = [...functionCalls, { ...functionCall, isConfigured: true }];
    }

    onChange(updatedFunctionCalls);
    setEditingFunctionCall(null);
    toast.success('Function call configured successfully');
  };

  const handleRemoveFunctionCall = (index: number) => {
    const updatedFunctionCalls = functionCalls.filter((_, i) => i !== index);
    onChange(updatedFunctionCalls);
    toast.success('Function call removed');
  };

  const handleEditFunctionCall = (functionCall: FunctionCall) => {
    setEditingFunctionCall(functionCall);
  };

  const generateCustomName = (appName: string, toolName: string): string => {
    // Convert to camelCase function name
    const cleanAppName = appName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanToolName = toolName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanAppName}_${cleanToolName}`;
  };

  const getAppIcon = (appName: string) => {
    // You can expand this with actual app icons
    const iconMap: Record<string, string> = {
      gmail: '📧',
      slack: '💬',
      notion: '📝',
      airtable: '📊',
      hubspot: '🏢',
      salesforce: '☁️',
      shopify: '🛍️',
      googlecalendar: '📅'
    };
    return iconMap[appName.toLowerCase()] || '🔧';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-400">
          <FiLoader className="w-6 h-6 animate-spin" />
          <span>Loading function calls...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FiZap className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white">Function Calls</h3>
        </div>
        <button
          type="button"
          onClick={() => setIsToolSelectorOpen(true)}
          disabled={!customerId}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
            customerId
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-gray-600 text-gray-400 cursor-not-allowed"
          )}
        >
          <FiPlus className="w-4 h-4" />
          Add Function Call
        </button>
      </div>

      {/* Customer Selection Notice */}
      {!customerId && (
        <div className="flex items-center gap-3 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
          <FiAlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="text-sm text-amber-200">
            Please select a customer first to configure function calls for their connected apps.
          </div>
        </div>
      )}

      {/* Function Calls List */}
      {functionCalls.length > 0 ? (
        <div className="space-y-3">
          {functionCalls.map((functionCall, index) => (
            <div
              key={`${functionCall.appName}-${functionCall.toolName}-${index}`}
              className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="text-2xl">{getAppIcon(functionCall.appName)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{functionCall.customName}</h4>
                    {functionCall.isConfigured && (
                      <FiCheck className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{functionCall.customDescription}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>App: {functionCall.appName}</span>
                    <span>Tool: {functionCall.toolName}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEditFunctionCall(functionCall)}
                  className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Edit function call"
                >
                  <FiSettings className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveFunctionCall(index)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Remove function call"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : customerId ? (
        <div className="text-center py-12">
          <FiZap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-400 mb-2">No Function Calls Configured</h4>
          <p className="text-gray-500 mb-6">
            Add function calls to enable your agent to interact with customer's connected apps.
          </p>
          <button
            type="button"
            onClick={() => setIsToolSelectorOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            Add Your First Function Call
          </button>
        </div>
      ) : null}

      {/* Tool Selector Modal */}
      {isToolSelectorOpen && (
        <ToolSelector
          isOpen={isToolSelectorOpen}
          onClose={() => setIsToolSelectorOpen(false)}
          customerId={customerId}
          availableApps={availableApps}
          isLoading={loadingApps}
          onSelectTool={handleAddFunctionCall}
          existingFunctionCalls={functionCalls}
        />
      )}

      {/* Function Call Editor Modal */}
      {editingFunctionCall && (
        <FunctionCallEditor
          isOpen={!!editingFunctionCall}
          onClose={() => setEditingFunctionCall(null)}
          functionCall={editingFunctionCall}
          onSave={handleSaveFunctionCall}
          customerId={customerId}
        />
      )}
    </div>
  );
};

export default FunctionCallsPanel;
