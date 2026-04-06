'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiShield, FiLock, FiCheckCircle, FiAward, FiStar, FiGlobe, FiUsers, FiTrendingUp } from 'react-icons/fi';

interface TrustIndicator {
  icon: string;
  text: string;
}

interface TrustIndicatorsBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

const iconOptions = [
  { value: 'FiShield', label: 'Shield (Security)', icon: FiShield },
  { value: 'FiLock', label: 'Lock (Privacy)', icon: FiLock },
  { value: 'FiCheckCircle', label: 'Check (Verified)', icon: FiCheckCircle },
  { value: 'FiAward', label: 'Award (Certified)', icon: FiAward },
  { value: 'FiStar', label: 'Star (Quality)', icon: FiStar },
  { value: 'FiGlobe', label: 'Globe (Global)', icon: FiGlobe },
  { value: 'FiUsers', label: 'Users (Trusted)', icon: FiUsers },
  { value: 'FiTrendingUp', label: 'Growth (Proven)', icon: FiTrendingUp },
];

export default function TrustIndicatorsBuilder({ value, onChange }: TrustIndicatorsBuilderProps) {
  const [trustIndicators, setTrustIndicators] = useState<TrustIndicator[]>([]);

  // Parse initial value
  useEffect(() => {
    try {
      if (value && value.trim()) {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          setTrustIndicators(parsed);
        }
      }
    } catch (error) {
      console.error('Error parsing trust indicators JSON:', error);
    }
  }, [value]);

  // Update parent when trust indicators change
  useEffect(() => {
    if (trustIndicators.length > 0) {
      onChange(JSON.stringify(trustIndicators, null, 2));
    } else {
      onChange('');
    }
  }, [trustIndicators, onChange]);

  const addTrustIndicator = () => {
    const newIndicator: TrustIndicator = {
      icon: 'FiShield',
      text: ''
    };
    setTrustIndicators([...trustIndicators, newIndicator]);
  };

  const removeTrustIndicator = (index: number) => {
    setTrustIndicators(trustIndicators.filter((_, i) => i !== index));
  };

  const updateTrustIndicator = (index: number, field: keyof TrustIndicator, value: string) => {
    const updated = [...trustIndicators];
    updated[index] = { ...updated[index], [field]: value };
    setTrustIndicators(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-medium">Trust Indicators</h4>
        <button
          type="button"
          onClick={addTrustIndicator}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Add Indicator
        </button>
      </div>

      {trustIndicators.length === 0 ? (
        <div className="text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-gray-400">No trust indicators added yet. Click "Add Indicator" to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {trustIndicators.map((indicator, index) => {
            const IconComponent = iconOptions.find(opt => opt.value === indicator.icon)?.icon || FiShield;
            
            return (
              <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-green-400" />
                    </div>
                    <span className="text-white font-medium">Trust Indicator {index + 1}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTrustIndicator(index)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Icon Selection */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Icon</label>
                    <select
                      value={indicator.icon}
                      onChange={(e) => updateTrustIndicator(index, 'icon', e.target.value)}
                      className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 p-2.5"
                    >
                      {iconOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Text */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Text</label>
                    <input
                      type="text"
                      value={indicator.text}
                      onChange={(e) => updateTrustIndicator(index, 'text', e.target.value)}
                      placeholder="SOC 2 Compliant"
                      className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 p-2.5"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-3">
        <p className="text-blue-400 text-xs">
          <strong>Examples:</strong> "SOC 2 Compliant", "GDPR Compliant", "99.9% Uptime", "Trusted by 10,000+ businesses", "ISO 27001 Certified"
        </p>
      </div>

      <p className="text-gray-500 text-xs">
        Add trust indicators to build credibility and confidence with your customers. These appear as badges on your landing page.
      </p>
    </div>
  );
}
