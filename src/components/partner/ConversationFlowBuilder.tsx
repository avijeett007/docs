'use client';

import React, { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  NodeTypes,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FiPlus, FiEdit3, FiTrash2, FiPlay } from 'react-icons/fi';
import clsx from 'clsx';

interface ConversationStep {
  name: string;
  step_description: string;
  what_to_say: string;
  next_actions: Array<{
    when_customer_says: string;
    go_to_step: string;
  }>;
  available_abilities: string[];
}

interface ConversationFlowBuilderProps {
  steps: ConversationStep[];
  onStepsChange: (steps: ConversationStep[]) => void;
  startingStep: string;
  onStartingStepChange: (stepName: string) => void;
  onEditStep: (stepIndex: number) => void;
}

// Custom Node Component for Conversation Steps
const ConversationStepNode = ({ data }: { data: any }) => {
  const { step, isStarting, onEdit, onDelete, index } = data;
  
  return (
    <div className={clsx(
      'bg-gray-800 border-2 rounded-lg p-4 min-w-[200px] max-w-[250px] shadow-lg relative',
      isStarting
        ? 'border-green-500 bg-green-500/10'
        : 'border-gray-600 hover:border-blue-500/50'
    )}>
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={clsx(
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
            isStarting ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
          )}>
            {isStarting ? '🚀' : index + 1}
          </div>
          <span className="text-white font-medium text-sm truncate">
            {step.name || `Step ${index + 1}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(index)}
            className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
            title="Edit step"
          >
            <FiEdit3 className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(index)}
            className="p-1 text-red-400 hover:text-red-300 transition-colors"
            title="Delete step"
          >
            <FiTrash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Content Preview */}
      <div className="space-y-2">
        {step.step_description && (
          <p className="text-xs text-gray-300 line-clamp-2">
            {step.step_description}
          </p>
        )}
        
        {step.what_to_say && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2">
            <p className="text-xs text-blue-300 line-clamp-2">
              💬 "{step.what_to_say}"
            </p>
          </div>
        )}

        {/* Abilities */}
        {step.available_abilities && step.available_abilities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {step.available_abilities.slice(0, 3).map((ability: string, i: number) => (
              <span key={i} className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                {ability.replace('_', ' ')}
              </span>
            ))}
            {step.available_abilities.length > 3 && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-500/20 text-gray-400 rounded">
                +{step.available_abilities.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Next Actions Count */}
        {step.next_actions && step.next_actions.length > 0 && (
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <FiPlay className="w-3 h-3" />
            {step.next_actions.length} next action{step.next_actions.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {isStarting && (
        <div className="mt-2 text-xs text-green-300 font-medium">
          ⭐ Starting Step
        </div>
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  conversationStep: ConversationStepNode,
};

const ConversationFlowBuilder: React.FC<ConversationFlowBuilderProps> = ({
  steps,
  onStepsChange,
  startingStep,
  onEditStep,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [nextNodeId, setNextNodeId] = useState(1);

  const handleDeleteStep = useCallback((stepIndex: number) => {
    const updatedSteps = steps.filter((_, index) => index !== stepIndex);
    onStepsChange(updatedSteps);
  }, [steps, onStepsChange]);

  // Convert steps to nodes and edges
  useEffect(() => {
    const newNodes: Node[] = steps.map((step, index) => ({
      id: `step-${index}`,
      type: 'conversationStep',
      position: { x: (index % 2) * 400, y: Math.floor(index / 2) * 300 },
      data: {
        step,
        index,
        isStarting: step.name === startingStep,
        onEdit: onEditStep,
        onDelete: handleDeleteStep,
      },
    }));

    const newEdges: Edge[] = [];
    steps.forEach((step, stepIndex) => {
      if (step.next_actions && step.next_actions.length > 0) {
        step.next_actions.forEach((action, actionIndex) => {
          if (action.go_to_step && action.go_to_step.trim() !== '') {
            const targetStepIndex = steps.findIndex(s => s.name === action.go_to_step);
            if (targetStepIndex !== -1 && targetStepIndex !== stepIndex) {
              const edge = {
                id: `edge-${stepIndex}-${targetStepIndex}-${actionIndex}`,
                source: `step-${stepIndex}`,
                target: `step-${targetStepIndex}`,
                type: 'smoothstep',
                animated: true,
                style: {
                  stroke: '#3b82f6',
                  strokeWidth: 2,
                },
                label: action.when_customer_says || 'Next',
              };
              console.log('Creating edge:', edge);
              newEdges.push(edge);
            }
          }
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
    setNextNodeId(steps.length);

    // Debug logging
    if (newEdges.length > 0) {
      console.log('Setting edges:', newEdges);
    }
  }, [steps, startingStep, onEditStep, handleDeleteStep]);

  const handleAddStep = useCallback(() => {
    const newStep: ConversationStep = {
      name: `step_${nextNodeId}`,
      step_description: '',
      what_to_say: '',
      next_actions: [],
      available_abilities: ['end_call'],
    };

    const updatedSteps = [...steps, newStep];
    onStepsChange(updatedSteps);
    
    // Auto-edit the new step
    setTimeout(() => {
      onEditStep(updatedSteps.length - 1);
    }, 100);
  }, [steps, nextNodeId, onStepsChange, onEditStep]);

  const onConnect = useCallback(
    (params: Connection) => {
      // This would be used for manual connections in the future
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const createTestScenario = useCallback(() => {
    const testSteps: ConversationStep[] = [
      {
        name: 'Greeting',
        step_description: 'Greet the customer',
        what_to_say: 'Hello! How can I help you today?',
        next_actions: [
          { when_customer_says: 'I need help', go_to_step: 'Help' }
        ],
        available_abilities: [],
      },
      {
        name: 'Help',
        step_description: 'Provide help to the customer',
        what_to_say: 'I\'d be happy to help you!',
        next_actions: [],
        available_abilities: [],
      }
    ];
    onStepsChange(testSteps);
  }, [onStepsChange]);

  return (
    <div className="h-[600px] bg-gray-900 rounded-lg border border-gray-600 relative">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <button
          onClick={handleAddStep}
          className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors shadow-lg"
        >
          <FiPlus className="w-4 h-4" />
          Add Step
        </button>

        <button
          onClick={createTestScenario}
          className="flex items-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors shadow-lg"
        >
          <FiPlay className="w-4 h-4" />
          Test Connection
        </button>
        
        {steps.length > 0 && (
          <div className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-400">Steps: {steps.length} | Edges: {edges.length}</span>
          </div>
        )}
      </div>

      {/* Empty State */}
      {steps.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-lg font-medium text-white mb-2">
              Design Your Conversation Flow
            </h3>
            <p className="text-gray-400 mb-4 max-w-md">
              Create conversation steps and connect them to build the perfect customer journey
            </p>
            <button
              onClick={handleAddStep}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors mx-auto"
            >
              <FiPlus className="w-4 h-4" />
              Create Your First Step
            </button>
          </div>
        </div>
      )}

      {/* Debug Info */}
      {edges.length > 0 && (
        <div className="absolute top-20 left-4 bg-red-500 text-white p-2 rounded z-50 text-xs">
          <div>Edges: {edges.length}</div>
          {edges.map((edge, i) => (
            <div key={i}>
              {edge.source} → {edge.target} ({edge.label})
            </div>
          ))}
        </div>
      )}

      {/* React Flow */}
      <div style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          className="bg-gray-900"
          proOptions={{ hideAttribution: true }}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.1}
          maxZoom={2}
        >
        <Controls className="bg-gray-800 border-gray-600" />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#374151"
        />
      </ReactFlow>
      </div>
    </div>
  );
};

export default ConversationFlowBuilder;
