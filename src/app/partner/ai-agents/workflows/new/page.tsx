'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiSave, FiPlay, FiSettings, FiArrowLeft, FiZoomIn, FiZoomOut, FiMaximize, FiDatabase } from 'react-icons/fi';
import { toast, Toaster } from 'react-hot-toast';
import WorkflowCanvas from '@/components/workflow/WorkflowCanvas';
import NodePalette from '@/components/workflow/NodePalette';
import NodeConfigPanel from '@/components/workflow/NodeConfigPanel';
import WorkflowToolbar from '@/components/workflow/WorkflowToolbar';
import WorkflowTemplateSelector from '@/components/workflow/WorkflowTemplateSelector';
import WebhookPanel from '@/components/workflow/WebhookPanel';
import WorkflowDataPanel from '@/components/workflow/WorkflowDataPanel';
import StorageDebugPanel from '@/components/workflow/StorageDebugPanel';
import { WorkflowNode, WorkflowConnection, WorkflowData } from '@/types/workflow';
import { WorkflowTemplateManager } from '@/lib/workflow/workflowTemplates';
import { WebhookManager } from '@/lib/workflow/webhookManager';
import { WorkflowDataManager } from '@/lib/workflow/workflowDataManager';
import { BrowserStorageManager } from '@/lib/workflow/browserStorage';

// Loading component for Suspense fallback
function WorkflowDesignerLoading() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading Workflow Designer...</p>
      </div>
    </div>
  );
}

