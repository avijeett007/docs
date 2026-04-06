'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Connection,
  EdgeChange,
  NodeChange,
  ConnectionMode,
  Panel,
  MarkerType,
  SelectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { WorkflowData, WorkflowNode, WorkflowConnection } from '@/types/workflow';
import KnovaAgentReactFlowNode from './nodes/KnovaAgentReactFlowNode';
import VAPIAgentReactFlowNode from './nodes/VAPIAgentReactFlowNode';
import RetellAgentReactFlowNode from './nodes/RetellAgentReactFlowNode';
import UltravoxAgentReactFlowNode from './nodes/UltravoxAgentReactFlowNode';
import WebhookTriggerReactFlowNode from './nodes/WebhookTriggerReactFlowNode';
import NoteReactFlowNode from './nodes/NoteReactFlowNode';

interface ReactFlowWorkflowCanvasProps {
  workflowData: WorkflowData;
  onWorkflowChange: (updates: Partial<WorkflowData>) => void;
}

const nodeTypes = {
  'knova-agent': KnovaAgentReactFlowNode,
  'vapi-agent': VAPIAgentReactFlowNode,
  'retell-agent': RetellAgentReactFlowNode,
  'ultravox-agent': UltravoxAgentReactFlowNode,
  'webhook-trigger': WebhookTriggerReactFlowNode,
  'note': NoteReactFlowNode,
};

