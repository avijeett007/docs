'use client';

import React, { useState, useEffect } from 'react';
import { FiX, FiPlus, FiTrash2, FiArrowRight, FiSave } from 'react-icons/fi';
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

interface AgentAbility {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'call_control' | 'scheduling' | 'information' | 'custom';
  is_default: boolean;
}

interface StepEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: ConversationStep | null;
  stepIndex: number;
  allSteps: ConversationStep[];
  onSave: (stepIndex: number, updatedStep: ConversationStep) => void;
  onCreateNewStep?: (stepName: string) => void;
}

const defaultAbilities: AgentAbility[] = [
  { id: 'end_call', name: 'End Call', description: 'Politely end the conversation', icon: '📞', category: 'call_control', is_default: true },
  { id: 'transfer_call', name: 'Transfer to Human', description: 'Transfer the call to a human agent', icon: '👤', category: 'call_control', is_default: true },
  { id: 'schedule_appointment', name: 'Schedule Appointment', description: 'Help customer schedule an appointment', icon: '📅', category: 'scheduling', is_default: false },
  { id: 'collect_info', name: 'Collect Information', description: 'Gather customer details', icon: '📝', category: 'information', is_default: false },
  { id: 'provide_quote', name: 'Provide Quote', description: 'Give pricing information', icon: '💰', category: 'information', is_default: false },
  { id: 'send_email', name: 'Send Email', description: 'Send follow-up email to customer', icon: '📧', category: 'information', is_default: false },
];

