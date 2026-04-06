import React, { useState } from 'react';
import { motion as m } from 'framer-motion';
import { FiPhone, FiX, FiPhoneIncoming, FiPhoneOutgoing } from 'react-icons/fi';
import { HexColorPicker } from 'react-colorful';

interface PhoneWidgetDesignerProps {
  onClose: () => void;
  onSave: (widgetConfig: PhoneWidgetConfig) => void;
  availablePhoneNumbers?: string[];
}

export interface PhoneWidgetConfig {
  type: 'inbound' | 'outbound';
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  welcomeMessage: string;
  buttonText: string;
  phoneNumber: string;
}

const DEFAULT_CONFIG: PhoneWidgetConfig = {
  type: 'inbound',
  primaryColor: '#2563eb',
  position: 'bottom-right',
  welcomeMessage: 'Need to talk? Call us now!',
  buttonText: 'Call Now',
  phoneNumber: '+1234567890', // Default dummy number
};

const WidgetPreview: React.FC<{ config: PhoneWidgetConfig }> = ({ config }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (config.type === 'inbound') {
    return (
      <div className={`relative ${config.position === 'bottom-right' ? 'ml-auto' : ''}`}>
        <m.div
          className="relative"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div 
            className="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer shadow-lg"
            style={{ backgroundColor: config.primaryColor }}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <FiPhoneIncoming className="w-6 h-6 text-white" />
          </div>
          {isExpanded && !showConfirm && (
            <div className="absolute bottom-16 right-0 bg-white p-4 rounded-lg shadow-lg w-64">
              <p className="text-gray-800 mb-3">{config.welcomeMessage}</p>
              <div className="text-sm text-gray-600 mb-2">
                Call us at: {config.phoneNumber}
              </div>
              <button
                className="w-full py-2 rounded-lg text-white flex items-center justify-center gap-2"
                style={{ backgroundColor: config.primaryColor }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(true);
                }}
              >
                <FiPhone className="w-4 h-4" />
                {config.buttonText}
              </button>
            </div>
          )}
          {showConfirm && (
            <div className="absolute bottom-16 right-0 bg-white p-4 rounded-lg shadow-lg w-64">
              <p className="text-gray-800 mb-3">Ready to call {config.phoneNumber}?</p>
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 rounded-lg text-white flex items-center justify-center gap-2"
                  style={{ backgroundColor: config.primaryColor }}
                  onClick={() => {
                    window.location.href = `tel:${config.phoneNumber}`;
                  }}
                >
                  <FiPhone className="w-4 h-4" />
                  Yes
                </button>
                <button
                  className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-800 flex items-center justify-center gap-2"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </m.div>
      </div>
    );
  }

  return (
    <div className={`relative ${config.position === 'bottom-right' ? 'ml-auto' : ''}`}>
      <m.div
        className="relative"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div 
          className="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer shadow-lg"
          style={{ backgroundColor: config.primaryColor }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <FiPhoneOutgoing className="w-6 h-6 text-white" />
        </div>
        {isExpanded && (
          <div className="absolute bottom-16 right-0 bg-white p-4 rounded-lg shadow-lg w-80">
            <p className="text-gray-800 mb-3">{config.welcomeMessage}</p>
            <textarea 
              className="w-full p-2 border rounded-lg mb-3 resize-none"
              placeholder="Leave us a message (optional)"
              rows={3}
            />
            <div className="flex gap-2">
              <input
                type="tel"
                className="flex-1 p-2 border rounded-lg"
                placeholder="Your phone number"
              />
              <button
                className="px-4 py-2 rounded-lg text-white flex items-center gap-2"
                style={{ backgroundColor: config.primaryColor }}
              >
                <FiPhone className="w-4 h-4" />
                {config.buttonText}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 text-center">
              We'll call you back at the number you provide
            </p>
          </div>
        )}
      </m.div>
    </div>
  );
};

export const PhoneWidgetDesigner: React.FC<PhoneWidgetDesignerProps> = ({ 
  onClose, 
  onSave,
  availablePhoneNumbers = ['+1234567890'] // Default dummy number
}) => {
  const [config, setConfig] = useState<PhoneWidgetConfig>(DEFAULT_CONFIG);
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <m.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-gray-900 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <FiX className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-semibold text-white mb-6">Design Phone Widget</h2>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Widget Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  className={`p-4 rounded-lg border ${
                    config.type === 'inbound'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700'
                  }`}
                  onClick={() => setConfig({ ...config, type: 'inbound' })}
                >
                  <FiPhoneIncoming className="w-6 h-6 mx-auto mb-2" />
                  <span className="block text-sm">Inbound Call</span>
                </button>
                <button
                  className={`p-4 rounded-lg border ${
                    config.type === 'outbound'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700'
                  }`}
                  onClick={() => setConfig({ ...config, type: 'outbound' })}
                >
                  <FiPhoneOutgoing className="w-6 h-6 mx-auto mb-2" />
                  <span className="block text-sm">Outbound Call</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Phone Number
              </label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                value={config.phoneNumber}
                onChange={(e) => setConfig({ ...config, phoneNumber: e.target.value })}
              >
                {availablePhoneNumbers.map((number) => (
                  <option key={number} value={number}>
                    {number}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Primary Color
              </label>
              <div className="relative">
                <button
                  className="w-full h-10 rounded-lg border border-gray-700"
                  style={{ backgroundColor: config.primaryColor }}
                  onClick={() => setShowColorPicker(!showColorPicker)}
                />
                {showColorPicker && (
                  <div className="absolute top-full left-0 mt-2 z-10">
                    <HexColorPicker
                      color={config.primaryColor}
                      onChange={(color) => setConfig({ ...config, primaryColor: color })}
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Position
              </label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                value={config.position}
                onChange={(e) => setConfig({ ...config, position: e.target.value as any })}
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Welcome Message
              </label>
              <input
                type="text"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                value={config.welcomeMessage}
                onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Button Text
              </label>
              <input
                type="text"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                value={config.buttonText}
                onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-white mb-4">Preview</h3>
            <div className="bg-gray-800 rounded-lg p-6 h-[400px] flex items-end">
              <WidgetPreview config={config} />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-700 text-white hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(config)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Save Widget Design
          </button>
        </div>
      </m.div>
    </div>
  );
};
