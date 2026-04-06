'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiSettings, FiZap, FiLoader, FiAlertCircle, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import ToolSelector from './ToolSelector';
import VapiFunctionCallEditor from './VapiFunctionCallEditor';

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
}

interface VapiFunctionCallsPanelProps {
  customerId: string;
  agentId?: string;
  functionCalls: FunctionCall[];
  onChange: (functionCalls: FunctionCall[]) => void;
  isLoading?: boolean;
  mode: 'create' | 'edit';
}

const VapiFunctionCallsPanel: React.FC<VapiFunctionCallsPanelProps> = ({
  customerId,
  agentId,
  functionCalls,
  onChange,
  isLoading = false,
  mode
}) => {
  console.log('[VapiFunctionCallsPanel] Received props:', {
    customerId,
    agentId,
    functionCallsCount: functionCalls.length,
    mode
  });

  const [availableApps, setAvailableApps] = useState<Record<string, ToolSchema[]>>({});
  const [loadingApps, setLoadingApps] = useState(false);
  const [showToolSelector, setShowToolSelector] = useState(false);
  const [showFunctionEditor, setShowFunctionEditor] = useState(false);
  const [editingFunctionCall, setEditingFunctionCall] = useState<FunctionCall | null>(null);

  // Load available apps when tool selector is opened
  useEffect(() => {
    if (customerId && showToolSelector) {
      loadAvailableApps();
    }
  }, [customerId, showToolSelector]);

  const loadAvailableApps = async () => {
    try {
      setLoadingApps(true);
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

      if (response.ok) {
        const data = await response.json();
        // The API response already has the correct structure in data.data
        setAvailableApps(data.data || {});
      } else {
        console.error('Failed to load available tools:', response.status);
        toast.error('Failed to load available tools');
      }
    } catch (error) {
      console.error('Error loading available tools:', error);
      toast.error('Failed to load available tools');
    } finally {
      setLoadingApps(false);
    }
  };

  const handleAddFunctionCallClick = () => {
    if (!customerId) {
      toast.error('Please select a customer first');
      return;
    }
    setShowToolSelector(true);
  };

  const handleAddFunctionCall = (toolSelection: { appName: string; toolName: string; toolSchema: ToolSchema }) => {
    // Generate a valid function name in the format: appname_toolname
    const validFunctionName = `${toolSelection.appName.toLowerCase()}_${toolSelection.toolName.toLowerCase()}`;

    const newFunctionCall: FunctionCall = {
      appName: toolSelection.appName,
      toolName: toolSelection.toolName,
      customName: validFunctionName,
      customDescription: toolSelection.toolSchema.description || `Execute ${toolSelection.toolName} in ${toolSelection.appName}`,
      isConfigured: false
    };

    setEditingFunctionCall(newFunctionCall);
    setShowToolSelector(false);
    setShowFunctionEditor(true);
  };

  const handleEditFunctionCall = (functionCall: FunctionCall) => {
    setEditingFunctionCall(functionCall);
    setShowFunctionEditor(true);
  };

  const handleSaveFunctionCall = (updatedFunctionCall: FunctionCall) => {
    const existingIndex = functionCalls.findIndex(
      fc => fc.appName === updatedFunctionCall.appName && fc.toolName === updatedFunctionCall.toolName
    );

    let updatedFunctionCalls;
    if (existingIndex >= 0) {
      // Update existing function call
      updatedFunctionCalls = [...functionCalls];
      updatedFunctionCalls[existingIndex] = updatedFunctionCall;
    } else {
      // Add new function call
      updatedFunctionCalls = [...functionCalls, updatedFunctionCall];
    }

    onChange(updatedFunctionCalls);
    setShowFunctionEditor(false);
    setEditingFunctionCall(null);
    toast.success('Function call saved successfully');
  };

  const handleSaveAndAddAnotherFunctionCall = (updatedFunctionCall: FunctionCall) => {
    const existingIndex = functionCalls.findIndex(
      fc => fc.appName === updatedFunctionCall.appName && fc.toolName === updatedFunctionCall.toolName
    );

    let updatedFunctionCalls;
    if (existingIndex >= 0) {
      // Update existing function call
      updatedFunctionCalls = [...functionCalls];
      updatedFunctionCalls[existingIndex] = updatedFunctionCall;
    } else {
      // Add new function call
      updatedFunctionCalls = [...functionCalls, updatedFunctionCall];
    }

    onChange(updatedFunctionCalls);
    setShowFunctionEditor(false);
    setEditingFunctionCall(null);
    toast.success('Function call saved successfully');

    // Immediately show the tool selector to add another function
    setShowToolSelector(true);
  };

  const handleRemoveFunctionCall = (functionCall: FunctionCall) => {
    const updatedFunctionCalls = functionCalls.filter(
      fc => !(fc.appName === functionCall.appName && fc.toolName === functionCall.toolName)
    );
    onChange(updatedFunctionCalls);
    toast.success('Function call removed');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-400">
          <FiLoader className="w-5 h-5 animate-spin" />
          <span>Loading function calls...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-700 pb-4">
        <h3 className="text-lg font-semibold text-white mb-2">VAPI Function Calls</h3>
        <p className="text-gray-400 text-sm">
          Configure function calls to extend your VAPI agent's capabilities with external tools and APIs.
        </p>
      </div>

      {/* Function Calls List */}
      <div className="space-y-4">
        {functionCalls.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiZap className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No Function Calls Configured</h3>
            <p className="text-gray-400 text-sm mb-6">
              Add function calls to enable your VAPI agent to interact with external tools and services.
            </p>
            <button
              type="button"
              onClick={handleAddFunctionCallClick}
              disabled={!customerId}
              className={clsx(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                customerId
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              )}
            >
              <FiPlus className="w-4 h-4" />
              Add Function Call
            </button>
            {!customerId && (
              <p className="text-amber-400 text-sm mt-2 flex items-center justify-center gap-1">
                <FiAlertCircle className="w-4 h-4" />
                Please select a customer first
              </p>
            )}
          </div>
        ) : (
          <>
            {functionCalls.map((functionCall, index) => (
              <div
                key={`${functionCall.appName}-${functionCall.toolName}`}
                className="p-4 bg-gray-800 rounded-lg border border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <FiZap className="w-4 h-4 text-blue-400" />
                        <h4 className="font-medium text-white">{functionCall.customName}</h4>
                      </div>
                      {functionCall.isConfigured && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded">
                          <FiCheck className="w-3 h-3" />
                          Configured
                        </div>
                      )}
                    </div>
                    <p className="text-gray-300 text-sm mb-2">{functionCall.customDescription}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>App: {functionCall.appName}</span>
                      <span>Tool: {functionCall.toolName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      type="button"
                      onClick={() => handleEditFunctionCall(functionCall)}
                      className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                      title="Edit function call"
                    >
                      <FiSettings className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveFunctionCall(functionCall)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Remove function call"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add More Button */}
            <button
              type="button"
              onClick={handleAddFunctionCallClick}
              disabled={!customerId}
              className={clsx(
                "w-full p-4 border-2 border-dashed rounded-lg transition-colors flex items-center justify-center gap-2",
                customerId
                  ? "border-gray-600 hover:border-blue-500 text-gray-400 hover:text-blue-400"
                  : "border-gray-700 text-gray-500 cursor-not-allowed"
              )}
            >
              <FiPlus className="w-4 h-4" />
              Add Another Function Call
            </button>
          </>
        )}
      </div>

      {/* Tool Selector Modal */}
      <ToolSelector
        isOpen={showToolSelector}
        onClose={() => setShowToolSelector(false)}
        customerId={customerId}
        availableApps={availableApps}
        isLoading={loadingApps}
        onSelectTool={handleAddFunctionCall}
        existingFunctionCalls={functionCalls}
        includeRetellTools={false}
      />

      {/* Function Call Editor Modal */}
      {editingFunctionCall && (
        <VapiFunctionCallEditor
          isOpen={showFunctionEditor}
          onClose={() => {
            setShowFunctionEditor(false);
            setEditingFunctionCall(null);
          }}
          functionCall={editingFunctionCall}
          onSave={handleSaveFunctionCall}
          onSaveAndAddAnother={handleSaveAndAddAnotherFunctionCall}
          customerId={customerId}
        />
      )}
    </div>
  );
};

export default VapiFunctionCallsPanel;