const StepEditorModal: React.FC<StepEditorModalProps> = ({
  isOpen,
  onClose,
  step,
  stepIndex,
  allSteps,
  onSave,
  onCreateNewStep,
}) => {
  const [editedStep, setEditedStep] = useState<ConversationStep | null>(null);
  const [newStepName, setNewStepName] = useState('');
  const [showNewStepInput, setShowNewStepInput] = useState<number | null>(null);

  useEffect(() => {
    if (step && isOpen) {
      setEditedStep({ ...step });
    } else if (!isOpen) {
      setEditedStep(null);
    }
  }, [step, isOpen]);

  if (!isOpen) return null;
  if (!editedStep) return null;

  const handleSave = () => {
    if (editedStep) {
      onSave(stepIndex, editedStep);
      onClose();
    }
  };

  const addNextAction = () => {
    if (editedStep) {
      setEditedStep({
        ...editedStep,
        next_actions: [
          ...editedStep.next_actions,
          { when_customer_says: '', go_to_step: '' }
        ]
      });
    }
  };

  const removeNextAction = (index: number) => {
    if (editedStep) {
      setEditedStep({
        ...editedStep,
        next_actions: editedStep.next_actions.filter((_, i) => i !== index)
      });
    }
  };

  const updateNextAction = (index: number, field: 'when_customer_says' | 'go_to_step', value: string) => {
    if (editedStep) {
      const updatedActions = [...editedStep.next_actions];
      updatedActions[index] = { ...updatedActions[index], [field]: value };
      setEditedStep({
        ...editedStep,
        next_actions: updatedActions
      });
    }
  };

  const toggleAbility = (abilityId: string) => {
    if (editedStep) {
      const abilities = editedStep.available_abilities || [];
      const hasAbility = abilities.includes(abilityId);
      
      setEditedStep({
        ...editedStep,
        available_abilities: hasAbility
          ? abilities.filter(id => id !== abilityId)
          : [...abilities, abilityId]
      });
    }
  };

  const handleCreateNewStep = (stepName: string) => {
    if (onCreateNewStep && stepName.trim()) {
      onCreateNewStep(stepName.trim());
      setNewStepName('');
      setShowNewStepInput(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-600 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-600">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Edit Conversation Step
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Configure what happens in this step of the conversation
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Step Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                📝 Step Name *
              </label>
              <input
                type="text"
                value={editedStep.name}
                onChange={(e) => setEditedStep({ ...editedStep, name: e.target.value })}
                placeholder="e.g., greeting, product_inquiry, booking"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Give this step a clear, descriptive name</p>
            </div>

            {/* Step Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                🎯 What should the agent do in this step? *
              </label>
              <textarea
                value={editedStep.step_description}
                onChange={(e) => setEditedStep({ ...editedStep, step_description: e.target.value })}
                placeholder="e.g., Greet the customer warmly and ask how you can help them today..."
                rows={3}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">Describe the agent's goal and behavior in this step</p>
            </div>

            {/* What to Say */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                💬 What should the agent say? (Optional)
              </label>
              <textarea
                value={editedStep.what_to_say}
                onChange={(e) => setEditedStep({ ...editedStep, what_to_say: e.target.value })}
                placeholder="e.g., Hello! Welcome to [Business Name]. How can I help you today?"
                rows={2}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">Specific phrases or scripts for the agent to use</p>
            </div>

            {/* Next Actions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    🔄 What happens next?
                  </label>
                  <p className="text-xs text-gray-400">Define how the conversation flows based on customer responses</p>
                </div>
                <button
                  onClick={addNextAction}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <FiPlus className="w-3 h-3" />
                  Add Next Action
                </button>
              </div>

              {editedStep.next_actions.length === 0 ? (
                <div className="text-center py-4 text-gray-500 border border-dashed border-gray-600 rounded-lg">
                  <p className="text-xs">No next actions defined</p>
                  <p className="text-xs mt-1">Add actions to guide the conversation flow</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {editedStep.next_actions.map((action, actionIndex) => (
                    <div key={actionIndex} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-1">
                            When customer says/wants:
                          </label>
                          <input
                            type="text"
                            value={action.when_customer_says}
                            onChange={(e) => updateNextAction(actionIndex, 'when_customer_says', e.target.value)}
                            placeholder="e.g., wants to book appointment, asks about pricing"
                            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-300 mb-1">
                              Go to step:
                            </label>
                            {showNewStepInput === actionIndex ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={newStepName}
                                  onChange={(e) => setNewStepName(e.target.value)}
                                  placeholder="Enter new step name"
                                  className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      handleCreateNewStep(newStepName);
                                      updateNextAction(actionIndex, 'go_to_step', newStepName);
                                    }
                                  }}
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleCreateNewStep(newStepName);
                                      updateNextAction(actionIndex, 'go_to_step', newStepName);
                                    }}
                                    className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs"
                                  >
                                    Create
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowNewStepInput(null);
                                      setNewStepName('');
                                    }}
                                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <select
                                value={action.go_to_step}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '__create_new__') {
                                    setShowNewStepInput(actionIndex);
                                  } else {
                                    updateNextAction(actionIndex, 'go_to_step', value);
                                  }
                                }}
                                className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">Select step</option>
                                {allSteps.map((s, i) => (
                                  <option key={i} value={s.name}>{s.name}</option>
                                ))}
                                <option value="__create_new__" className="text-blue-300">
                                  ➕ Create New Step
                                </option>
                              </select>
                            )}
                          </div>
                          <button
                            onClick={() => removeNextAction(actionIndex)}
                            className="text-red-400 hover:text-red-300 transition-colors mt-5"
                            title="Remove this action"
                          >
                            <FiTrash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Agent Abilities */}
            <div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-300">
                  🛠️ Agent Abilities
                </label>
                <p className="text-xs text-gray-400">What can the agent do in this step?</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {defaultAbilities.map((ability) => {
                  const isSelected = editedStep.available_abilities?.includes(ability.id) || false;
                  return (
                    <button
                      key={ability.id}
                      type="button"
                      onClick={() => toggleAbility(ability.id)}
                      className={clsx(
                        'p-3 rounded-lg border text-left transition-colors text-sm',
                        isSelected
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                          : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:border-gray-500'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{ability.icon}</span>
                        <div>
                          <div className="font-medium">{ability.name}</div>
                          <div className="text-xs opacity-75">{ability.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-600">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <FiSave className="w-4 h-4" />
            Save Step
          </button>
        </div>
      </div>
    </div>
  );
};

export default StepEditorModal;
