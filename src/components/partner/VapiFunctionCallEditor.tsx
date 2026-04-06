'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiX, FiSave, FiLoader, FiCode, FiAlertCircle, FiSettings, FiInfo } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface FunctionCall {
  id?: string;
  appName: string;
  toolName: string;
  customName: string;
  customDescription: string;
  isConfigured?: boolean;
  webhookUrl?: string;
  parameterValues?: Record<string, any>; // Store pre-filled parameter values
}

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

interface VapiFunctionCallEditorProps {
  isOpen: boolean;
  onClose: () => void;
  functionCall: FunctionCall;
  onSave: (functionCall: FunctionCall) => void;
  onSaveAndAddAnother?: (functionCall: FunctionCall) => void;
  customerId: string;
}

const functionCallSchema = z.object({
  customName: z.string()
    .min(1, 'Function name is required')
    .max(50, 'Function name must be less than 50 characters')
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Function name must start with a letter and contain only letters, numbers, and underscores'),
  customDescription: z.string()
    .min(1, 'Function description is required')
    .max(200, 'Function description must be less than 200 characters'),
});

type FormData = z.infer<typeof functionCallSchema>;

const VapiFunctionCallEditor: React.FC<VapiFunctionCallEditorProps> = ({
  isOpen,
  onClose,
  functionCall,
  onSave,
  onSaveAndAddAnother,
  customerId
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [toolSchema, setToolSchema] = useState<ToolSchema | null>(null);
  const [vapiFunction, setVapiFunction] = useState<any>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>(
    functionCall.parameterValues || {}
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
    reset,
    trigger
  } = useForm<FormData>({
    resolver: zodResolver(functionCallSchema),
    mode: 'onChange',
    defaultValues: {
      customName: functionCall.customName || '',
      customDescription: functionCall.customDescription || ''
    }
  });

  // Watch form values for real-time preview
  const customName = watch('customName');
  const customDescription = watch('customDescription');

  // Load tool schema when component mounts
  useEffect(() => {
    if (isOpen && functionCall.appName && functionCall.toolName) {
      loadToolSchema();
    }
  }, [isOpen, functionCall.appName, functionCall.toolName]);

  // Update VAPI function preview when form values change
  useEffect(() => {
    if (toolSchema && customName && customDescription) {
      generateVapiFunction();
    }
  }, [toolSchema, customName, customDescription]);

  // Reset form when functionCall changes
  useEffect(() => {
    reset({
      customName: functionCall.customName || '',
      customDescription: functionCall.customDescription || ''
    });
    setParameterValues(functionCall.parameterValues || {});
    // Trigger validation after reset to ensure isValid is updated
    setTimeout(() => trigger(), 0);
  }, [functionCall, reset, trigger]);

  const loadToolSchema = async () => {
    try {
      setLoadingSchema(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/customers/${customerId}/tool-schemas?appName=${functionCall.appName}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Find the specific tool schema from the response
        const appTools = data.data[functionCall.appName] || [];
        const toolSchema = appTools.find((tool: any) => tool.toolName === functionCall.toolName);

        if (toolSchema) {
          setToolSchema(toolSchema);
        } else {
          console.error('Tool schema not found:', functionCall.toolName);
          toast.error('Tool schema not found');
        }
      } else {
        console.error('Failed to load tool schema:', response.status);
        toast.error('Failed to load tool schema');
      }
    } catch (error) {
      console.error('Error loading tool schema:', error);
      toast.error('Failed to load tool schema');
    } finally {
      setLoadingSchema(false);
    }
  };

  const generateVapiFunction = () => {
    if (!toolSchema || !customName || !customDescription) return;

    // Generate VAPI-compatible function definition
    const vapiFunc = {
      type: "function",
      function: {
        name: customName,
        description: customDescription,
        parameters: toolSchema.inputSchema || {
          type: "object",
          properties: {},
          required: []
        }
      },
      server: {
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/partner/function-calls/execute/${customerId}/${functionCall.appName}/${functionCall.toolName}`,
        timeout: 20,
        retries: 2
      }
    };

    setVapiFunction(vapiFunc);
  };

  // Helper function to render form field based on parameter type
  const renderParameterField = (paramName: string, paramDef: any) => {
    const value = parameterValues[paramName] || '';
    const isRequired = toolSchema?.inputSchema?.required?.includes(paramName);

    const updateParameterValue = (newValue: any) => {
      setParameterValues(prev => ({
        ...prev,
        [paramName]: newValue
      }));
    };

    const fieldId = `param-${paramName}`;

    return (
      <div key={paramName} className="space-y-2">
        <label htmlFor={fieldId} className="block text-sm font-medium text-gray-300">
          {paramName}
          {isRequired && <span className="text-red-400 ml-1">*</span>}
        </label>

        {paramDef.description && (
          <p className="text-xs text-gray-500">{paramDef.description}</p>
        )}

        {paramDef.enum ? (
          <select
            id={fieldId}
            value={value}
            onChange={(e) => updateParameterValue(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select {paramName}</option>
            {paramDef.enum.map((option: string) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : paramDef.type === 'boolean' ? (
          <select
            id={fieldId}
            value={value.toString()}
            onChange={(e) => updateParameterValue(e.target.value === 'true')}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select value</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        ) : paramDef.type === 'number' || paramDef.type === 'integer' ? (
          <input
            id={fieldId}
            type="number"
            value={value}
            onChange={(e) => updateParameterValue(paramDef.type === 'integer' ? parseInt(e.target.value) || '' : parseFloat(e.target.value) || '')}
            placeholder={`Enter ${paramName}`}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        ) : (
          <input
            id={fieldId}
            type="text"
            value={value}
            onChange={(e) => updateParameterValue(e.target.value)}
            placeholder={`Enter ${paramName}`}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )}
      </div>
    );
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true);

      // Create updated function call object
      const updatedFunctionCall: FunctionCall = {
        ...functionCall,
        customName: data.customName,
        customDescription: data.customDescription,
        parameterValues: parameterValues,
        isConfigured: true
      };

      onSave(updatedFunctionCall);
    } catch (error) {
      console.error('Error saving function call:', error);
      toast.error('Failed to save function call');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitAndAddAnother = async (data: FormData) => {
    if (!onSaveAndAddAnother) return;

    try {
      setIsLoading(true);

      // Create updated function call object
      const updatedFunctionCall: FunctionCall = {
        ...functionCall,
        customName: data.customName,
        customDescription: data.customDescription,
        parameterValues: parameterValues,
        isConfigured: true
      };

      onSaveAndAddAnother(updatedFunctionCall);
    } catch (error) {
      console.error('Error saving function call:', error);
      toast.error('Failed to save function call');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-gray-900 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <FiCode className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <Dialog.Title as="h3" className="text-lg font-medium text-white">
                        Configure VAPI Function Call
                      </Dialog.Title>
                      <p className="text-sm text-gray-400">
                        {functionCall.appName} • {functionCall.toolName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Configuration */}
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h4 className="font-medium text-white">Function Configuration</h4>
                        
                        {/* Custom Name */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Function Name *
                          </label>
                          <input
                            {...register('customName')}
                            type="text"
                            placeholder="e.g., findAvailableSlots"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          {errors.customName && (
                            <p className="text-red-400 text-sm mt-1">{errors.customName.message}</p>
                          )}
                        </div>

                        {/* Custom Description */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Function Description *
                          </label>
                          <textarea
                            {...register('customDescription')}
                            rows={3}
                            placeholder="Describe what this function does..."
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
                          {errors.customDescription && (
                            <p className="text-red-400 text-sm mt-1">{errors.customDescription.message}</p>
                          )}
                        </div>
                      </div>

                      {/* Tool Information */}
                      {loadingSchema ? (
                        <div className="flex items-center gap-2 text-gray-400">
                          <FiLoader className="w-4 h-4 animate-spin" />
                          <span>Loading tool schema...</span>
                        </div>
                      ) : toolSchema ? (
                        <div className="space-y-3">
                          <h4 className="font-medium text-white">Tool Information</h4>
                          <div className="p-4 bg-gray-800 rounded-lg border border-gray-600">
                            <h5 className="font-medium text-white mb-2">{toolSchema.displayName}</h5>
                            <p className="text-sm text-gray-300 mb-3">{toolSchema.description}</p>
                            {toolSchema.category && (
                              <span className="inline-block px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded">
                                {toolSchema.category}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-400">
                          <FiAlertCircle className="w-4 h-4" />
                          <span className="text-sm">Unable to load tool schema</span>
                        </div>
                      )}

                      {/* Parameter Configuration */}
                      {toolSchema?.inputSchema?.properties && Object.keys(toolSchema.inputSchema.properties).length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <FiSettings className="w-4 h-4 text-blue-400" />
                            <h3 className="font-medium text-white">Parameter Configuration</h3>
                          </div>
                          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                            <div className="mb-4">
                              <p className="text-sm text-gray-400 mb-2">
                                Configure default values for parameters. These will be pre-filled when the AI calls this function.
                              </p>
                              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                <FiInfo className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-blue-300">
                                  <p className="font-medium mb-1">Pro Tip:</p>
                                  <p>Pre-fill values like calendar_id, timezone, or default settings that should be consistent across all calls. Leave dynamic fields (like event title, description) empty for the AI to fill.</p>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {Object.entries(toolSchema.inputSchema.properties).map(([paramName, paramDef]) =>
                                renderParameterField(paramName, paramDef as any)
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column - Preview */}
                    <div className="space-y-6">
                      {/* VAPI Function Preview */}
                      {vapiFunction && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <FiCode className="w-4 h-4 text-purple-400" />
                            <h3 className="font-medium text-white">VAPI Function Preview</h3>
                          </div>
                          <div className="p-4 bg-gray-800 rounded-lg border border-gray-600">
                            <pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-x-auto">
                              {JSON.stringify(vapiFunction, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-6 border-t border-gray-700">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>

                    <div className="flex gap-3">
                      {onSaveAndAddAnother && (
                        <button
                          type="button"
                          onClick={handleSubmit(onSubmitAndAddAnother)}
                          disabled={!isValid || isLoading}
                          className={clsx(
                            "flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors",
                            isValid && !isLoading
                              ? "bg-blue-600 hover:bg-blue-700 text-white"
                              : "bg-gray-600 text-gray-400 cursor-not-allowed"
                          )}
                        >
                          {isLoading ? (
                            <>
                              <FiLoader className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <FiSave className="w-4 h-4" />
                              Save & Add Another
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleSubmit(onSubmit)}
                        disabled={!isValid || isLoading}
                        className={clsx(
                          "flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors",
                          isValid && !isLoading
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                        )}
                      >
                        {isLoading ? (
                          <>
                            <FiLoader className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <FiSave className="w-4 h-4" />
                            Save Function Call
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default VapiFunctionCallEditor;
