'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiPhone, FiBarChart2, FiMessageSquare, FiShield, FiUsers, FiClock, FiCheckCircle, FiSettings } from 'react-icons/fi';

interface Feature {
  icon: string;
  title: string;
  description: string;
  benefits: string[];
}

interface FeaturesBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

const iconOptions = [
  { value: 'FiPhone', label: 'Phone', icon: FiPhone },
  { value: 'FiBarChart2', label: 'Analytics', icon: FiBarChart2 },
  { value: 'FiMessageSquare', label: 'Messages', icon: FiMessageSquare },
  { value: 'FiShield', label: 'Security', icon: FiShield },
  { value: 'FiUsers', label: 'Users', icon: FiUsers },
  { value: 'FiClock', label: 'Time', icon: FiClock },
  { value: 'FiCheckCircle', label: 'Check', icon: FiCheckCircle },
  { value: 'FiSettings', label: 'Settings', icon: FiSettings },
];

export default function FeaturesBuilder({ value, onChange }: FeaturesBuilderProps) {
  const [features, setFeatures] = useState<Feature[]>([]);

  // Parse initial value
  useEffect(() => {
    try {
      if (value && value.trim()) {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          setFeatures(parsed);
        }
      }
    } catch (error) {
      console.error('Error parsing features JSON:', error);
    }
  }, [value]);

  // Update parent when features change
  useEffect(() => {
    if (features.length > 0) {
      onChange(JSON.stringify(features, null, 2));
    } else {
      onChange('');
    }
  }, [features, onChange]);

  const addFeature = () => {
    const newFeature: Feature = {
      icon: 'FiCheckCircle',
      title: '',
      description: '',
      benefits: ['']
    };
    setFeatures([...features, newFeature]);
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  const updateFeature = (index: number, field: keyof Feature, value: any) => {
    const updated = [...features];
    updated[index] = { ...updated[index], [field]: value };
    setFeatures(updated);
  };

  const addBenefit = (featureIndex: number) => {
    const updated = [...features];
    updated[featureIndex].benefits.push('');
    setFeatures(updated);
  };

  const removeBenefit = (featureIndex: number, benefitIndex: number) => {
    const updated = [...features];
    updated[featureIndex].benefits = updated[featureIndex].benefits.filter((_, i) => i !== benefitIndex);
    setFeatures(updated);
  };

  const updateBenefit = (featureIndex: number, benefitIndex: number, value: string) => {
    const updated = [...features];
    updated[featureIndex].benefits[benefitIndex] = value;
    setFeatures(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-medium">Features Section</h4>
        <button
          type="button"
          onClick={addFeature}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Add Feature
        </button>
      </div>

      {features.length === 0 ? (
        <div className="text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-gray-400">No features added yet. Click "Add Feature" to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {features.map((feature, featureIndex) => {
            const IconComponent = iconOptions.find(opt => opt.value === feature.icon)?.icon || FiCheckCircle;
            
            return (
              <div key={featureIndex} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-white font-medium">Feature {featureIndex + 1}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFeature(featureIndex)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Icon Selection */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Icon</label>
                    <select
                      value={feature.icon}
                      onChange={(e) => updateFeature(featureIndex, 'icon', e.target.value)}
                      className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 p-2.5"
                    >
                      {iconOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Title</label>
                    <input
                      type="text"
                      value={feature.title}
                      onChange={(e) => updateFeature(featureIndex, 'title', e.target.value)}
                      placeholder="Feature title"
                      className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 p-2.5"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-white mb-2">Description</label>
                  <textarea
                    value={feature.description}
                    onChange={(e) => updateFeature(featureIndex, 'description', e.target.value)}
                    placeholder="Feature description"
                    rows={2}
                    className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 p-2.5"
                  />
                </div>

                {/* Benefits */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-white">Benefits</label>
                    <button
                      type="button"
                      onClick={() => addBenefit(featureIndex)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      + Add Benefit
                    </button>
                  </div>
                  <div className="space-y-2">
                    {feature.benefits.map((benefit, benefitIndex) => (
                      <div key={benefitIndex} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={benefit}
                          onChange={(e) => updateBenefit(featureIndex, benefitIndex, e.target.value)}
                          placeholder="Benefit description"
                          className="flex-1 bg-gray-700 text-white text-sm rounded-lg border border-gray-600 p-2.5"
                        />
                        {feature.benefits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBenefit(featureIndex, benefitIndex)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-gray-500 text-xs">
        Create interactive feature cards for your landing page. Each feature can have an icon, title, description, and multiple benefits.
      </p>
    </div>
  );
}
