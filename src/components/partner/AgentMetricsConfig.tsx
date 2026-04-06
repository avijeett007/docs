'use client';

import React, { useState, useEffect } from 'react';
import { FiX, FiPlus, FiTrash2, FiSave, FiLoader, FiInfo, FiTag } from 'react-icons/fi';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// Types for metrics configuration
interface MetricConfig {
  metricName: string;
  metricType: 'boolean' | 'string' | 'number';
  description: string;
  enabledForBilling: boolean;
  exampleValues: string[];
  selectedPlanId?: string;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

// Types for billing plans
interface BillingPlan {
  id: string;
  name: string;
  description?: string;
  metricType: string;
  metricName: string;
  pricingModel: string;
  billingCycle: string;
  minimumCharge: number;
  maximumCharge?: number;
  includedUnits: number;
  isActive: boolean;
  subscriptionId?: string;
  subscriptionStatus?: string;
}

interface AgentMetricsConfigProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  provider: string;
  onSaved?: () => void;
}

const AgentMetricsConfig: React.FC<AgentMetricsConfigProps> = ({
  isOpen,
  onClose,
  agentId,
  agentName,
  provider,
  onSaved
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [metrics, setMetrics] = useState<MetricConfig[]>([]);
  const [exampleValueInputs, setExampleValueInputs] = useState<Record<number, string>>({});
  const [availablePlans, setAvailablePlans] = useState<BillingPlan[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing metrics configuration and available plans
  useEffect(() => {
    if (isOpen && agentId) {
      loadMetricsConfig();
      loadAvailablePlans();
    }
  }, [isOpen, agentId]);

  const loadMetricsConfig = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const url = `/api/analytics/agents/${agentId}/metrics?provider=${provider}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No metrics configured yet, start with empty array
          setMetrics([]);
          return;
        }
        throw new Error('Failed to load metrics configuration');
      }

      const data = await response.json();

      if (data.success) {
        // Handle both flattened structure (from main app API) and nested structure (direct analytics service)
        let metricsArray = [];

        if (data.metrics && Array.isArray(data.metrics)) {
          // Flattened structure from main app API
          metricsArray = data.metrics;
        } else if (data.metered_metrics && data.metered_metrics.metrics) {
          // Nested structure from direct analytics service
          metricsArray = data.metered_metrics.metrics;
        } else {
          // No metrics found
          metricsArray = [];
        }

        // Transform old format to new format
        const transformedMetrics = metricsArray.map((metric: any) => ({
          metricName: metric.metricName || '',
          metricType: metric.metricType || 'boolean',
          description: metric.description || '',
          enabledForBilling: metric.enabledForBilling ?? metric.enabled ?? false,
          exampleValues: metric.exampleValues || metric.keywords || [],
          selectedPlanId: metric.selectedPlanId,
          priority: metric.priority || 1,
          createdAt: metric.createdAt,
          updatedAt: metric.updatedAt
        }));

        setMetrics(transformedMetrics);
      } else {
        setMetrics([]);
      }
    } catch (error) {
      console.error('Error loading metrics config:', error);
      toast.error('Failed to load metrics configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailablePlans = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        console.warn('No authentication token available');
        return;
      }

      // Get agent details first to find the customer
      // Use the main app API instead of analytics API for more reliable customer data
      // Handle provider-specific URL patterns
      let agentApiUrl;
      if (provider === 'retell') {
        agentApiUrl = `/api/partner/retell-agents/${agentId}/details`;
      } else {
        agentApiUrl = `/api/partner/${provider}-agents/${agentId}`;
      }

      const agentResponse = await fetch(agentApiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Agent API URL:', agentApiUrl);
      console.log('Agent response status:', agentResponse.status);

      if (!agentResponse.ok) {
        console.warn('Could not load agent details for plan lookup:', agentResponse.status);
        return;
      }

      const agentData = await agentResponse.json();
      console.log('Agent data received:', agentData);

      // Handle different response structures for different providers
      let customerId;
      if (provider === 'retell' && agentData.success && agentData.agent) {
        // Retell details endpoint returns { success: true, agent: {...} }
        customerId = agentData.agent.customerId;
      } else if (provider === 'ghl' && agentData.agent) {
        // GHL details endpoint returns { agent: {...}, partnerName: "..." }
        customerId = agentData.agent.customerId;
      } else if (provider === 'ultravox') {
        // Ultravox returns both customerId and customer object, prefer customerId for simplicity
        customerId = agentData.customerId || (agentData.customer ? agentData.customer.id : null);
      } else if (provider === 'vapi') {
        // VAPI returns both customerId and customer object, prefer customerId for simplicity
        customerId = agentData.customerId || (agentData.customer ? agentData.customer.id : null);
      } else {
        // Other providers (Knova) return agent data directly with customerId
        customerId = agentData.customerId;
      }

      console.log('Extracted customer ID:', customerId);

      if (!customerId) {
        console.log('No customer assigned to this agent - no billing plans available');
        console.log('Provider:', provider);
        console.log('Agent data structure:', Object.keys(agentData));
        if (provider === 'retell' && agentData.agent) {
          console.log('Retell agent data structure:', Object.keys(agentData.agent));
        }
        if (provider === 'ghl' && agentData.agent) {
          console.log('GHL agent data structure:', Object.keys(agentData.agent));
          console.log('GHL agent customerId:', agentData.agent.customerId);
        }
        setAvailablePlans([]);
        return;
      }

      console.log('Loading billing plans for customer:', customerId);

      // Load customer's active metered billing plans
      const plansResponse = await fetch(`/api/billing/customers/${customerId}/metered-plans`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        console.log('Plans API response:', plansData);

        if (plansData.success && plansData.plans) {
          const activePlans = plansData.plans.filter((plan: any) => plan.isActive !== false);
          setAvailablePlans(activePlans);
          console.log('Loaded available billing plans:', activePlans.length, activePlans);
        } else {
          console.warn('Invalid plans response structure:', plansData);
          setAvailablePlans([]);
        }
      } else {
        const errorData = await plansResponse.text();
        console.warn('Could not load billing plans:', plansResponse.status, errorData);
        setAvailablePlans([]);
      }

    } catch (error) {
      console.error('Error loading available plans:', error);
      setAvailablePlans([]);
    }
  };

  const validateMetrics = (): boolean => {
    const newErrors: Record<string, string> = {};

    metrics.forEach((metric, index) => {
      if (!metric.metricName.trim()) {
        newErrors[`metric_${index}_name`] = 'Metric name is required';
      } else if (metric.metricName.length > 50) {
        newErrors[`metric_${index}_name`] = 'Metric name must be 50 characters or less';
      }

      if (!metric.description.trim()) {
        newErrors[`metric_${index}_description`] = 'Description is required';
      } else if (metric.description.length > 200) {
        newErrors[`metric_${index}_description`] = 'Description must be 200 characters or less';
      }

      if (metric.priority < 1 || metric.priority > 10) {
        newErrors[`metric_${index}_priority`] = 'Priority must be between 1 and 10';
      }

      // Validate plan selection for billing-enabled metrics
      if (metric.enabledForBilling && !metric.selectedPlanId) {
        newErrors[`metric_${index}_plan`] = 'Please select a billing plan when billing is enabled';
      }
    });

    // Check for duplicate metric names
    const metricNames = metrics.map(m => m.metricName.trim().toLowerCase());
    const duplicates = metricNames.filter((name, index) => metricNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      duplicates.forEach(name => {
        const index = metricNames.indexOf(name);
        newErrors[`metric_${index}_name`] = 'Metric name must be unique';
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateMetrics()) {
      toast.error('Please fix the validation errors before saving');
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/analytics/agents/${agentId}/metrics?provider=${provider}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          metered_metrics: {
            metrics: metrics.map(metric => ({
              metricName: metric.metricName,
              metricType: metric.metricType,
              description: metric.description,
              enabledForBilling: metric.enabledForBilling, // Use new field name
              exampleValues: metric.exampleValues, // Use new field name
              selectedPlanId: metric.selectedPlanId,
              priority: metric.priority,
              createdAt: metric.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }))
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save metrics configuration');
      }

      const result = await response.json();
      if (result.success) {
        toast.success('Metrics configuration saved successfully');
        onSaved?.();
        onClose();
      } else {
        throw new Error(result.message || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving metrics config:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const addMetric = () => {
    const newMetric: MetricConfig = {
      metricName: '',
      metricType: 'boolean',
      description: '',
      enabledForBilling: false,
      exampleValues: [],
      priority: 1
    };
    setMetrics([...metrics, newMetric]);
  };

  const removeMetric = (index: number) => {
    setMetrics(metrics.filter((_, i) => i !== index));
    // Clear any errors for this metric
    const newErrors = { ...errors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`metric_${index}_`)) {
        delete newErrors[key];
      }
    });
    setErrors(newErrors);
  };

  const updateMetric = (index: number, field: keyof MetricConfig, value: any) => {
    const updatedMetrics = [...metrics];
    updatedMetrics[index] = { ...updatedMetrics[index], [field]: value };
    setMetrics(updatedMetrics);

    // Clear error for this field
    const errorKey = `metric_${index}_${field}`;
    if (errors[errorKey]) {
      const newErrors = { ...errors };
      delete newErrors[errorKey];
      setErrors(newErrors);
    }
  };

  const addExampleValue = (metricIndex: number) => {
    const exampleInput = exampleValueInputs[metricIndex];
    if (!exampleInput?.trim()) return;

    const currentValues = metrics[metricIndex]?.exampleValues || [];
    if (currentValues.includes(exampleInput.trim())) {
      toast.error('Example value already exists');
      return;
    }

    updateMetric(metricIndex, 'exampleValues', [...currentValues, exampleInput.trim()]);
    setExampleValueInputs(prev => ({ ...prev, [metricIndex]: '' }));
  };

  const removeExampleValue = (metricIndex: number, valueIndex: number) => {
    const currentValues = metrics[metricIndex]?.exampleValues || [];
    const updatedValues = currentValues.filter((_, index) => index !== valueIndex);
    updateMetric(metricIndex, 'exampleValues', updatedValues);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Configure Custom Metrics
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Agent: {agentName} ({provider.toUpperCase()})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-3 text-gray-400">Loading configuration...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FiInfo className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-200">
                    <p className="font-medium mb-1">Custom Metrics for Metered Billing</p>
                    <p>Define business-specific metrics that will be tracked during calls and used for metered billing. Keywords help identify when these metrics occur in conversations.</p>
                  </div>
                </div>
              </div>

              {/* Metrics List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">Metrics Configuration</h3>
                  <button
                    type="button"
                    onClick={addMetric}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-sm"
                  >
                    <FiPlus className="w-4 h-4" />
                    Add Metric
                  </button>
                </div>

                {metrics.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <FiInfo className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No metrics configured yet.</p>
                    <p className="text-sm">Click "Add Metric" to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {metrics.map((metric, index) => (
                      <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-md font-medium text-white">
                            Metric #{index + 1}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeMetric(index)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {/* Metric Name */}
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Metric Name <span className="text-red-400">*</span>
                            </label>
                            <input
                              value={metric.metricName}
                              onChange={(e) => updateMetric(index, 'metricName', e.target.value)}
                              className={clsx(
                                "w-full bg-gray-700 border rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                                errors[`metric_${index}_name`] ? 'border-red-500' : 'border-gray-600'
                              )}
                              placeholder="e.g., qualified_leads"
                            />
                            {errors[`metric_${index}_name`] && (
                              <p className="text-red-400 text-xs mt-1">{errors[`metric_${index}_name`]}</p>
                            )}
                          </div>

                          {/* Metric Type */}
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Metric Type
                            </label>
                            <select
                              value={metric.metricType}
                              onChange={(e) => updateMetric(index, 'metricType', e.target.value as 'boolean' | 'string' | 'number')}
                              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="boolean">Boolean (True/False)</option>
                              <option value="string">String</option>
                              <option value="number">Number</option>
                            </select>
                          </div>
                        </div>

                        {/* Description */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Description <span className="text-red-400">*</span>
                          </label>
                          <textarea
                            value={metric.description}
                            onChange={(e) => updateMetric(index, 'description', e.target.value)}
                            rows={2}
                            className={clsx(
                              "w-full bg-gray-700 border rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none",
                              errors[`metric_${index}_description`] ? 'border-red-500' : 'border-gray-600'
                            )}
                            placeholder="Describe what this metric measures..."
                          />
                          {errors[`metric_${index}_description`] && (
                            <p className="text-red-400 text-xs mt-1">{errors[`metric_${index}_description`]}</p>
                          )}
                        </div>

                        {/* Example Values */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            <FiTag className="inline w-4 h-4 mr-1" />
                            Example Values
                          </label>
                          <p className="text-xs text-gray-400 mb-3">
                            Add example values that help our AI understand what this metric should detect.
                            For boolean metrics, add phrases that indicate true/false. For string/number metrics, add sample values.
                          </p>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={exampleValueInputs[index] || ''}
                              onChange={(e) => setExampleValueInputs(prev => ({ ...prev, [index]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && addExampleValue(index)}
                              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="e.g., 'appointment booked', 'yes', 'confirmed'"
                            />
                            <button
                              type="button"
                              onClick={() => addExampleValue(index)}
                              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
                            >
                              Add
                            </button>
                          </div>

                          {/* Example Values Display */}
                          <div className="flex flex-wrap gap-2">
                            {metric.exampleValues.map((value, valueIndex) => (
                              <span
                                key={valueIndex}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 rounded-md text-xs"
                              >
                                {value}
                                <button
                                  type="button"
                                  onClick={() => removeExampleValue(index, valueIndex)}
                                  className="hover:text-green-100"
                                >
                                  <FiX className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Priority */}
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Priority (1-10)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={metric.priority}
                              onChange={(e) => updateMetric(index, 'priority', parseInt(e.target.value) || 1)}
                              className={clsx(
                                "w-full bg-gray-700 border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                                errors[`metric_${index}_priority`] ? 'border-red-500' : 'border-gray-600'
                              )}
                            />
                            {errors[`metric_${index}_priority`] && (
                              <p className="text-red-400 text-xs mt-1">{errors[`metric_${index}_priority`]}</p>
                            )}
                          </div>

                          {/* Enable for Billing Toggle */}
                          <div className="mb-4">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={metric.enabledForBilling}
                                onChange={(e) => updateMetric(index, 'enabledForBilling', e.target.checked)}
                                className="sr-only"
                              />
                              <div className={clsx(
                                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                                metric.enabledForBilling ? 'bg-green-600' : 'bg-gray-600'
                              )}>
                                <span className={clsx(
                                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                                  metric.enabledForBilling ? 'translate-x-6' : 'translate-x-1'
                                )} />
                              </div>
                              <span className="ml-3 text-sm text-gray-300">Enable for Billing</span>
                            </label>
                            <p className="text-xs text-gray-400 mt-1">
                              When enabled, this metric will be used for automatic billing charges.
                              When disabled, it will only be tracked for analytics purposes.
                            </p>
                          </div>

                          {/* Plan Selection (only show when billing is enabled) */}
                          {metric.enabledForBilling && (
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Select Billing Plan <span className="text-red-400">*</span>
                              </label>
                              {availablePlans.length === 0 ? (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                                  <div className="flex items-start gap-2">
                                    <FiInfo className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-amber-200">
                                      <p className="font-medium mb-1">No Active Billing Plans</p>
                                      <p>This customer doesn't have any active metered billing plans. Please:</p>
                                      <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                                        <li>Create a metered billing plan in the Billing section</li>
                                        <li>Subscribe the customer to the plan</li>
                                        <li>Return here to configure metrics</li>
                                      </ol>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <select
                                    value={metric.selectedPlanId || ''}
                                    onChange={(e) => updateMetric(index, 'selectedPlanId', e.target.value)}
                                    className={clsx(
                                      "w-full bg-gray-700 border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                                      errors[`metric_${index}_plan`] ? 'border-red-500' : 'border-gray-600'
                                    )}
                                  >
                                    <option value="">Select a billing plan...</option>
                                    {availablePlans.map((plan) => (
                                      <option key={plan.id} value={plan.id}>
                                        {plan.name} ({plan.metricType} - {plan.billingCycle})
                                      </option>
                                    ))}
                                  </select>
                                  {errors[`metric_${index}_plan`] && (
                                    <p className="text-red-400 text-xs mt-1">{errors[`metric_${index}_plan`]}</p>
                                  )}
                                  <p className="text-xs text-gray-400 mt-1">
                                    Choose which billing plan this metric should be charged to
                                  </p>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-700">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || metrics.length === 0}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {isSaving ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FiSave className="w-4 h-4" />
                      Save Configuration
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentMetricsConfig;
