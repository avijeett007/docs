'use client';

import React, { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FiChevronDown, FiChevronRight, FiInfo } from 'react-icons/fi';
import clsx from 'clsx';
import ConversationFlowBuilder from './ConversationFlowBuilder';
import StepEditorModal from './StepEditorModal';

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



interface AdvancedSettingsPanelProps {
  formMethods: UseFormReturn<any>;
  errors: any;
  isLoading?: boolean;
  mode: 'create' | 'edit';
}

interface CollapsibleSectionProps {
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  description,
  isOpen,
  onToggle,
  children
}) => (
  <div className="border border-gray-700 rounded-lg bg-gray-800/50">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-700/50 transition-colors"
    >
      <div>
        <h3 className="text-lg font-medium text-white">{title}</h3>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>
      {isOpen ? (
        <FiChevronDown className="w-5 h-5 text-gray-400" />
      ) : (
        <FiChevronRight className="w-5 h-5 text-gray-400" />
      )}
    </button>
    {isOpen && (
      <div className="px-4 pb-4 border-t border-gray-700">
        <div className="pt-4 space-y-4">
          {children}
        </div>
      </div>
    )}
  </div>
);

const SliderInput: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  description?: string;
}> = ({ label, value, onChange, min, max, step, description }) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      <span className="text-sm text-blue-400 font-mono">{value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
    />
    <div className="flex justify-between text-xs text-gray-500 mt-1">
      <span>{min}</span>
      <span>{max}</span>
    </div>
    {description && (
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    )}
  </div>
);

const ToggleInput: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}> = ({ label, checked, onChange, description }) => (
  <div className="flex items-start justify-between">
    <div className="flex-1">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      {description && (
        <p className="text-xs text-gray-400 mt-1">{description}</p>
      )}
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900',
        checked ? 'bg-blue-600' : 'bg-gray-600'
      )}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  </div>
);