// Main workflow designer component that uses useSearchParams
function WorkflowDesignerContent() {
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
  
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showWebhookPanel, setShowWebhookPanel] = useState(false);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(workflowData.name);
  const [partnerId, setPartnerId] = useState<string>('');
  const [workflowUuid, setWorkflowUuid] = useState<string>('');

  useEffect(() => {
    // Initialize workflow based on template
    if (template) {
      initializeFromTemplate(template);
    } else {
      // Show template selector for new workflows
      setShowTemplateSelector(true);
    }
  }, [template]);

  useEffect(() => {
    setTempName(workflowData.name);
  }, [workflowData.name]);

  // Auto-save workflow data to browser storage
  useEffect(() => {
    if (workflowData.id && partnerId && customerId && workflowData.settings?.autoSave) {
      const timeoutId = setTimeout(() => {
        const updatedWorkflow = {
          ...workflowData,
          updatedAt: new Date().toISOString()
        };
        BrowserStorageManager.saveWorkflow(updatedWorkflow, partnerId, customerId);
      }, 1000); // Auto-save after 1 second of inactivity

      return () => clearTimeout(timeoutId);
    }
  }, [workflowData, partnerId, customerId]);

  const initializeFromTemplate = (templateType: string) => {
    const storedPartnerId = localStorage.getItem('partner_id') || 'demo_partner';
    setPartnerId(storedPartnerId);

    if (templateType === 'blank') {
      // Initialize blank workflow with browser storage
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
      return;
    }

    // Handle legacy template types
    if (templateType === 'facebook-leadgen') {
      templateType = 'facebook-leadgen-ghl';
    }

    // Load from template manager
    const templateData = WorkflowTemplateManager.createWorkflowFromTemplate(templateType);
    if (templateData && customerId) {
      const template = WorkflowTemplateManager.getTemplateById(templateType);
      const uuid = BrowserStorageManager.generateWorkflowUUID(storedPartnerId, customerId);
      setWorkflowUuid(uuid);

      const newWorkflowData = {
        ...workflowData,
        id: uuid,
        customerId: customerId,
        name: template?.name || 'New Workflow',
        description: template?.description || '',
        nodes: templateData.nodes,
        connections: templateData.connections,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setWorkflowData(newWorkflowData);
      BrowserStorageManager.saveWorkflow(newWorkflowData, storedPartnerId, customerId);
      localStorage.setItem('current_workflow_uuid', uuid);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    initializeFromTemplate(templateId);
    setShowTemplateSelector(false);
  };

  const handleCreateBlank = () => {
    setShowTemplateSelector(false);
    // Keep the default blank workflow
  };

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

  const handleNodeAdd = useCallback((nodeType: string, position: { x: number; y: number }) => {
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position,
      data: {
        name: getDefaultNodeName(nodeType),
        description: getDefaultNodeDescription(nodeType),
        config: {}
      }
    };

    setWorkflowData(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));
  }, []);

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setWorkflowData(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => 
        node.id === nodeId ? { ...node, ...updates } : node
      )
    }));
  }, []);

  const handleNodeDelete = useCallback((nodeId: string) => {
    setWorkflowData(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== nodeId),
      connections: prev.connections.filter(conn => 
        conn.source !== nodeId && conn.target !== nodeId
      )
    }));
  }, []);

  const handleConnectionAdd = useCallback((connection: Omit<WorkflowConnection, 'id'>) => {
    const newConnection: WorkflowConnection = {
      id: `conn-${Date.now()}`,
      ...connection
    };

    setWorkflowData(prev => ({
      ...prev,
      connections: [...prev.connections, newConnection]
    }));
  }, []);

  const handleConnectionDelete = useCallback((connectionId: string) => {
    setWorkflowData(prev => ({
      ...prev,
      connections: prev.connections.filter(conn => conn.id !== connectionId)
    }));
  }, []);

  const handleNodeSelect = useCallback((node: WorkflowNode | null) => {
    setSelectedNode(node);
    setIsConfigPanelOpen(!!node);
  }, []);

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

      const result = WorkflowDataManager.saveWorkflow(workflowData);
      if (result.success) {
        toast.success('Workflow saved successfully');
      } else {
        toast.error(`Failed to save workflow: ${result.error}`);
      }
    } catch (error) {
      toast.error('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = () => {
    // Generate webhook URLs if they don't exist
    if (workflowData.id) {
      const existingWebhooks = WebhookManager.getWebhooksByWorkflow(workflowData.id);
      if (existingWebhooks.length === 0) {
        WebhookManager.generateWebhookUrl(workflowData.id, 'test');
        WebhookManager.generateWebhookUrl(workflowData.id, 'production');
      }
    }
    setShowWebhookPanel(true);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleZoomReset = () => {
    setZoom(1);
    setCanvasPosition({ x: 0, y: 0 });
  };

  const getDefaultNodeName = (nodeType: string): string => {
    const names: Record<string, string> = {
      'webhook-trigger': 'Webhook Trigger',
      'facebook': 'Facebook Node',
      'ghl': 'GHL Workflow',
      'knova-agent': 'Knova AI Agent',
      'n8n': 'N8N Integration',
      'info': 'Information Node',
      'action': 'Action Node'
    };
    return names[nodeType] || 'New Node';
  };

  const getDefaultNodeDescription = (nodeType: string): string => {
    const descriptions: Record<string, string> = {
      'webhook-trigger': 'Triggers workflow when webhook is called',
      'facebook': 'Facebook/Meta integration node',
      'ghl': 'Go High Level workflow integration',
      'knova-agent': 'Knova AI agent for voice interactions',
      'n8n': 'N8N workflow automation',
      'info': 'Information and documentation node',
      'action': 'Action execution node'
    };
    return descriptions[nodeType] || 'Node description';
  };

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
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button
              onClick={handleZoomOut}
              className="p-1 hover:bg-gray-600 rounded transition-colors"
            >
              <FiZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-sm">{Math.round(zoom * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-1 hover:bg-gray-600 rounded transition-colors"
            >
              <FiZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomReset}
              className="p-1 hover:bg-gray-600 rounded transition-colors"
            >
              <FiMaximize className="w-4 h-4" />
            </button>
          </div>
          
          <button
            onClick={handleTest}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
          >
            <FiPlay className="w-4 h-4" />
            Test & Webhooks
          </button>
          
          <button
            onClick={() => setShowDataPanel(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            <FiDatabase className="w-4 h-4" />
            Data
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
        <NodePalette onNodeAdd={handleNodeAdd} />
        
        {/* Canvas Area */}
        <div className="flex-1 relative">
          <WorkflowCanvas
            nodes={workflowData.nodes}
            connections={workflowData.connections}
            zoom={zoom}
            position={canvasPosition}
            onNodeUpdate={handleNodeUpdate}
            onNodeDelete={handleNodeDelete}
            onNodeSelect={handleNodeSelect}
            onConnectionAdd={handleConnectionAdd}
            onConnectionDelete={handleConnectionDelete}
            onCanvasMove={setCanvasPosition}
            showGrid={workflowData.settings.showGrid}
            gridSnap={workflowData.settings.gridSnap}
          />
        </div>
        
        {/* Configuration Panel */}
        {isConfigPanelOpen && selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onNodeUpdate={(updates) => handleNodeUpdate(selectedNode.id, updates)}
            onClose={() => setIsConfigPanelOpen(false)}
          />
        )}
      </div>

      {/* Template Selector */}
      <WorkflowTemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelectTemplate={handleTemplateSelect}
        onCreateBlank={handleCreateBlank}
      />

      {/* Webhook Panel */}
      <WebhookPanel
        workflowId={workflowData.id || 'temp-workflow'}
        isOpen={showWebhookPanel}
        onClose={() => setShowWebhookPanel(false)}
      />

      {/* Data Management Panel */}
      <WorkflowDataPanel
        workflow={workflowData}
        isOpen={showDataPanel}
        onClose={() => setShowDataPanel(false)}
        onWorkflowUpdate={(updatedWorkflow) => {
          setWorkflowData(updatedWorkflow);
          setShowDataPanel(false);
        }}
      />

      {/* Storage Debug Panel */}
      <StorageDebugPanel />
    </div>
  );
}

// Main export with Suspense boundary
export default function WorkflowDesignerPage() {
  return (
    <Suspense fallback={<WorkflowDesignerLoading />}>
      <WorkflowDesignerContent />
    </Suspense>
  );
}
