'use client';

import { useState } from 'react';
import { FiX, FiSettings, FiCode, FiCopy, FiCheck, FiShield, FiPlus, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import N8nChatPreview from './N8nChatPreview';

interface N8nChatAgent {
  id: string;
  name: string;
  description?: string;
  customer_id: string;
  customer_name?: string;
  integration_mode: 'custom_node' | 'proxy';
  status: 'active' | 'inactive' | 'testing';
}

interface AdvancedWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: N8nChatAgent;
}

interface WidgetConfig {
  name: string;
  widget_type: 'official' | 'custom';
  title: string;
  subtitle: string;
  welcome_message: string;
  input_placeholder: string;
  mode: 'window' | 'fullscreen';
  show_welcome_screen: boolean;
  load_previous_session: boolean;
  allow_file_uploads: boolean;
  allowed_file_types: string;
  enable_streaming: boolean;
  css_primary_color: string;
  css_secondary_color: string;
  css_background_color: string;
  css_text_color: string;
  css_window_width: string;
  css_window_height: string;
  css_border_radius: string;
  css_toggle_size: string;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primary_color: string;
  secondary_color: string;
  auto_open: boolean;
  auto_open_delay: number;
}

export default function AdvancedWidgetModal({ isOpen, onClose, agent }: AdvancedWidgetModalProps) {
  const [activeTab, setActiveTab] = useState('type');
  const [isCreating, setIsCreating] = useState(false);
  const [widget, setWidget] = useState<any>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState<string[]>(['']);
  
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>({
    name: `${agent.name} Widget`,
    widget_type: 'official',
    title: 'Hi there! 👋',
    subtitle: "Start a chat. We're here to help you 24/7.",
    welcome_message: 'Hello! How can I help you today?',
    input_placeholder: 'Type your question..',
    mode: 'window',
    show_welcome_screen: false,
    load_previous_session: true,
    allow_file_uploads: false,
    allowed_file_types: 'image/*,application/pdf',
    enable_streaming: false,
    css_primary_color: '#e74266',
    css_secondary_color: '#20b69e',
    css_background_color: '#ffffff',
    css_text_color: '#101330',
    css_window_width: '400px',
    css_window_height: '600px',
    css_border_radius: '0.25rem',
    css_toggle_size: '64px',
    position: 'bottom-right',
    primary_color: '#3B82F6',
    secondary_color: '#10B981',
    auto_open: false,
    auto_open_delay: 3000,
  });

  const generateOfficialEmbedCode = () => {
    const analyticsUrl = process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro';

    // Get partner ID from localStorage (JWT token)
    const getPartnerId = () => {
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) return null;

        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.partnerId;
      } catch (error) {
        console.error('Error getting partner ID:', error);
        return null;
      }
    };

    const partnerId = getPartnerId();
    if (!partnerId) {
      console.error('Partner ID not available for embed code generation');
      return '<!-- Error: Partner ID not available -->';
    }

    const webhookUrl = `${analyticsUrl}/proxy/n8n-chat/${partnerId}/${agent.customer_id}/${agent.id}`;
    
    return `<!-- N8N Official Chat Widget -->
<link href="https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css" rel="stylesheet" />
<style>
  :root {
    --chat--color-primary: ${widgetConfig.css_primary_color};
    --chat--color-secondary: ${widgetConfig.css_secondary_color};
    --chat--color-white: ${widgetConfig.css_background_color};
    --chat--color-dark: ${widgetConfig.css_text_color};
    --chat--window--width: ${widgetConfig.css_window_width};
    --chat--window--height: ${widgetConfig.css_window_height};
    --chat--border-radius: ${widgetConfig.css_border_radius};
    --chat--toggle--size: ${widgetConfig.css_toggle_size};
  }
</style>
<script type="module">
  import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';

  createChat({
    webhookUrl: ${JSON.stringify(webhookUrl)},
    mode: ${JSON.stringify(widgetConfig.mode)},
    showWelcomeScreen: ${widgetConfig.show_welcome_screen},
    loadPreviousSession: ${widgetConfig.load_previous_session},
    allowFileUploads: ${widgetConfig.allow_file_uploads},
    allowedFilesMimeTypes: ${JSON.stringify(widgetConfig.allowed_file_types)},
    enableStreaming: ${widgetConfig.enable_streaming},
    initialMessages: [${JSON.stringify(widgetConfig.welcome_message)}],
    i18n: {
      en: {
        title: ${JSON.stringify(widgetConfig.title)},
        subtitle: ${JSON.stringify(widgetConfig.subtitle)},
        inputPlaceholder: ${JSON.stringify(widgetConfig.input_placeholder)},
        getStarted: 'New Conversation',
        closeButtonTooltip: 'Close chat'
      }
    }
  });
</script>
<!-- End N8N Official Chat Widget -->`;
  };

  const generateCustomEmbedCode = () => {
    const analyticsUrl = process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro';

    // Get partner ID from localStorage (JWT token)
    const getPartnerId = () => {
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) return null;

        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.partnerId;
      } catch (error) {
        console.error('Error getting partner ID:', error);
        return null;
      }
    };

    const partnerId = getPartnerId();
    if (!partnerId) {
      console.error('Partner ID not available for embed code generation');
      return '<!-- Error: Partner ID not available -->';
    }

    const webhookUrl = `${analyticsUrl}/proxy/n8n-chat/${partnerId}/${agent.customer_id}/${agent.id}`;
    
    return `<!-- Knotie Custom N8N Chat Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://cdn.knotie-ai.pro/widgets/n8n-chat-widget.js';
    script.async = true;
    script.onload = function() {
      KnotieN8nChat.init({
        webhookUrl: ${JSON.stringify(webhookUrl)},
        title: ${JSON.stringify(widgetConfig.title)},
        welcomeMessage: ${JSON.stringify(widgetConfig.welcome_message)},
        placeholder: ${JSON.stringify(widgetConfig.input_placeholder)},
        position: ${JSON.stringify(widgetConfig.position)},
        primaryColor: ${JSON.stringify(widgetConfig.primary_color)},
        secondaryColor: ${JSON.stringify(widgetConfig.secondary_color)},
        autoOpen: ${widgetConfig.auto_open},
        autoOpenDelay: ${widgetConfig.auto_open_delay}
      });
    };
    document.head.appendChild(script);
  })();
</script>
<!-- End Knotie Custom N8N Chat Widget -->`;
  };

  const handleCreateWidget = async () => {
    try {
      setIsCreating(true);

      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
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
          agent_id: agent.id,
          widget_config: widgetConfig,
          customer_id: agent.customer_id,
          allowed_domains: allowedDomains.filter(domain => domain.trim() !== '')
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create widget');
      }

      const data = await response.json();

      const embedCode = widgetConfig.widget_type === 'official'
        ? generateOfficialEmbedCode()
        : generateCustomEmbedCode();

      setWidget({
        ...data.widget,
        embed_code: embedCode
      });

      toast.success(`${widgetConfig.widget_type === 'official' ? 'N8N Official' : 'Custom'} widget created successfully!`);
      setActiveTab('embed');
      
    } catch (error) {
      console.error('Widget creation failed:', error);
      toast.error('Failed to create widget');
    } finally {
      setIsCreating(false);
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

  const tabs = [
    { id: 'type', label: 'Widget Type', icon: FiSettings },
    { id: 'config', label: 'Configuration', icon: FiCode },
    { id: 'security', label: 'Security', icon: FiShield },
    { id: 'embed', label: 'Embed Code', icon: FiCopy }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex">
        {/* Left Panel - Configuration */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div>
              <h2 className="text-xl font-semibold text-white">Create Widget</h2>
              <p className="text-sm text-gray-400 mt-1">
                Agent: {agent.name} • Customer: {agent.customer_name || agent.customer_id}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'type' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Widget Name
                  </label>
                  <input
                    type="text"
                    value={widgetConfig.name}
                    onChange={(e) => setWidgetConfig(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-4">
                    Widget Type
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Official Widget Option - ENABLED */}
                    <div
                      className="p-4 border-2 border-green-500 bg-green-500/10 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                          <FiCode className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">N8N Official Widget</h3>
                        <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded-full ml-auto">
                          ENABLED
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mb-3">
                        Use the official N8N chat widget with standard customization options.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">Official</span>
                        <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">CDN Hosted</span>
                        <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded">Standard Features</span>
                      </div>
                    </div>

                    {/* Custom Widget Option - UPCOMING */}
                    <div
                      className="p-4 border-2 border-gray-700 bg-gray-800/50 rounded-lg opacity-60"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center">
                          <FiSettings className="w-4 h-4 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-300">Knotie Custom Widget</h3>
                        <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded-full ml-auto">
                          UPCOMING
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm mb-3">
                        Enhanced widget with advanced customization and branding options.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs bg-gray-600/20 text-gray-400 px-2 py-1 rounded">Custom</span>
                        <span className="text-xs bg-gray-600/20 text-gray-400 px-2 py-1 rounded">Advanced Features</span>
                        <span className="text-xs bg-gray-600/20 text-gray-400 px-2 py-1 rounded">Full Branding</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-blue-300">
                      <strong>N8N Official Widget</strong> is automatically selected and ready to use.
                      Custom widget options will be available in future updates.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'config' && (
              <div className="space-y-6">
                {/* Common Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Chat Title
                    </label>
                    <input
                      type="text"
                      value={widgetConfig.title}
                      onChange={(e) => setWidgetConfig(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Input Placeholder
                    </label>
                    <input
                      type="text"
                      value={widgetConfig.input_placeholder}
                      onChange={(e) => setWidgetConfig(prev => ({ ...prev, input_placeholder: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Subtitle
                  </label>
                  <input
                    type="text"
                    value={widgetConfig.subtitle}
                    onChange={(e) => setWidgetConfig(prev => ({ ...prev, subtitle: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Welcome Message
                  </label>
                  <textarea
                    value={widgetConfig.welcome_message}
                    onChange={(e) => setWidgetConfig(prev => ({ ...prev, welcome_message: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Widget Type Specific Options */}
                {widgetConfig.widget_type === 'official' ? (
                  <div className="space-y-4 border-t border-gray-700 pt-6">
                    <h3 className="text-lg font-semibold text-white">N8N Official Widget Options</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Display Mode
                        </label>
                        <select
                          value={widgetConfig.mode}
                          onChange={(e) => setWidgetConfig(prev => ({ ...prev, mode: e.target.value as 'window' | 'fullscreen' }))}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="window">Window (Chat Button)</option>
                          <option value="fullscreen">Fullscreen (Embedded)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={widgetConfig.show_welcome_screen}
                          onChange={(e) => setWidgetConfig(prev => ({ ...prev, show_welcome_screen: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-300">Show Welcome Screen</span>
                      </label>

                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={widgetConfig.load_previous_session}
                          onChange={(e) => setWidgetConfig(prev => ({ ...prev, load_previous_session: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-300">Load Previous Session</span>
                      </label>

                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={widgetConfig.allow_file_uploads}
                          onChange={(e) => setWidgetConfig(prev => ({ ...prev, allow_file_uploads: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-300">Allow File Uploads</span>
                      </label>

                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={widgetConfig.enable_streaming}
                          onChange={(e) => setWidgetConfig(prev => ({ ...prev, enable_streaming: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-300">Enable Streaming Responses</span>
                      </label>
                    </div>

                    {widgetConfig.allow_file_uploads && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Allowed File Types
                        </label>
                        <input
                          type="text"
                          value={widgetConfig.allowed_file_types}
                          onChange={(e) => setWidgetConfig(prev => ({ ...prev, allowed_file_types: e.target.value }))}
                          placeholder="image/*,application/pdf"
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Comma-separated MIME types (e.g., image/*,application/pdf). Leave empty to allow all files.
                        </p>
                      </div>
                    )}

                    {/* CSS Customization Section */}
                    <div className="border-t border-gray-700 pt-6">
                      <h4 className="text-md font-semibold text-white mb-4">Visual Customization</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Primary Color
                          </label>
                          <input
                            type="color"
                            value={widgetConfig.css_primary_color}
                            onChange={(e) => setWidgetConfig(prev => ({ ...prev, css_primary_color: e.target.value }))}
                            className="w-full h-10 bg-gray-800 border border-gray-600 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Secondary Color
                          </label>
                          <input
                            type="color"
                            value={widgetConfig.css_secondary_color}
                            onChange={(e) => setWidgetConfig(prev => ({ ...prev, css_secondary_color: e.target.value }))}
                            className="w-full h-10 bg-gray-800 border border-gray-600 rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Background Color
                          </label>
                          <input
                            type="color"
                            value={widgetConfig.css_background_color}
                            onChange={(e) => setWidgetConfig(prev => ({ ...prev, css_background_color: e.target.value }))}
                            className="w-full h-10 bg-gray-800 border border-gray-600 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Text Color
                          </label>
                          <input
                            type="color"
                            value={widgetConfig.css_text_color}
                            onChange={(e) => setWidgetConfig(prev => ({ ...prev, css_text_color: e.target.value }))}
                            className="w-full h-10 bg-gray-800 border border-gray-600 rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Window Width
                          </label>
                          <input
                            type="text"
                            value={widgetConfig.css_window_width}
                            onChange={(e) => setWidgetConfig(prev => ({ ...prev, css_window_width: e.target.value }))}
                            placeholder="400px"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Window Height
                          </label>
                          <input
                            type="text"
                            value={widgetConfig.css_window_height}
                            onChange={(e) => setWidgetConfig(prev => ({ ...prev, css_window_height: e.target.value }))}
                            placeholder="600px"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 border-t border-gray-700 pt-6">
                    <h3 className="text-lg font-semibold text-white">Custom Widget Options</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Position
                        </label>
                        <select
                          value={widgetConfig.position}
                          onChange={(e) => setWidgetConfig(prev => ({ ...prev, position: e.target.value as any }))}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="bottom-right">Bottom Right</option>
                          <option value="bottom-left">Bottom Left</option>
                          <option value="top-right">Top Right</option>
                          <option value="top-left">Top Left</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Primary Color
                        </label>
                        <input
                          type="color"
                          value={widgetConfig.primary_color}
                          onChange={(e) => setWidgetConfig(prev => ({ ...prev, primary_color: e.target.value }))}
                          className="w-full h-10 bg-gray-800 border border-gray-600 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Secondary Color
                        </label>
                        <input
                          type="color"
                          value={widgetConfig.secondary_color}
                          onChange={(e) => setWidgetConfig(prev => ({ ...prev, secondary_color: e.target.value }))}
                          className="w-full h-10 bg-gray-800 border border-gray-600 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={widgetConfig.auto_open}
                          onChange={(e) => setWidgetConfig(prev => ({ ...prev, auto_open: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-300">Auto Open Chat</span>
                      </label>

                      {widgetConfig.auto_open && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Auto Open Delay (ms)
                          </label>
                          <input
                            type="number"
                            value={widgetConfig.auto_open_delay}
                            onChange={(e) => setWidgetConfig(prev => ({ ...prev, auto_open_delay: parseInt(e.target.value) }))}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                  <h4 className="text-yellow-400 font-medium mb-2 flex items-center gap-2">
                    <FiShield className="w-4 h-4" />
                    Domain Security
                  </h4>
                  <p className="text-sm text-yellow-300">
                    Specify which domains are allowed to embed this widget. This prevents unauthorized use of your widget on other websites.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Allowed Domains
                  </label>
                  <div className="space-y-3">
                    {allowedDomains.map((domain, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <input
                          type="text"
                          value={domain}
                          onChange={(e) => {
                            const newDomains = [...allowedDomains];
                            newDomains[index] = e.target.value;
                            setAllowedDomains(newDomains);
                          }}
                          placeholder="example.com or https://example.com"
                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                        {allowedDomains.length > 1 && (
                          <button
                            onClick={() => {
                              const newDomains = allowedDomains.filter((_, i) => i !== index);
                              setAllowedDomains(newDomains);
                            }}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={() => setAllowedDomains([...allowedDomains, ''])}
                      className="flex items-center gap-2 px-3 py-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-lg transition-colors text-sm"
                    >
                      <FiPlus className="w-4 h-4" />
                      Add Domain
                    </button>
                  </div>

                  <div className="mt-4 bg-gray-800/50 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-gray-300 mb-2">Examples:</h5>
                    <ul className="text-xs text-gray-400 space-y-1">
                      <li>• <code>example.com</code> - Allows both http and https</li>
                      <li>• <code>https://secure.example.com</code> - Only allows https</li>
                      <li>• <code>*.example.com</code> - Allows all subdomains</li>
                      <li>• Leave empty to allow all domains (not recommended for production)</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'embed' && (
              <div className="space-y-6">
                {widget ? (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Embed Code</h3>
                      <button
                        onClick={copyEmbedCode}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                      >
                        {copiedEmbed ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                        {copiedEmbed ? 'Copied!' : 'Copy Code'}
                      </button>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-x-auto">
                        {widget.embed_code}
                      </pre>
                    </div>

                    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                      <h4 className="text-blue-400 font-medium mb-2">Instructions:</h4>
                      <ol className="text-sm text-blue-300 space-y-1">
                        <li>1. Copy the embed code above</li>
                        <li>2. Paste it into your website's HTML, preferably before the closing &lt;/body&gt; tag</li>
                        <li>3. The widget will automatically appear on your website</li>
                        <li>4. Test the widget to ensure it's working correctly</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400">Create a widget first to see the embed code</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-700">
            <div className="text-sm text-gray-400">
              {widgetConfig.widget_type === 'official' ? 'Using N8N Official Widget' : 'Using Knotie Custom Widget'}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              {!widget && (
                <button
                  onClick={handleCreateWidget}
                  disabled={isCreating}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Create Widget'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Live Preview */}
        <div className="w-1/2 border-l border-gray-700 bg-gray-800">
          <N8nChatPreview agent={agent} config={widgetConfig} />
        </div>
      </div>
    </div>
  );
}
