'use client';

import React, { useState } from 'react';
import RetellAgentModal from '@/components/partner/RetellAgentModal';
import FunctionCallsPanel from '@/components/partner/FunctionCallsPanel';

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

export default function TestFunctionCallsPage() {
  const [functionCalls, setFunctionCalls] = useState<FunctionCall[]>([
    {
      appName: 'gmail',
      toolName: 'send_email',
      customName: 'send_customer_email',
      customDescription: 'Send an email to a customer with personalized content',
      isConfigured: true,
      webhookUrl: 'https://example.com/webhook/...'
    }
  ]);

  const [selectedCustomerId, setSelectedCustomerId] = useState('test-customer-123');
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">Function Calls Test Page</h1>
          <p className="text-gray-400">
            This page is for testing the Function Calls UI components.
          </p>
        </div>

        {/* Test Controls */}
        <div className="mb-8 p-6 bg-gray-800 rounded-lg border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Test Controls</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Open RetellAgentModal (Create Mode)
              </button>
              <div className="text-sm text-gray-400">
                Test the integrated function calls tab in the actual modal
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Selected Customer ID (for standalone panel)
              </label>
              <input
                type="text"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full max-w-md px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter customer ID..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave empty to test the "no customer selected" state
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Current Function Calls
              </label>
              <div className="text-sm text-gray-400">
                {functionCalls.length} function call{functionCalls.length !== 1 ? 's' : ''} configured
              </div>
            </div>
          </div>
        </div>

        {/* Standalone Function Calls Panel */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Standalone Function Calls Panel</h2>
          <FunctionCallsPanel
            customerId={selectedCustomerId}
            agentId="test-agent-123"
            functionCalls={functionCalls}
            onChange={setFunctionCalls}
            mode="create"
          />
        </div>

        {/* RetellAgentModal with Function Calls Integration */}
        <RetellAgentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          mode="create"
          onAgentSaved={(agent) => {
            console.log('Agent saved:', agent);
            setIsModalOpen(false);
          }}
        />

        {/* Debug Info */}
        <div className="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Debug Information</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Current State:</h3>
              <pre className="text-xs text-gray-400 bg-gray-900 p-3 rounded border overflow-x-auto">
                {JSON.stringify({
                  customerId: selectedCustomerId,
                  functionCallsCount: functionCalls.length,
                  functionCalls: functionCalls
                }, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 p-6 bg-blue-900/20 border border-blue-600/30 rounded-lg">
          <h2 className="text-lg font-semibold text-blue-200 mb-4">Testing Instructions</h2>
          <div className="space-y-2 text-sm text-blue-100">
            <p>• <strong>Test 1:</strong> Click "Open RetellAgentModal" to test the integrated function calls tab</p>
            <p>• <strong>Test 2:</strong> In the modal, navigate to the "Function Calls" tab (lightning bolt icon)</p>
            <p>• <strong>Test 3:</strong> Select a customer in the Setup tab first, then go to Function Calls</p>
            <p>• <strong>Test 4:</strong> Test the standalone panel below by clearing/setting customer ID</p>
            <p>• <strong>Test 5:</strong> Click "Add Function Call" to test tool selection (will show "no connected apps")</p>
            <p>• <strong>Test 6:</strong> Click settings/trash icons on existing function calls</p>
            <p>• <strong>Note:</strong> This is a test environment, so actual tool data won't be available</p>
          </div>
        </div>
      </div>
    </div>
  );
}
