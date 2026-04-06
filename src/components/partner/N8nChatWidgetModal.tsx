'use client';

import React, { useState, useEffect } from 'react';
import { FiX, FiSettings, FiCode, FiGlobe, FiMessageCircle, FiCopy, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface N8nChatAgent {
  id: string;
  name: string;
  status: string;
  integrationMode: string;
}

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

interface N8nChatWidget {
  id: string;
  name: string;
  description?: string;
  agent_id: string;
  customer_id: string;
  widget_config: any;
  appearance: any;
  behavior: any;
  widget_token: string;
  allowed_domains: string[];
  is_active: boolean;
  widget_url: string;
  embed_code: string;
  agent?: N8nChatAgent;
  customer?: Customer;
}

interface N8nChatWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (widgetData: any) => void;
  agents: N8nChatAgent[];
  customers: Customer[];
  widget?: N8nChatWidget | null;
  isLoading?: boolean;
}

export default function N8nChatWidgetModal({
  isOpen,
  onClose,
  onSave,
  agents,
  customers,
  widget,
  isLoading = false
}: N8nChatWidgetModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'appearance' | 'behavior' | 'security' | 'embed'>('basic');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    agent_id: '',
    customer_id: '',
    widget_config: {
      title: 'Chat with us',
      placeholder: 'Type your message...',
      welcome_message: 'Hello! How can I help you today?',
      position: 'bottom-right',
      auto_open: false,
      auto_open_delay: 3000,
    },
    appearance: {
      primary_color: '#3B82F6',
      secondary_color: '#10B981',
      text_color: '#1F2937',
      background_color: '#FFFFFF',
      border_radius: 12,
      font_family: 'Inter, sans-serif',
      widget_size: 'medium',
      show_agent_avatar: true,
      show_typing_indicator: true,
    },
    behavior: {
      enable_sound: true,
      enable_emoji: true,
      max_message_length: 1000,
      session_timeout: 1800,
      enable_file_upload: false,
      enable_feedback: true,
    },
    allowed_domains: [] as string[],
    is_active: true,
  });

  const [domainInput, setDomainInput] = useState('');
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Initialize form data when widget changes
  useEffect(() => {
    if (widget) {
      setFormData({
        name: widget.name,
        description: widget.description || '',
        agent_id: widget.agent_id,
        customer_id: widget.customer_id,
        widget_config: { ...formData.widget_config, ...widget.widget_config },
        appearance: { ...formData.appearance, ...widget.appearance },
        behavior: { ...formData.behavior, ...widget.behavior },
        allowed_domains: widget.allowed_domains || [],
        is_active: widget.is_active,
      });
    } else {
      // Reset form for new widget
      setFormData({
        name: '',
        description: '',
        agent_id: '',
        customer_id: '',
        widget_config: {
          title: 'Chat with us',
          placeholder: 'Type your message...',
          welcome_message: 'Hello! How can I help you today?',
          position: 'bottom-right',
          auto_open: false,
          auto_open_delay: 3000,
        },
        appearance: {
          primary_color: '#3B82F6',
          secondary_color: '#10B981',
          text_color: '#1F2937',
          background_color: '#FFFFFF',
          border_radius: 12,
          font_family: 'Inter, sans-serif',
          widget_size: 'medium',
          show_agent_avatar: true,
          show_typing_indicator: true,
        },
        behavior: {
          enable_sound: true,
          enable_emoji: true,
          max_message_length: 1000,
          session_timeout: 1800,
          enable_file_upload: false,
          enable_feedback: true,
        },
        allowed_domains: [],
        is_active: true,
      });
    }
    setActiveTab('basic');
  }, [widget]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Widget name is required');
      return;
    }
    
    if (!formData.agent_id) {
      toast.error('Please select an agent');
      return;
    }
    
    if (!formData.customer_id) {
      toast.error('Please select a customer');
      return;
    }

    onSave(formData);
  };

  const addDomain = () => {
    if (domainInput.trim() && !formData.allowed_domains.includes(domainInput.trim())) {
      setFormData(prev => ({
        ...prev,
        allowed_domains: [...prev.allowed_domains, domainInput.trim()]
      }));
      setDomainInput('');
    }
  };

  const removeDomain = (domain: string) => {
    setFormData(prev => ({
      ...prev,
      allowed_domains: prev.allowed_domains.filter(d => d !== domain)
    }));
  };

  const copyEmbedCode = () => {
    if (widget?.embed_code) {
      navigator.clipboard.writeText(widget.embed_code);
      setCopiedEmbed(true);
      toast.success('Embed code copied to clipboard!');
      setTimeout(() => setCopiedEmbed(false), 2000);
    }
  };

  const getCustomerDisplayName = (customer: Customer) => {
    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    return customer.email;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {widget ? 'Edit Widget' : 'Create Widget'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('basic')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'basic'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FiSettings className="w-4 h-4" />
            Basic
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'appearance'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FiSettings className="w-4 h-4" />
            Appearance
          </button>
          <button
            onClick={() => setActiveTab('behavior')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'behavior'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FiMessageCircle className="w-4 h-4" />
            Behavior
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'security'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FiGlobe className="w-4 h-4" />
            Security
          </button>
          {widget && (
            <button
              onClick={() => setActiveTab('embed')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'embed'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <FiCode className="w-4 h-4" />
              Embed Code
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            {/* Basic Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Widget Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter widget name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter widget description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Agent *
                    </label>
                    <select
                      value={formData.agent_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, agent_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select an agent</option>
                      {agents
                        .filter(agent => agent.status === 'active')
                        .map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} ({agent.integrationMode})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Customer *
                    </label>
                    <select
                      value={formData.customer_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {getCustomerDisplayName(customer)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Chat Title
                    </label>
                    <input
                      type="text"
                      value={formData.widget_config.title}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        widget_config: { ...prev.widget_config, title: e.target.value }
                      }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Chat with us"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Position
                    </label>
                    <select
                      value={formData.widget_config.position}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        widget_config: { ...prev.widget_config, position: e.target.value }
                      }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Welcome Message
                  </label>
                  <textarea
                    value={formData.widget_config.welcome_message}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      widget_config: { ...prev.widget_config, welcome_message: e.target.value }
                    }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Hello! How can I help you today?"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Input Placeholder
                  </label>
                  <input
                    type="text"
                    value={formData.widget_config.placeholder}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      widget_config: { ...prev.widget_config, placeholder: e.target.value }
                    }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Type your message..."
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.widget_config.auto_open}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        widget_config: { ...prev.widget_config, auto_open: e.target.checked }
                      }))}
                      className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">Auto-open widget</span>
                  </label>

                  {formData.widget_config.auto_open && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-300">after</span>
                      <input
                        type="number"
                        value={formData.widget_config.auto_open_delay / 1000}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          widget_config: { 
                            ...prev.widget_config, 
                            auto_open_delay: parseInt(e.target.value) * 1000 
                          }
                        }))}
                        className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        max="60"
                      />
                      <span className="text-sm text-gray-300">seconds</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.appearance.primary_color}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          appearance: { ...prev.appearance, primary_color: e.target.value }
                        }))}
                        className="w-12 h-10 rounded border border-gray-600 bg-gray-700"
                      />
                      <input
                        type="text"
                        value={formData.appearance.primary_color}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          appearance: { ...prev.appearance, primary_color: e.target.value }
                        }))}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Secondary Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.appearance.secondary_color}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          appearance: { ...prev.appearance, secondary_color: e.target.value }
                        }))}
                        className="w-12 h-10 rounded border border-gray-600 bg-gray-700"
                      />
                      <input
                        type="text"
                        value={formData.appearance.secondary_color}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          appearance: { ...prev.appearance, secondary_color: e.target.value }
                        }))}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Text Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.appearance.text_color}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          appearance: { ...prev.appearance, text_color: e.target.value }
                        }))}
                        className="w-12 h-10 rounded border border-gray-600 bg-gray-700"
                      />
                      <input
                        type="text"
                        value={formData.appearance.text_color}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          appearance: { ...prev.appearance, text_color: e.target.value }
                        }))}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Background Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.appearance.background_color}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          appearance: { ...prev.appearance, background_color: e.target.value }
                        }))}
                        className="w-12 h-10 rounded border border-gray-600 bg-gray-700"
                      />
                      <input
                        type="text"
                        value={formData.appearance.background_color}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          appearance: { ...prev.appearance, background_color: e.target.value }
                        }))}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Widget Size
                    </label>
                    <select
                      value={formData.appearance.widget_size}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        appearance: { ...prev.appearance, widget_size: e.target.value }
                      }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Border Radius
                    </label>
                    <input
                      type="number"
                      value={formData.appearance.border_radius}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        appearance: { ...prev.appearance, border_radius: parseInt(e.target.value) }
                      }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                      max="50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Font Family
                    </label>
                    <select
                      value={formData.appearance.font_family}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        appearance: { ...prev.appearance, font_family: e.target.value }
                      }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Inter, sans-serif">Inter</option>
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="Helvetica, sans-serif">Helvetica</option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="Times New Roman, serif">Times New Roman</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.appearance.show_agent_avatar}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        appearance: { ...prev.appearance, show_agent_avatar: e.target.checked }
                      }))}
                      className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">Show agent avatar</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.appearance.show_typing_indicator}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        appearance: { ...prev.appearance, show_typing_indicator: e.target.checked }
                      }))}
                      className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">Show typing indicator</span>
                  </label>
                </div>
              </div>
            )}

            {/* Behavior Tab */}
            {activeTab === 'behavior' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Max Message Length
                    </label>
                    <input
                      type="number"
                      value={formData.behavior.max_message_length}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        behavior: { ...prev.behavior, max_message_length: parseInt(e.target.value) }
                      }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="100"
                      max="5000"
                    />
                    <p className="text-xs text-gray-400 mt-1">Maximum characters per message</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      value={formData.behavior.session_timeout / 60}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        behavior: { ...prev.behavior, session_timeout: parseInt(e.target.value) * 60 }
                      }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="5"
                      max="120"
                    />
                    <p className="text-xs text-gray-400 mt-1">Auto-close chat after inactivity</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-300">Chat Features</h4>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.behavior.enable_sound}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          behavior: { ...prev.behavior, enable_sound: e.target.checked }
                        }))}
                        className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-300">Enable sound notifications</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.behavior.enable_emoji}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          behavior: { ...prev.behavior, enable_emoji: e.target.checked }
                        }))}
                        className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-300">Enable emoji picker</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.behavior.enable_file_upload}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          behavior: { ...prev.behavior, enable_file_upload: e.target.checked }
                        }))}
                        className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-300">Enable file uploads</span>
                    </label>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-300">User Experience</h4>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.behavior.enable_feedback}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          behavior: { ...prev.behavior, enable_feedback: e.target.checked }
                        }))}
                        className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-300">Enable feedback collection</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <label className="flex items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-300">Widget is active</span>
                  </label>
                  <p className="text-xs text-gray-400">Inactive widgets will not respond to chat requests</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Allowed Domains
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    Restrict widget usage to specific domains. Leave empty to allow all domains.
                    Use *.example.com for wildcard subdomains.
                  </p>

                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="example.com or *.example.com"
                    />
                    <button
                      type="button"
                      onClick={addDomain}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  {formData.allowed_domains.length > 0 && (
                    <div className="space-y-2">
                      {formData.allowed_domains.map((domain, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-700 px-3 py-2 rounded-lg">
                          <span className="text-sm text-gray-300">{domain}</span>
                          <button
                            type="button"
                            onClick={() => removeDomain(domain)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Embed Code Tab */}
            {activeTab === 'embed' && widget && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Widget URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={widget.widget_url}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(widget.widget_url);
                        toast.success('Widget URL copied!');
                      }}
                      className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                    >
                      <FiCopy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Embed Code
                    </label>
                    <button
                      type="button"
                      onClick={copyEmbedCode}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                    >
                      {copiedEmbed ? <FiCheck className="w-3 h-3" /> : <FiCopy className="w-3 h-3" />}
                      {copiedEmbed ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <textarea
                    value={widget.embed_code}
                    readOnly
                    className="w-full h-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 font-mono text-xs focus:outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Copy and paste this code into your website's HTML to embed the chat widget.
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-400 mb-2">Integration Instructions</h4>
                  <ol className="text-xs text-blue-300 space-y-1">
                    <li>1. Copy the embed code above</li>
                    <li>2. Paste it before the closing &lt;/body&gt; tag in your HTML</li>
                    <li>3. The widget will automatically load and be ready for use</li>
                    <li>4. Test the widget to ensure it's working correctly</li>
                  </ol>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : widget ? 'Update Widget' : 'Create Widget'}
          </button>
        </div>
      </div>
    </div>
  );
}
