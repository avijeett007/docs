'use client';

import React, { useState, useEffect } from 'react';
import { FiFileText, FiDroplet, FiType, FiAlignLeft } from 'react-icons/fi';
import BaseConfigModal from './BaseConfigModal';

interface NoteConfig {
  content: string;
  backgroundColor: string;
  textColor: string;
  fontSize: string;
  fontWeight: string;
  textAlign: string;
  borderRadius: string;
  width: number;
  height: number;
}

interface NoteConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: NoteConfig) => void;
  initialConfig?: Partial<NoteConfig>;
}

const BACKGROUND_COLORS = [
  { value: '#fbbf24', label: 'Yellow', color: '#fbbf24' },
  { value: '#60a5fa', label: 'Blue', color: '#60a5fa' },
  { value: '#34d399', label: 'Green', color: '#34d399' },
  { value: '#f87171', label: 'Red', color: '#f87171' },
  { value: '#a78bfa', label: 'Purple', color: '#a78bfa' },
  { value: '#fb7185', label: 'Pink', color: '#fb7185' },
  { value: '#fbbf24', label: 'Orange', color: '#f59e0b' },
  { value: '#6b7280', label: 'Gray', color: '#6b7280' },
];

const TEXT_COLORS = [
  { value: '#000000', label: 'Black', color: '#000000' },
  { value: '#ffffff', label: 'White', color: '#ffffff' },
  { value: '#374151', label: 'Dark Gray', color: '#374151' },
  { value: '#1f2937', label: 'Very Dark', color: '#1f2937' },
];

export default function NoteConfigModal({
  isOpen,
  onClose,
  onSave,
  initialConfig = {},
}: NoteConfigModalProps) {
  const [config, setConfig] = useState<NoteConfig>({
    content: 'Double-click to edit this note...',
    backgroundColor: '#fbbf24',
    textColor: '#000000',
    fontSize: 'medium',
    fontWeight: 'normal',
    textAlign: 'left',
    borderRadius: 'medium',
    width: 200,
    height: 120,
    ...initialConfig,
  });

  useEffect(() => {
    if (isOpen && initialConfig) {
      setConfig({
        content: 'Double-click to edit this note...',
        backgroundColor: '#fbbf24',
        textColor: '#000000',
        fontSize: 'medium',
        fontWeight: 'normal',
        textAlign: 'left',
        borderRadius: 'medium',
        width: 200,
        height: 120,
        ...initialConfig,
      });
    }
  }, [isOpen, initialConfig]);

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  const handleReset = () => {
    setConfig({
      content: 'Double-click to edit this note...',
      backgroundColor: '#fbbf24',
      textColor: '#000000',
      fontSize: 'medium',
      fontWeight: 'normal',
      textAlign: 'left',
      borderRadius: 'medium',
      width: 200,
      height: 120,
    });
  };

  const canSave = config.content.trim().length > 0;

  return (
    <BaseConfigModal
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      title="Note Configuration"
      icon={<FiFileText className="w-5 h-5 text-amber-400" />}
      canSave={canSave}
      onReset={handleReset}
    >
      <div className="space-y-6">
        {/* Content */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiFileText className="w-4 h-4 text-amber-400" />
            Note Content
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Text Content
            </label>
            <textarea
              value={config.content}
              onChange={(e) => setConfig(prev => ({ ...prev, content: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none"
              rows={4}
              placeholder="Enter your note content..."
            />
          </div>
        </div>

        {/* Appearance */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiDroplet className="w-4 h-4 text-purple-400" />
            Appearance
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Background Color
              </label>
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUND_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setConfig(prev => ({ ...prev, backgroundColor: color.value }))}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      config.backgroundColor === color.value 
                        ? 'border-white ring-2 ring-blue-400' 
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: color.color }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Text Color
              </label>
              <div className="grid grid-cols-4 gap-2">
                {TEXT_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setConfig(prev => ({ ...prev, textColor: color.value }))}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      config.textColor === color.value 
                        ? 'border-white ring-2 ring-blue-400' 
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: color.color }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Typography */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiType className="w-4 h-4 text-green-400" />
            Typography
          </h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Font Size
              </label>
              <select
                value={config.fontSize}
                onChange={(e) => setConfig(prev => ({ ...prev, fontSize: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="x-large">X-Large</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Font Weight
              </label>
              <select
                value={config.fontWeight}
                onChange={(e) => setConfig(prev => ({ ...prev, fontWeight: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              >
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="semibold">Semi Bold</option>
                <option value="bold">Bold</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <FiAlignLeft className="w-4 h-4" />
                Alignment
              </label>
              <select
                value={config.textAlign}
                onChange={(e) => setConfig(prev => ({ ...prev, textAlign: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
                <option value="justify">Justify</option>
              </select>
            </div>
          </div>
        </div>

        {/* Size & Shape */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white">Size & Shape</h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Width (px)
              </label>
              <input
                type="number"
                value={config.width}
                onChange={(e) => setConfig(prev => ({ ...prev, width: parseInt(e.target.value) || 200 }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                min="100"
                max="500"
                step="10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Height (px)
              </label>
              <input
                type="number"
                value={config.height}
                onChange={(e) => setConfig(prev => ({ ...prev, height: parseInt(e.target.value) || 120 }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                min="60"
                max="300"
                step="10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Border Radius
              </label>
              <select
                value={config.borderRadius}
                onChange={(e) => setConfig(prev => ({ ...prev, borderRadius: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              >
                <option value="none">None</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="full">Full (Pill)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white">Preview</h3>
          <div className="flex justify-center">
            <div
              className={`p-4 border border-gray-600 transition-all ${
                config.borderRadius === 'none' ? 'rounded-none' :
                config.borderRadius === 'small' ? 'rounded-sm' :
                config.borderRadius === 'medium' ? 'rounded-lg' :
                config.borderRadius === 'large' ? 'rounded-xl' :
                'rounded-full'
              } ${
                config.fontSize === 'small' ? 'text-sm' :
                config.fontSize === 'medium' ? 'text-base' :
                config.fontSize === 'large' ? 'text-lg' :
                'text-xl'
              } ${
                config.fontWeight === 'normal' ? 'font-normal' :
                config.fontWeight === 'medium' ? 'font-medium' :
                config.fontWeight === 'semibold' ? 'font-semibold' :
                'font-bold'
              }`}
              style={{
                backgroundColor: config.backgroundColor,
                color: config.textColor,
                textAlign: config.textAlign as any,
                width: `${config.width}px`,
                height: `${config.height}px`,
                overflow: 'hidden'
              }}
            >
              {config.content}
            </div>
          </div>
        </div>

        {/* Configuration Preview */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white">Configuration Preview</h3>
          <div className="p-3 bg-gray-900 rounded-lg border border-gray-600 max-h-40 overflow-y-auto">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </BaseConfigModal>
  );
}