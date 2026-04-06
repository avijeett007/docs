'use client';

import React, { useState } from 'react';
import { FiX, FiCopy, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface N8nChatAgent {
  id: string;
  name: string;
  description?: string;
  customer_id: string;
  customer_name?: string;
  integration_mode: 'custom_node' | 'proxy';
  status: 'active' | 'inactive' | 'testing';
}

interface SimpleWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: N8nChatAgent;
}

export default function SimpleWidgetModal({ isOpen, onClose, agent }: SimpleWidgetModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [widget, setWidget] = useState<any>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  
  const [widgetConfig, setWidgetConfig] = useState({
    name: `${agent.name} Widget`,
    title: 'Chat with us',
    welcome_message: 'Hello! How can I help you today?',
    position: 'bottom-right',
    primary_color: '#3B82F6',
    secondary_color: '#10B981',
    auto_open: false,
    auto_open_delay: 3000,
  });

  const handleCreateWidget = async () => {
    try {
      setIsCreating(true);
      
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch('/api/partner/n8n-chat-widgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: widgetConfig.name,
          description: `Widget for ${agent.name}`,
          agent_id: agent.id,
          customer_id: agent.customer_id,
          widget_config: {
            title: widgetConfig.title,
            welcome_message: widgetConfig.welcome_message,
            position: widgetConfig.position,
            auto_open: widgetConfig.auto_open,
            auto_open_delay: widgetConfig.auto_open_delay,
            placeholder: 'Type your message...'
          },
          appearance: {
            primary_color: widgetConfig.primary_color,
            secondary_color: widgetConfig.secondary_color,
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
          is_active: true
        })
      });

      if (response.ok) {
        const result = await response.json();
        setWidget(result.data);
        toast.success('Widget created successfully!');
      } else {
        const error = await response.json();
        console.error('Widget creation failed:', error);
        toast.error(error.message || error.error || 'Failed to create widget');
      }
    } catch (error) {
      console.error('Error creating widget:', error);
      toast.error('Failed to create widget');
    } finally {
      setIsCreating(false);
    }
  };

  const copyWidgetUrl = () => {
    if (widget?.widget_url) {
      navigator.clipboard.writeText(widget.widget_url);
      setCopiedUrl(true);
      toast.success('Widget URL copied to clipboard!');
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const copyEmbedCode = () => {
    if (widget?.embed_code) {
      navigator.clipboard.writeText(widget.embed_code);
      setCopiedEmbed(true);
      toast.success('Embed code copied to clipboard!');
      setTimeout(() => setCopiedEmbed(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-white">Create Widget</h2>
            <p className="text-sm text-gray-400 mt-1">
              Agent: {agent.name} • Customer: {agent.customer_name || 'Unassigned'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {!widget ? (
            /* Configuration Form */
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Widget Name
                </label>
                <input
                  type="text"
                  value={widgetConfig.name}
                  onChange={(e) => setWidgetConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Chat Title
                  </label>
                  <input
                    type="text"
                    value={widgetConfig.title}
                    onChange={(e) => setWidgetConfig(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Position
                  </label>
                  <select
                    value={widgetConfig.position}
                    onChange={(e) => setWidgetConfig(prev => ({ ...prev, position: e.target.value }))}
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
                  value={widgetConfig.welcome_message}
                  onChange={(e) => setWidgetConfig(prev => ({ ...prev, welcome_message: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={widgetConfig.primary_color}
                      onChange={(e) => setWidgetConfig(prev => ({ ...prev, primary_color: e.target.value }))}
                      className="w-12 h-10 rounded border border-gray-600 bg-gray-700"
                    />
                    <input
                      type="text"
                      value={widgetConfig.primary_color}
                      onChange={(e) => setWidgetConfig(prev => ({ ...prev, primary_color: e.target.value }))}
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
                      value={widgetConfig.secondary_color}
                      onChange={(e) => setWidgetConfig(prev => ({ ...prev, secondary_color: e.target.value }))}
                      className="w-12 h-10 rounded border border-gray-600 bg-gray-700"
                    />
                    <input
                      type="text"
                      value={widgetConfig.secondary_color}
                      onChange={(e) => setWidgetConfig(prev => ({ ...prev, secondary_color: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_open"
                  checked={widgetConfig.auto_open}
                  onChange={(e) => setWidgetConfig(prev => ({ ...prev, auto_open: e.target.checked }))}
                  className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="auto_open" className="text-sm text-gray-300">
                  Auto-open widget after {widgetConfig.auto_open_delay / 1000} seconds
                </label>
              </div>
            </div>
          ) : (
            /* Widget Created - Show Embed Code */
            <div className="space-y-6">
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <h3 className="text-green-400 font-medium mb-2">Widget Created Successfully!</h3>
                <p className="text-gray-300 text-sm">
                  Your widget is ready to embed. Copy the code below and paste it into your website.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Widget URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={widget.widget_url}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                  />
                  <button
                    onClick={copyWidgetUrl}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-1"
                  >
                    {copiedUrl ? <FiCheck className="w-3 h-3" /> : <FiCopy className="w-3 h-3" />}
                    {copiedUrl ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Embed Code
                </label>
                <div className="relative">
                  <textarea
                    value={widget.embed_code}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm font-mono"
                    rows={8}
                  />
                  <button
                    onClick={copyEmbedCode}
                    className="absolute top-2 right-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex items-center gap-1"
                  >
                    {copiedEmbed ? <FiCheck className="w-3 h-3" /> : <FiCopy className="w-3 h-3" />}
                    {copiedEmbed ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-blue-400 font-medium mb-2">How to Use:</h4>
                <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Copy the embed code above</li>
                  <li>Paste it into your website's HTML before the closing &lt;/body&gt; tag</li>
                  <li>The widget will automatically appear on your website</li>
                  <li>Visitors can chat directly with your N8N agent</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
          >
            {widget ? 'Close' : 'Cancel'}
          </button>
          {!widget && (
            <button
              onClick={handleCreateWidget}
              disabled={isCreating}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Create Widget'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