export default function ReactFlowWorkflowCanvas({
  workflowData,
  onWorkflowChange,
}: ReactFlowWorkflowCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Convert our workflow nodes to React Flow nodes
  const convertToReactFlowNodes = useCallback((workflowNodes: WorkflowNode[]): Node[] => {
    return workflowNodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        ...node.data,
        nodePosition: node.position,
        customerId: workflowData.customerId,
        onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => {
          const updatedNodes = workflowData.nodes.map(n => 
            n.id === nodeId ? { ...n, ...updates } : n
          );
          onWorkflowChange({ nodes: updatedNodes });
        },
        onSelect: (node: Node) => setSelectedNode(node),
        onDelete: (nodeId: string) => {
          const updatedNodes = workflowData.nodes.filter(n => n.id !== nodeId);
          const updatedConnections = workflowData.connections.filter(c => 
            c.source !== nodeId && c.target !== nodeId
          );
          onWorkflowChange({ 
            nodes: updatedNodes,
            connections: updatedConnections 
          });
        }
      },
      selected: selectedNode?.id === node.id,
    }));
  }, [workflowData.nodes, workflowData.connections, workflowData.customerId, onWorkflowChange, selectedNode]);

  // Convert our workflow connections to React Flow edges
  const convertToReactFlowEdges = useCallback((workflowConnections: WorkflowConnection[]): Edge[] => {
    return workflowConnections.map(connection => ({
      id: connection.id,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'smoothstep',
      animated: true,
      style: {
        stroke: '#6b7280',
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#6b7280',
      },
    }));
  }, []);

  const initialNodes = useMemo(() => convertToReactFlowNodes(workflowData.nodes), [convertToReactFlowNodes, workflowData.nodes]);
  const initialEdges = useMemo(() => convertToReactFlowEdges(workflowData.connections), [convertToReactFlowEdges, workflowData.connections]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync edges when workflow connections change
  useEffect(() => {
    const newEdges = convertToReactFlowEdges(workflowData.connections);
    setEdges(newEdges);
  }, [workflowData.connections, convertToReactFlowEdges, setEdges]);

  // Sync nodes when workflow nodes change
  useEffect(() => {
    const newNodes = convertToReactFlowNodes(workflowData.nodes);
    setNodes(newNodes);
  }, [workflowData.nodes, convertToReactFlowNodes, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      const newConnection: WorkflowConnection = {
        id: `edge-${params.source}-${params.target}-${Date.now()}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle || 'output',
        targetHandle: params.targetHandle || 'input',
      };

      // Update both the workflow data and the ReactFlow edges
      const updatedConnections = [...workflowData.connections, newConnection];
      onWorkflowChange({ connections: updatedConnections });

      // Also update the ReactFlow edges immediately
      const newEdge = {
        id: newConnection.id,
        source: newConnection.source,
        target: newConnection.target,
        sourceHandle: newConnection.sourceHandle,
        targetHandle: newConnection.targetHandle,
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: '#6b7280',
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#6b7280',
        },
      };
      setEdges(eds => addEdge(newEdge, eds));
    },
    [workflowData.connections, onWorkflowChange, setEdges]
  );

  const onNodesChangeHandler = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      
      // Update our workflow data when nodes change position
      const positionChanges = changes.filter(change => change.type === 'position');
      if (positionChanges.length > 0) {
        const updatedNodes = workflowData.nodes.map(node => {
          const change = positionChanges.find(c => c.id === node.id);
          if (change && change.type === 'position' && change.position) {
            return { ...node, position: change.position };
          }
          return node;
        });
        onWorkflowChange({ nodes: updatedNodes });
      }
    },
    [onNodesChange, workflowData.nodes, onWorkflowChange]
  );

  const onEdgesChangeHandler = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      
      // Handle edge removal
      const removeChanges = changes.filter(change => change.type === 'remove');
      if (removeChanges.length > 0) {
        const removedEdgeIds = removeChanges.map(change => change.id);
        const updatedConnections = workflowData.connections.filter(
          connection => !removedEdgeIds.includes(connection.id)
        );
        onWorkflowChange({ connections: updatedConnections });
      }
    },
    [onEdgesChange, workflowData.connections, onWorkflowChange]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = (event.target as HTMLElement)
        .closest('.react-flow')
        ?.getBoundingClientRect();

      if (!reactFlowBounds) return;

      const nodeType = event.dataTransfer.getData('application/reactflow');
      
      if (!nodeType) return;

      const position = {
        x: event.clientX - reactFlowBounds.left - 140, // Center the node
        y: event.clientY - reactFlowBounds.top - 40,
      };

      const newNode: WorkflowNode = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: {
          name: getDefaultNodeName(nodeType),
          description: getDefaultNodeDescription(nodeType),
          config: getDefaultNodeConfig(nodeType),
        },
      };

      const updatedNodes = [...workflowData.nodes, newNode];
      onWorkflowChange({ nodes: updatedNodes });
      
      // Also add to React Flow state immediately
      const newReactFlowNode = {
        id: newNode.id,
        type: newNode.type,
        position: newNode.position,
        data: {
          ...newNode.data,
          customerId: workflowData.customerId,
          onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => {
            const updatedNodes = workflowData.nodes.map(n => 
              n.id === nodeId ? { ...n, ...updates } : n
            );
            onWorkflowChange({ nodes: updatedNodes });
          },
          onSelect: (node: Node) => setSelectedNode(node),
          onDelete: (nodeId: string) => {
            const updatedNodes = workflowData.nodes.filter(n => n.id !== nodeId);
            const updatedConnections = workflowData.connections.filter(c => 
              c.source !== nodeId && c.target !== nodeId
            );
            onWorkflowChange({ 
              nodes: updatedNodes,
              connections: updatedConnections 
            });
            // Also remove from React Flow state
            setNodes(nodes => nodes.filter(n => n.id !== nodeId));
          }
        },
        selected: false,
      };
      setNodes(nodes => [...nodes, newReactFlowNode]);
    },
    [workflowData.nodes, workflowData.connections, workflowData.customerId, onWorkflowChange, setNodes, setSelectedNode]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="w-full h-full bg-gray-900 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeHandler}
        onEdgesChange={onEdgesChangeHandler}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{
          padding: 0.1,
          includeHiddenNodes: false,
        }}
        className="bg-gray-900"
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={['Meta', 'Ctrl']}
        panOnScroll={true}
        selectionOnDrag={false}
        panOnDrag={[1, 2]}
        selectionMode={SelectionMode.Partial}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1}
          color="#374151"
        />
        
        <Controls 
          className="bg-gray-800 border border-gray-600 rounded-lg"
          showZoom={true}
          showFitView={true}
          showInteractive={true}
        />
        
        <MiniMap 
          className="bg-gray-800 border border-gray-600 rounded-lg"
          nodeColor="#4B5563"
          maskColor="rgb(17, 24, 39, 0.8)"
        />

        {/* Info Panel */}
        <Panel position="top-left" className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 m-4">
          <div className="text-white text-sm">
            <div className="font-semibold mb-1">Workflow Designer</div>
            <div className="text-gray-400 text-xs space-y-1">
              <div>Nodes: {nodes.length}</div>
              <div>Connections: {edges.length}</div>
              {selectedNode && (
                <div>Selected: {selectedNode.data?.name || selectedNode.id}</div>
              )}
            </div>
          </div>
        </Panel>

        {/* Instructions Panel */}
        {nodes.length === 0 && (
          <Panel position="top-center" className="pointer-events-none">
            <div className="text-center text-gray-500">
              <div className="text-lg mb-2">🎨 Welcome to Workflow Designer</div>
              <div className="text-sm">Drag nodes from the left panel to start building</div>
              <div className="text-xs mt-2">
                Professional • Smooth • Intuitive Experience
              </div>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

// Helper functions
function getDefaultNodeName(nodeType: string): string {
  const names: Record<string, string> = {
    'webhook-trigger': 'Webhook Trigger',
    'knova-agent': 'Knova AI Agent',
    'vapi-agent': 'VAPI Agent',
    'retell-agent': 'Retell Agent',
    'ultravox-agent': 'Ultravox Agent',
    'note': 'Note',
  };
  return names[nodeType] || 'New Node';
}

function getDefaultNodeDescription(nodeType: string): string {
  const descriptions: Record<string, string> = {
    'webhook-trigger': 'HTTP endpoint to trigger workflows',
    'knova-agent': 'AI Voice Assistant for customer interactions',
    'vapi-agent': 'VAPI voice agent integration',
    'retell-agent': 'Retell AI voice agent',
    'ultravox-agent': 'Ultravox AI voice agent',
    'note': 'Documentation and notes',
  };
  return descriptions[nodeType] || 'Node description';
}

function getDefaultNodeConfig(nodeType: string): Record<string, any> {
  const configs: Record<string, Record<string, any>> = {
    'webhook-trigger': {
      url: '',
      method: 'POST',
      headers: {},
      authentication: 'none',
      timeout: 30000,
    },
    'knova-agent': {
      agentType: 'voice',
      channel: 'phone',
      voice: 'default',
      model: 'gpt-4',
      systemPrompt: '',
      tools: [],
      knowledgebase: null,
    },
    'vapi-agent': {
      apiKey: '',
      assistantId: '',
      phoneNumber: '',
      voiceId: 'jennifer',
      model: 'gpt-3.5-turbo',
    },
    'retell-agent': {
      apiKey: '',
      agentId: '',
      phoneNumber: '',
      voice: 'Liam',
      language: 'en-US',
      responseFormat: 'text',
      interruption: true,
    },
    'ultravox-agent': {
      apiKey: '',
      modelId: '',
      voice: 'default',
      language: 'en',
      temperature: 0.7,
      maxTokens: 1000,
    },
    'note': {
      content: 'Double-click to edit this note...',
      backgroundColor: '#fbbf24',
      textColor: '#000000',
      fontSize: 'medium',
    },
  };
  return configs[nodeType] || {};
}