const AdvancedSettingsPanel: React.FC<AdvancedSettingsPanelProps> = ({
  formMethods,
  errors
}) => {
  const { watch, setValue } = formMethods;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    voiceControl: false,
    conversationControl: false,
    callManagement: false,
    audioEnhancement: false,
    voice: false,
    response: false,
    call: false,
    limits: false,
    webhook: false,
    states: true, // Open by default for advanced agents
    outbound: false,
  });

  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [isStepEditorOpen, setIsStepEditorOpen] = useState(false);

  const watchedValues = watch();
  const advancedSettings = watchedValues.advancedSettings || {};
  const agentType = watchedValues.agentType || 'simple';
  const states = watchedValues.states || [];
  const isOutbound = watchedValues.isOutbound || false;

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateAdvancedSetting = (key: string, value: any) => {
    setValue(`advancedSettings.${key}`, value, { shouldDirty: true });
  };

  // Flow builder handlers
  const handleEditStep = (stepIndex: number) => {
    setEditingStepIndex(stepIndex);
    setIsStepEditorOpen(true);
  };

  const handleSaveStep = (stepIndex: number, updatedStep: ConversationStep) => {
    const updatedSteps = [...states];
    updatedSteps[stepIndex] = updatedStep;
    setValue('states', updatedSteps, { shouldDirty: true });
  };

  const handleCreateNewStep = (stepName: string) => {
    const newStep: ConversationStep = {
      name: stepName,
      step_description: '',
      what_to_say: '',
      next_actions: [],
      available_abilities: ['end_call']
    };
    const updatedSteps = [...states, newStep];
    setValue('states', updatedSteps, { shouldDirty: true });
  };

  const handleStepsChange = (updatedSteps: ConversationStep[]) => {
    setValue('states', updatedSteps, { shouldDirty: true });
  };

  const handleStartingStepChange = (stepName: string) => {
    setValue('startingState', stepName, { shouldDirty: true });
  };



  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <FiInfo className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-blue-400">Advanced Configuration</h3>
          <p className="text-sm text-gray-300 mt-1">
            Fine-tune your agent's behavior with these advanced settings. Default values work well for most use cases.
          </p>
        </div>
      </div>

      {/* Conversation Flow Builder */}
      {agentType === 'advanced' && (
        <CollapsibleSection
          title="🎯 Conversation Journey"
          description="Design how your AI agent guides customers through different conversation steps"
          isOpen={openSections.states}
          onToggle={() => toggleSection('states')}
        >
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-blue-300 mb-2">💡 How it works</h4>
              <p className="text-sm text-blue-200">
                Think of your conversation as a journey with different stops. Each step handles a specific part of the conversation,
                like greeting customers, answering questions, or scheduling appointments.
              </p>
              <div className="mt-3 text-xs text-blue-200 space-y-1">
                <p>• Click "Add Step" to create conversation steps</p>
                <p>• Click the edit button on any step to configure it</p>
                <p>• Connect steps by adding "Next Actions" in the step editor</p>
                <p>• Drag steps around to organize your flow</p>
              </div>
            </div>

            {/* Visual Flow Builder */}
            <ConversationFlowBuilder
              steps={states}
              onStepsChange={handleStepsChange}
              startingStep={watchedValues.startingState || ''}
              onStartingStepChange={handleStartingStepChange}
              onEditStep={handleEditStep}
            />

            {/* Starting Step Selection */}
            {states.length > 0 && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <label className="block text-sm font-medium text-green-300 mb-2">
                  🚀 Where should the conversation start?
                </label>
                <select
                  value={watchedValues.startingState || ''}
                  onChange={(e) => setValue('startingState', e.target.value, { shouldDirty: true })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Choose the first step</option>
                  {states.map((step: ConversationStep, index: number) => (
                    <option key={index} value={step.name}>{step.name}</option>
                  ))}
                </select>
                <p className="text-xs text-green-200 mt-2">
                  This is the first step customers will experience when they call
                </p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Step Editor Modal */}
      <StepEditorModal
        isOpen={isStepEditorOpen}
        onClose={() => setIsStepEditorOpen(false)}
        step={editingStepIndex !== null ? states[editingStepIndex] : null}
        stepIndex={editingStepIndex || 0}
        allSteps={states}
        onSave={handleSaveStep}
        onCreateNewStep={handleCreateNewStep}
      />

      {/* Voice Control Settings */}
      <CollapsibleSection
        title="🎤 Voice Control"
        description="Fine-tune voice quality, speed, and audio characteristics"
        isOpen={openSections.voiceControl}
        onToggle={() => toggleSection('voiceControl')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SliderInput
            label="Voice Temperature"
            value={watchedValues.voiceTemperature || 1.0}
            onChange={(value) => setValue('voiceTemperature', value, { shouldDirty: true })}
            min={0}
            max={2}
            step={0.1}
            description="Controls voice stability. Lower = more stable, Higher = more varied"
          />
          <SliderInput
            label="Voice Speed"
            value={watchedValues.voiceSpeed || 1.0}
            onChange={(value) => setValue('voiceSpeed', value, { shouldDirty: true })}
            min={0.5}
            max={2}
            step={0.1}
            description="Speech rate. Lower = slower, Higher = faster"
          />
          <SliderInput
            label="Volume"
            value={watchedValues.volume || 1.0}
            onChange={(value) => setValue('volume', value, { shouldDirty: true })}
            min={0}
            max={2}
            step={0.1}
            description="Audio volume. Lower = quieter, Higher = louder"
          />
        </div>
      </CollapsibleSection>

      {/* Conversation Control Settings */}
      <CollapsibleSection
        title="💬 Conversation Control"
        description="Control how the agent responds and handles interruptions"
        isOpen={openSections.conversationControl}
        onToggle={() => toggleSection('conversationControl')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SliderInput
            label="Responsiveness"
            value={watchedValues.responsiveness || 1.0}
            onChange={(value) => setValue('responsiveness', value, { shouldDirty: true })}
            min={0}
            max={1}
            step={0.1}
            description="How quickly agent responds. Lower = waits more, Higher = responds faster"
          />
          <SliderInput
            label="Interruption Sensitivity"
            value={watchedValues.interruptionSensitivity || 1.0}
            onChange={(value) => setValue('interruptionSensitivity', value, { shouldDirty: true })}
            min={0}
            max={1}
            step={0.1}
            description="How easily user can interrupt. Lower = harder to interrupt, Higher = easier"
          />
        </div>
      </CollapsibleSection>

      {/* Voice Configuration */}
      <CollapsibleSection
        title="Voice Configuration"
        description="Control voice speed, temperature, and model selection"
        isOpen={openSections.voice}
        onToggle={() => toggleSection('voice')}
      >
        <SliderInput
          label="Voice Speed"
          value={advancedSettings.voiceSpeed || 1.0}
          onChange={(value) => updateAdvancedSetting('voiceSpeed', value)}
          min={0.5}
          max={2.0}
          step={0.1}
          description="How fast the agent speaks (0.5 = slow, 2.0 = fast)"
        />
        
        <SliderInput
          label="Voice Temperature"
          value={advancedSettings.voiceTemperature || 1.0}
          onChange={(value) => updateAdvancedSetting('voiceTemperature', value)}
          min={0}
          max={2.0}
          step={0.1}
          description="Voice expressiveness (0 = monotone, 2.0 = very expressive)"
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Voice Model (Optional)
          </label>
          <select
            value={advancedSettings.voiceModel || ''}
            onChange={(e) => updateAdvancedSetting('voiceModel', e.target.value || null)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Default</option>
            <option value="eleven_turbo_v2">ElevenLabs Turbo v2</option>
            <option value="eleven_multilingual_v2">ElevenLabs Multilingual v2</option>
            <option value="eleven_monolingual_v1">ElevenLabs Monolingual v1</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Override the default voice model for this agent
          </p>
        </div>
      </CollapsibleSection>

      {/* Response Engine */}
      <CollapsibleSection
        title="Response Engine"
        description="Configure the AI model and response generation"
        isOpen={openSections.response}
        onToggle={() => toggleSection('response')}
      >
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            AI Model
          </label>
          <select
            value={advancedSettings.model || 'gpt-4o'}
            onChange={(e) => updateAdvancedSetting('model', e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {/* GPT-5 Series */}
            <option value="gpt-5">GPT-5</option>
            <option value="gpt-5-mini">GPT-5 Mini</option>
            <option value="gpt-5-nano">GPT-5 Nano</option>

            {/* GPT-4o Series */}
            <option value="gpt-4o">GPT-4o (Recommended)</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>

            {/* GPT-4.1 Series */}
            <option value="gpt-4.1">GPT-4.1</option>
            <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
            <option value="gpt-4.1-nano">GPT-4.1 Nano</option>

            {/* Legacy GPT Models */}
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>

            {/* Claude Series */}
            <option value="claude-3.7-sonnet">Claude 3.7 Sonnet</option>
            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
            <option value="claude-3.5-haiku">Claude 3.5 Haiku</option>
            <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>

            {/* Gemini Series */}
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
          </select>
        </div>

        <SliderInput
          label="Model Temperature"
          value={advancedSettings.modelTemperature || 0.2}
          onChange={(value) => updateAdvancedSetting('modelTemperature', value)}
          min={0}
          max={1.0}
          step={0.1}
          description="Response creativity (0 = consistent, 1.0 = creative)"
        />

        <ToggleInput
          label="High Priority Processing"
          checked={advancedSettings.modelHighPriority || false}
          onChange={(checked) => updateAdvancedSetting('modelHighPriority', checked)}
          description="Use high-priority processing for faster responses (may incur additional costs)"
        />
      </CollapsibleSection>

      {/* Call Settings */}
      <CollapsibleSection
        title="Call Settings"
        description="Configure call behavior and interaction settings"
        isOpen={openSections.call}
        onToggle={() => toggleSection('call')}
      >
        <SliderInput
          label="Interruption Sensitivity"
          value={advancedSettings.interruptionSensitivity || 0.7}
          onChange={(value) => updateAdvancedSetting('interruptionSensitivity', value)}
          min={0}
          max={1.0}
          step={0.1}
          description="How easily the agent can be interrupted (0 = hard to interrupt, 1.0 = easy to interrupt)"
        />

        <ToggleInput
          label="Enable Backchannel"
          checked={advancedSettings.enableBackchannel ?? true}
          onChange={(checked) => updateAdvancedSetting('enableBackchannel', checked)}
          description="Allow the agent to make acknowledgment sounds (uh-huh, mm-hmm) while listening"
        />

        <ToggleInput
          label="Normalize for Speech"
          checked={advancedSettings.normalizeForSpeech ?? true}
          onChange={(checked) => updateAdvancedSetting('normalizeForSpeech', checked)}
          description="Automatically format text for better speech synthesis (e.g., '123' becomes 'one hundred twenty-three')"
        />
      </CollapsibleSection>

      {/* Call Limits */}
      <CollapsibleSection
        title="Call Limits"
        description="Set time limits and automatic call termination rules"
        isOpen={openSections.limits}
        onToggle={() => toggleSection('limits')}
      >
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Maximum Call Duration (minutes)
          </label>
          <input
            type="number"
            min="1"
            max="120"
            value={Math.round((advancedSettings.maxCallDurationMs || 3600000) / 60000)}
            onChange={(e) => updateAdvancedSetting('maxCallDurationMs', parseInt(e.target.value) * 60000)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Automatically end calls after this duration (1-120 minutes)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            End Call After Silence (minutes)
          </label>
          <input
            type="number"
            min="1"
            max="30"
            value={Math.round((advancedSettings.endCallAfterSilenceMs || 600000) / 60000)}
            onChange={(e) => updateAdvancedSetting('endCallAfterSilenceMs', parseInt(e.target.value) * 60000)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            End call if no one speaks for this duration (1-30 minutes)
          </p>
        </div>
      </CollapsibleSection>

      {/* Call Management Settings */}
      <CollapsibleSection
        title="📞 Call Management"
        description="Configure call duration, reminders, and automatic behaviors"
        isOpen={openSections.callManagement}
        onToggle={() => toggleSection('callManagement')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                End Call After Silence
              </label>
              <select
                value={watchedValues.endCallAfterSilenceMs || 600000}
                onChange={(e) => setValue('endCallAfterSilenceMs', parseInt(e.target.value), { shouldDirty: true })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={60000}>1 minute</option>
                <option value={300000}>5 minutes</option>
                <option value={600000}>10 minutes (default)</option>
                <option value={1800000}>30 minutes</option>
                <option value={3600000}>1 hour</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Auto-end call after silence period</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Call Duration
              </label>
              <select
                value={watchedValues.maxCallDurationMs || 3600000}
                onChange={(e) => setValue('maxCallDurationMs', parseInt(e.target.value), { shouldDirty: true })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1800000}>30 minutes</option>
                <option value={3600000}>1 hour (default)</option>
                <option value={5400000}>1.5 hours</option>
                <option value={7200000}>2 hours</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Maximum call duration limit</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SliderInput
              label="Reminder Trigger (seconds)"
              value={(watchedValues.reminderTriggerMs || 10000) / 1000}
              onChange={(value) => setValue('reminderTriggerMs', value * 1000, { shouldDirty: true })}
              min={5}
              max={60}
              step={5}
              description="Remind user to speak after silence"
            />

            <SliderInput
              label="Max Reminders"
              value={watchedValues.reminderMaxCount || 1}
              onChange={(value) => setValue('reminderMaxCount', Math.round(value), { shouldDirty: true })}
              min={0}
              max={5}
              step={1}
              description="Maximum number of reminders"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Audio Enhancement Settings */}
      <CollapsibleSection
        title="🎵 Audio Enhancement"
        description="Configure backchannel, ambient sounds, and speech processing"
        isOpen={openSections.audioEnhancement}
        onToggle={() => toggleSection('audioEnhancement')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <ToggleInput
                label="Enable Backchannel"
                checked={watchedValues.enableBackchannel ?? false}
                onChange={(checked) => setValue('enableBackchannel', checked, { shouldDirty: true })}
                description="Agent makes acknowledgment sounds (uh-huh, mm-hmm)"
              />

              {watchedValues.enableBackchannel && (
                <div className="mt-3 pl-4 border-l-2 border-blue-500/30">
                  <SliderInput
                    label="Backchannel Frequency"
                    value={watchedValues.backchannelFrequency || 0.8}
                    onChange={(value) => setValue('backchannelFrequency', value, { shouldDirty: true })}
                    min={0}
                    max={1}
                    step={0.1}
                    description="How often to backchannel"
                  />
                </div>
              )}
            </div>

            <div>
              <ToggleInput
                label="Normalize for Speech"
                checked={watchedValues.normalizeForSpeech ?? false}
                onChange={(checked) => setValue('normalizeForSpeech', checked, { shouldDirty: true })}
                description="Convert numbers/dates to spoken form"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ambient Sound
              </label>
              <select
                value={watchedValues.ambientSound || ''}
                onChange={(e) => setValue('ambientSound', e.target.value || undefined, { shouldDirty: true })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                <option value="coffee-shop">Coffee Shop</option>
                <option value="convention-hall">Convention Hall</option>
                <option value="summer-outdoor">Summer Outdoor</option>
                <option value="mountain-outdoor">Mountain Outdoor</option>
                <option value="static-noise">Static Noise</option>
                <option value="call-center">Call Center</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Background ambience for calls</p>
            </div>

            {watchedValues.ambientSound && (
              <SliderInput
                label="Ambient Volume"
                value={watchedValues.ambientSoundVolume || 1.0}
                onChange={(value) => setValue('ambientSoundVolume', value, { shouldDirty: true })}
                min={0}
                max={2}
                step={0.1}
                description="Volume of ambient sound"
              />
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Outbound Configuration */}
      <CollapsibleSection
        title="Outbound Settings"
        description="Configure settings for outbound calls"
        isOpen={openSections.outbound}
        onToggle={() => toggleSection('outbound')}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isOutbound}
              onChange={(e) => setValue('isOutbound', e.target.checked, { shouldDirty: true })}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <div>
              <label className="text-sm font-medium text-white">
                Enable Outbound Calls
              </label>
              <p className="text-xs text-gray-400">
                Allow this agent to make outbound calls to customers
              </p>
            </div>
          </div>

          {isOutbound && (
            <div className="space-y-3 pl-7 border-l-2 border-blue-500/30">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Business Name (Optional)
                </label>
                <input
                  type="text"
                  value={watchedValues.businessName || ''}
                  onChange={(e) => setValue('businessName', e.target.value, { shouldDirty: true })}
                  placeholder="e.g., Al Shifa Medical Center"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Business name to use in outbound call scripts
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Character Name (Optional)
                </label>
                <input
                  type="text"
                  value={watchedValues.characterName || ''}
                  onChange={(e) => setValue('characterName', e.target.value, { shouldDirty: true })}
                  placeholder="e.g., Kate, Michael, Sarah"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Character name for the agent to use when introducing itself
                </p>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <FiInfo className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-amber-300 font-medium">Outbound Call Guidelines</p>
                    <ul className="text-xs text-amber-200 mt-1 space-y-1">
                      <li>• Ensure compliance with local calling regulations</li>
                      <li>• Include opt-out mechanisms in your prompts</li>
                      <li>• Consider time zones and appropriate calling hours</li>
                      <li>• Test thoroughly before deploying to production</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Webhook Configuration */}
      <CollapsibleSection
        title="Webhook Configuration"
        description="Configure webhook URL for call events and transcripts"
        isOpen={openSections.webhook}
        onToggle={() => toggleSection('webhook')}
      >
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Webhook URL (Optional)
          </label>
          <input
            type="url"
            value={advancedSettings.webhookUrl || ''}
            onChange={(e) => updateAdvancedSetting('webhookUrl', e.target.value)}
            placeholder="https://your-domain.com/webhook"
            className={clsx(
              'w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500',
              errors.advancedSettings?.webhookUrl ? 'border-red-500' : 'border-gray-600'
            )}
          />
          {errors.advancedSettings?.webhookUrl && (
            <p className="mt-1 text-sm text-red-400">{errors.advancedSettings.webhookUrl.message}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Receive real-time call events and transcripts at this URL. Leave empty to use default analytics webhook.
          </p>
        </div>
      </CollapsibleSection>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: 2px solid #1F2937;
        }

        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: 2px solid #1F2937;
        }
      `}</style>
    </div>
  );
};

export default AdvancedSettingsPanel;
