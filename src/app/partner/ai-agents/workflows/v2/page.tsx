'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiSave, FiPlay, FiSettings, FiArrowLeft, FiZoomIn, FiZoomOut, FiMaximize, FiDatabase } from 'react-icons/fi';
import { toast, Toaster } from 'react-hot-toast';
import ReactFlowWorkflowCanvas from '@/components/workflow/v2/ReactFlowWorkflowCanvas';
import ReactFlowNodePalette from '@/components/workflow/v2/ReactFlowNodePalette';
import { WorkflowData } from '@/types/workflow';
import { BrowserStorageManager } from '@/lib/workflow/browserStorage';

// Loading component for Suspense fallback
function WorkflowDesignerLoading() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading React Flow Workflow Designer...</p>
      </div>
    </div>
  );
}

// Main workflow designer component
function ReactFlowWorkflowDesignerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const template = searchParams?.get('template');
  const customerId = searchParams?.get('customer');
  
  const [workflowData, setWorkflowData] = useState<WorkflowData>({
    id: '',
    name: 'Untitled Workflow',
    description: '',
    customerId: customerId || '',
    nodes: [],
    connections: [],
    settings: {
      autoSave: true,
      gridSnap: true,
      showGrid: true
    }
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(workflowData.name);
  const [partnerId, setPartnerId] = useState<string>('');
  const [workflowUuid, setWorkflowUuid] = useState<string>('');

  useEffect(() => {
    // Initialize workflow
    const storedPartnerId = localStorage.getItem('partner_id') || 'demo_partner';
    setPartnerId(storedPartnerId);

    if (customerId) {
      const uuid = BrowserStorageManager.generateWorkflowUUID(storedPartnerId, customerId);
      setWorkflowUuid(uuid);

      const newWorkflowData = {
        ...workflowData,
        id: uuid,
        customerId: customerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setWorkflowData(newWorkflowData);
      BrowserStorageManager.saveWorkflow(newWorkflowData, storedPartnerId, customerId);
      localStorage.setItem('current_workflow_uuid', uuid);
    }
  }, [customerId]);

  useEffect(() => {
    setTempName(workflowData.name);
  }, [workflowData.name]);

  // Auto-save workflow data
  useEffect(() => {
    if (workflowData.id && partnerId && customerId && workflowData.settings?.autoSave) {
      const timeoutId = setTimeout(() => {
        const updatedWorkflow = {
          ...workflowData,
          updatedAt: new Date().toISOString()
        };
        BrowserStorageManager.saveWorkflow(updatedWorkflow, partnerId, customerId);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [workflowData, partnerId, customerId]);

  const handleNameEdit = () => {
    setIsEditingName(true);
    setTempName(workflowData.name);
  };

  const handleNameSave = () => {
    if (tempName.trim()) {
      setWorkflowData(prev => ({ ...prev, name: tempName.trim() }));
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setTempName(workflowData.name);
    setIsEditingName(false);
  };

  const handleNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Generate ID if new workflow
      if (!workflowData.id) {
        setWorkflowData(prev => ({
          ...prev,
          id: `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }));
      }

      toast.success('Workflow saved successfully');
    } catch (error) {
      toast.error('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = () => {
    toast('Test functionality coming soon!', {
      icon: 'ℹ️',
      duration: 3000,
    });
  };

  const handleWorkflowChange = useCallback((updatedWorkflow: Partial<WorkflowData>) => {
    setWorkflowData(prev => ({ ...prev, ...updatedWorkflow }));
  }, []);

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            {isEditingName ? (
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleNameKeyPress}
                className="text-xl font-semibold bg-gray-700 text-white px-2 py-1 rounded border-none outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <h1
                className="text-xl font-semibold cursor-pointer hover:text-blue-400 transition-colors"
                onClick={handleNameEdit}
                title="Click to edit workflow name"
              >
                {workflowData.name}
              </h1>
            )}
            <p className="text-sm text-gray-400">{workflowData.description}</p>
            <div className="text-xs text-green-400 font-medium">
              ✨ React Flow Powered - Professional Workflow Designer
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
          >
            <FiPlay className="w-4 h-4" />
            Test Workflow
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            <FiSave className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Node Palette */}
        <ReactFlowNodePalette />
        
        {/* Canvas Area */}
        <div className="flex-1 relative">
          <ReactFlowWorkflowCanvas
            workflowData={workflowData}
            onWorkflowChange={handleWorkflowChange}
          />
        </div>
      </div>
    </div>
  );
}

// Main export with Suspense boundary
export default function ReactFlowWorkflowDesignerPage() {
  return (
    <Suspense fallback={<WorkflowDesignerLoading />}>
      <ReactFlowWorkflowDesignerContent />
    </Suspense>
  );
}