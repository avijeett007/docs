import React, { useEffect, useState } from 'react';
import { motion as m } from 'framer-motion';
import { FiX, FiPhone, FiCode, FiLoader } from 'react-icons/fi';

// Common country codes
const COUNTRY_CODES = [
  { code: '+1', country: 'US/Canada' },
  { code: '+44', country: 'UK' },
  { code: '+91', country: 'India' },
  { code: '+61', country: 'Australia' },
  { code: '+86', country: 'China' },
  { code: '+81', country: 'Japan' },
  { code: '+49', country: 'Germany' },
  { code: '+33', country: 'France' },
  { code: '+39', country: 'Italy' },
  { code: '+7', country: 'Russia' },
];

interface Tool {
  id: string;
  name: string;
  description: string;
  version: string;
}

interface ActionModalProps {
  type: 'transfer' | 'function';
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
  userId: string;
}

export const ActionModal: React.FC<ActionModalProps> = ({
  type,
  isOpen,
  onClose,
  onSave,
  initialData,
  userId
}) => {
  const [formData, setFormData] = React.useState(initialData || {
    name: '',
    condition: '',
    message: '',
    ...(type === 'transfer' 
      ? { phoneNumber: '', countryCode: '+1' }
      : { toolId: '' })
  });

  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (type === 'function' && isOpen) {
      fetchTools();
    }
  }, [type, isOpen, userId]);

  const fetchTools = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/tools/available`);
      if (!response.ok) {
        throw new Error('Failed to fetch tools');
      }
      const data = await response.json();
      setTools(data.tools);
    } catch (err) {
      setError('Failed to load available tools. Please try again.');
      console.error('Error fetching tools:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // For function type, ensure we have both toolId and toolName
    if (type === 'function') {
      const selectedTool = tools.find(t => t.id === formData.toolId);
      if (!selectedTool) {
        setError('Please select a valid tool');
        return;
      }
      onSave({
        ...formData,
        toolName: selectedTool.name
      });
    } else {
      onSave(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <m.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden"
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            {type === 'transfer' ? (
              <FiPhone className="w-6 h-6 text-blue-500" />
            ) : (
              <FiCode className="w-6 h-6 text-purple-500" />
            )}
            <h2 className="text-xl font-semibold text-white">
              {type === 'transfer' ? 'Setup Call Transfer' : 'Setup Function Calling'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Action name
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              maxLength={64}
              className="w-full px-4 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500 transition-colors"
              placeholder="Enter action name"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              {formData.name.length} / 64
            </p>
          </div>

          {type === 'transfer' ? (
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Phone number to transfer to
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="flex space-x-2">
                <select
                  value={formData.countryCode}
                  onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                  className="w-36 rounded-lg border border-gray-600 bg-gray-700 text-white focus:border-blue-500 focus:ring-blue-500 transition-colors"
                >
                  {COUNTRY_CODES.map(({ code, country }) => (
                    <option key={code} value={code}>
                      {code} {country}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="flex-1 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  placeholder="(555) 555-5555"
                  required
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                The call will be transferred to this phone when the condition is met
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Select a function to trigger
                <span className="text-red-500 ml-1">*</span>
              </label>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <FiLoader className="w-6 h-6 text-blue-500 animate-spin" />
                  <span className="ml-2 text-gray-400">Loading available tools...</span>
                </div>
              ) : error ? (
                <div className="text-red-400 text-sm py-2">{error}</div>
              ) : tools.length === 0 ? (
                <div className="text-amber-400 text-sm py-2">
                  No tools available. Please create and connect tools first.
                </div>
              ) : (
                <select
                  value={formData.toolId}
                  onChange={(e) => setFormData({ ...formData, toolId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  required
                >
                  <option value="">Select a tool</option>
                  {tools.map(tool => (
                    <option key={tool.id} value={tool.id}>
                      {tool.name} (v{tool.version})
                    </option>
                  ))}
                </select>
              )}
              {!isLoading && !error && (
                <p className="text-xs text-gray-400 mt-1">
                  This function will be triggered once the below condition is satisfied
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              {type === 'transfer' ? 'When should the call transfer take place?' : 'When to trigger the function?'}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              value={formData.condition}
              onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
              maxLength={500}
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500 transition-colors"
              placeholder={type === 'transfer' 
                ? 'Ex: If the user wants to talk to the manager or business owner'
                : 'Ex: When the user expresses interest in scheduling an appointment or asks about availability'
              }
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              {formData.condition.length} / 500
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              {type === 'transfer' ? 'What to say before transferring the call' : 'What to say before triggering the function'}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              maxLength={500}
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500 transition-colors"
              placeholder={type === 'transfer'
                ? 'Ex: Please wait while we transfer the call to the manager'
                : 'Ex: I\'ll help you schedule an appointment right away. Let me check the available time slots for you.'
              }
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              {formData.message.length} / 500
            </p>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Action
            </button>
          </div>
        </form>
      </m.div>
    </div>
  );
};
