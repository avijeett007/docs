'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  FiSettings,
  FiDollarSign,
  FiFileText,
  FiSave,
  FiRefreshCw,
  FiInfo,
  FiAlertCircle,
  FiLoader
} from 'react-icons/fi';

interface KBProcessingConfigProps {
  partnerId?: string;
  className?: string;
}

interface ProcessingConfig {
  kbProcessingCostCredits: number;
  kbMaxFileSizeMB: number;
  kbOverageCostPerMB: number;
  currentCreditBalance: number;
  defaults: {
    kbProcessingCostCredits: number;
    kbMaxFileSizeMB: number;
    kbOverageCostPerMB: number;
  };
}

export default function KBProcessingConfig({
  partnerId,
  className = ''
}: KBProcessingConfigProps) {
  const [config, setConfig] = useState<ProcessingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<ProcessingConfig | null>(null);

  // Fetch current configuration
  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/knowledge-base/config', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch configuration');
      }

      const data = await response.json();
      setConfig(data.data);
      setOriginalConfig(data.data);
      setHasChanges(false);
    } catch (error) {
      console.error('Error fetching KB processing config:', error);
      toast.error('Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  };

  // Save configuration
  const saveConfig = async () => {
    if (!config || !hasChanges) return;

    try {
      setIsSaving(true);
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/knowledge-base/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        },
        body: JSON.stringify({
          kbProcessingCostCredits: config.kbProcessingCostCredits,
          kbMaxFileSizeMB: config.kbMaxFileSizeMB,
          kbOverageCostPerMB: config.kbOverageCostPerMB,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save configuration');
      }

      const data = await response.json();
      setOriginalConfig(config);
      setHasChanges(false);
      toast.success('Configuration saved successfully');
    } catch (error: any) {
      console.error('Error saving KB processing config:', error);
      toast.error(error.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Update configuration field
  const updateConfig = (field: keyof ProcessingConfig, value: number) => {
    if (!config) return;

    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    
    // Check if there are changes
    const hasChanges = originalConfig ? (
      newConfig.kbProcessingCostCredits !== originalConfig.kbProcessingCostCredits ||
      newConfig.kbMaxFileSizeMB !== originalConfig.kbMaxFileSizeMB ||
      newConfig.kbOverageCostPerMB !== originalConfig.kbOverageCostPerMB
    ) : false;
    
    setHasChanges(hasChanges);
  };

  // Reset to defaults
  const resetToDefaults = () => {
    if (!config) return;

    const defaultConfig = {
      ...config,
      kbProcessingCostCredits: config.defaults.kbProcessingCostCredits,
      kbMaxFileSizeMB: config.defaults.kbMaxFileSizeMB,
      kbOverageCostPerMB: config.defaults.kbOverageCostPerMB,
    };

    setConfig(defaultConfig);
    setHasChanges(true);
  };

  // Calculate example cost
  const calculateExampleCost = (fileSizeMB: number) => {
    if (!config) return 0;

    let cost = config.kbProcessingCostCredits;
    if (fileSizeMB > config.kbMaxFileSizeMB) {
      const overageMB = fileSizeMB - config.kbMaxFileSizeMB;
      cost += Math.ceil(overageMB) * config.kbOverageCostPerMB;
    }
    return cost;
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  if (isLoading) {
    return (
      <div className={`bg-gray-800/50 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <FiLoader className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="ml-2 text-gray-300">Loading configuration...</span>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={`bg-gray-800/50 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-center py-8 text-gray-400">
          <FiAlertCircle className="w-6 h-6 mr-2" />
          <span>Failed to load configuration</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800/50 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FiSettings className="w-6 h-6 text-blue-400" />
          <div>
            <h3 className="text-xl font-semibold text-white">Knowledge Base Processing Configuration</h3>
            <p className="text-sm text-gray-400">Configure processing costs for your customers</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConfig}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh configuration"
          >
            <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Current Credit Balance */}
      <div className="mb-6 p-4 bg-blue-600/10 border border-blue-600/20 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <FiDollarSign className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-medium text-blue-400">Current Credit Balance</span>
        </div>
        <div className="text-2xl font-bold text-white">{config.currentCreditBalance.toLocaleString()} credits</div>
      </div>

      {/* Configuration Form */}
      <div className="space-y-6">
        {/* Base Processing Cost */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Base Processing Cost (Credits)
          </label>
          <input
            type="number"
            min="1"
            max="1000"
            value={config.kbProcessingCostCredits}
            onChange={(e) => updateConfig('kbProcessingCostCredits', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Credits charged per knowledge base processing (default: {config.defaults.kbProcessingCostCredits})
          </p>
        </div>

        {/* Max File Size */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Included File Size Limit (MB)
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={config.kbMaxFileSizeMB}
            onChange={(e) => updateConfig('kbMaxFileSizeMB', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Maximum file size included in base cost (default: {config.defaults.kbMaxFileSizeMB} MB)
          </p>
        </div>

        {/* Overage Cost */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Overage Cost per MB (Credits)
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={config.kbOverageCostPerMB}
            onChange={(e) => updateConfig('kbOverageCostPerMB', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Additional credits per MB over the limit (default: {config.defaults.kbOverageCostPerMB})
          </p>
        </div>
      </div>

      {/* Cost Examples */}
      <div className="mt-6 p-4 bg-gray-700/30 rounded-lg">
        <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <FiInfo className="w-4 h-4" />
          Cost Examples
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-400">5 MB files:</div>
            <div className="text-white font-medium">{calculateExampleCost(5)} credits</div>
          </div>
          <div>
            <div className="text-gray-400">15 MB files:</div>
            <div className="text-white font-medium">{calculateExampleCost(15)} credits</div>
          </div>
          <div>
            <div className="text-gray-400">25 MB files:</div>
            <div className="text-white font-medium">{calculateExampleCost(25)} credits</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-700">
        <button
          onClick={resetToDefaults}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Reset to Defaults
        </button>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm text-amber-400">Unsaved changes</span>
          )}
          
          <button
            onClick={saveConfig}
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
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
    </div>
  );
}
