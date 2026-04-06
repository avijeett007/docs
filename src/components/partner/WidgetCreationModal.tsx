'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiEye, FiCopy, FiCheck, FiSettings } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { WidgetFactory } from '@/components/widgets';
import { WidgetConfig, WidgetType, ProviderName } from '@/providers/types';
import ColorPicker from '@/components/ui/ColorPicker';

interface WidgetCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentType: ProviderName;
  agentName: string;
  customerId?: string;
  editMode?: boolean;
  widgetId?: string;
  onWidgetUpdated?: () => void;
}

const WIDGET_TYPES: { value: WidgetType; label: string; description: string }[] = [
  { value: 'siri', label: 'Siri Style', description: 'Animated waveform with voice activity feedback' },
  { value: 'orb', label: '3D Orb', description: 'Morphing 3D sphere that reacts to voice' },
  { value: 'floaty', label: 'Floating Button', description: 'Fixed position floating action button' },
  { value: 'minimal', label: 'Minimal', description: 'Clean, simple interface with audio visualizer' },
  { value: 'radial', label: 'Radial Bars', description: 'Circular audio visualization with radial bars' },
  { value: 'glob', label: '3D Glob', description: 'Advanced 3D morphing sphere with dynamic effects' },
  { value: 'outbound', label: 'Outbound Call', description: 'Phone number input for outbound calling' }
];

const POSITIONS = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'top-left', label: 'Top Left' },
  { value: 'center', label: 'Center' }
];

const SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
];

const WidgetCreationModal: React.FC<WidgetCreationModalProps> = ({
  isOpen,
  onClose,
  agentId,
  agentType,
  agentName,
  customerId,
  editMode = false,
  widgetId,
  onWidgetUpdated
}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[WidgetCreationModal] Props:', { agentId, agentType, agentName, customerId });
  }
  const [step, setStep] = useState<'configure' | 'preview' | 'deploy'>('configure');
  const [isLoading, setIsLoading] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>({
    widgetType: 'siri',
    agentType,
    agentId,
    providerConfig: {
      agentId: agentId || '',  // Ensure agentId is never undefined
      customConfig: {}
    },
    customization: {
      appearance: {
        primaryColor: '#6366F1',
        secondaryColor: '#8B5CF6',
        backgroundColor: 'transparent',
        textColor: '#1F2937',
        borderRadius: 12
      },
      behavior: {
        position: 'bottom-right',
        size: 'medium',
        autoStart: false,
        showBranding: true,
        showTranscript: false,
        showInteractionHints: true
      },
      messages: {
        welcomeMessage: '',
        buttonText: '',
        endCallText: 'End Call',
        interactionHint: ''
      },
      branding: {
        enabled: false,
        text: '',
        url: 'https://knotie-ai.pro',
        position: 'bottom-center',
        fontSize: 12,
        opacity: 0.5
      }
    },
    security: {
      widgetToken: '',
      allowedDomains: []
    }
  });

  const [widgetName, setWidgetName] = useState(`${agentName} Widget`);
  const [allowedDomains, setAllowedDomains] = useState<string>('');
  const [embedCode, setEmbedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [testCredentials, setTestCredentials] = useState<{
    publicKey?: string;
    accessToken?: string;
  }>({});
  const [isLoadingWidget, setIsLoadingWidget] = useState(false);

  // Load existing widget data when in edit mode
  useEffect(() => {
    const loadWidgetData = async () => {
      if (!editMode || !widgetId) return;

      setIsLoadingWidget(true);
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) {
          throw new Error('Authentication required');
        }

        const response = await fetch(`/api/partner/widgets/${widgetId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!response.ok) throw new Error('Failed to load widget');

        const data = await response.json();
        const widget = data.widget;

        // Update widget configuration with proper structure
        setWidgetConfig(prev => ({
          ...prev,
          widgetType: widget.widgetType,
          customization: {
            appearance: {
              primaryColor: widget.customization?.appearance?.primaryColor || widget.primaryColor || prev.customization.appearance.primaryColor,
              secondaryColor: widget.customization?.appearance?.secondaryColor || widget.secondaryColor || prev.customization.appearance.secondaryColor,
              backgroundColor: widget.customization?.appearance?.backgroundColor || widget.backgroundColor || prev.customization.appearance.backgroundColor,
              textColor: widget.customization?.appearance?.textColor || widget.textColor || prev.customization.appearance.textColor,
              borderRadius: widget.customization?.appearance?.borderRadius || widget.borderRadius || prev.customization.appearance.borderRadius
            },
            behavior: {
              position: widget.customization?.behavior?.position || widget.position || prev.customization.behavior.position,
              size: widget.customization?.behavior?.size || widget.size || prev.customization.behavior.size,
              autoStart: widget.customization?.behavior?.autoStart ?? widget.autoStart ?? prev.customization.behavior.autoStart,
              showBranding: widget.customization?.behavior?.showBranding ?? widget.showBranding ?? prev.customization.behavior.showBranding,
              showTranscript: widget.customization?.behavior?.showTranscript ?? widget.showTranscript ?? prev.customization.behavior.showTranscript,
              showInteractionHints: widget.customization?.behavior?.showInteractionHints ?? prev.customization.behavior.showInteractionHints
            },
            messages: {
              welcomeMessage: widget.customization?.messages?.welcomeMessage || widget.welcomeMessage || prev.customization.messages.welcomeMessage,
              buttonText: widget.customization?.messages?.buttonText || widget.buttonText || prev.customization.messages.buttonText,
              endCallText: widget.customization?.messages?.endCallText || widget.endCallText || prev.customization.messages.endCallText,
              interactionHint: widget.customization?.messages?.interactionHint || prev.customization.messages.interactionHint
            },
            branding: prev.customization.branding // Keep existing branding settings
          },
          security: {
            widgetToken: widget.widgetToken || '',
            allowedDomains: widget.allowedDomains || []
          }
        }));

        // Update other form fields
        setWidgetName(widget.name);
        setAllowedDomains(widget.allowedDomains?.join('\n') || '');

      } catch (error) {
        console.error('Error loading widget:', error);
        toast.error('Failed to load widget data');
      } finally {
        setIsLoadingWidget(false);
      }
    };

    loadWidgetData();
  }, [editMode, widgetId]);

  const handleConfigChange = (path: string, value: any) => {
    setWidgetConfig(prev => {
      const newConfig = { ...prev };
      const keys = path.split('.');
      let current: any = newConfig;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  const handleCreateWidget = async () => {
    setIsLoading(true);

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const url = editMode && widgetId
        ? `/api/partner/widgets/${widgetId}`
        : '/api/partner/widgets';

      const method = editMode && widgetId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: widgetName,
          description: `Widget for ${agentName || 'agent'}`,
          agentId,
          agentType,
          customerId,
          widgetType: widgetConfig.widgetType,
          customization: widgetConfig.customization,
          allowedDomains: allowedDomains
            .split('\n')
            .map(d => d.trim())
            .filter(d => d.length > 0)
            .map(d => d.replace(/^https?:\/\//, '')) // Remove protocol if present
        }),
      });

      if (!response.ok) {
        const errorMessage = editMode ? 'Failed to update widget' : 'Failed to create widget';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[WidgetCreationModal] API Response:', result);

      if (!result.widget?.widgetToken) {
        throw new Error('Widget token not received from API');
      }

      // Update widget config with token
      setWidgetConfig(prev => ({
        ...prev,
        security: {
          ...prev.security,
          widgetToken: result.widget.widgetToken,
          allowedDomains: allowedDomains.split('\n').filter(d => d.trim())
        }
      }));

      // Generate enhanced embed code with positioning CSS
      const embedScript = `<!-- Knotie AI Widget - Enhanced with Positioning -->
<link rel="stylesheet" href="${window.location.origin}/widget-positioning.css">
<script src="${window.location.origin}/api/public/widget-loader.js"></script>
<div id="knotie-widget" data-token="${result.widget.widgetToken}"></div>`;

      console.log('[WidgetCreationModal] Generated embed code:', embedScript);
      setEmbedCode(embedScript);
      setStep('deploy');

      const successMessage = editMode ? 'Widget updated successfully!' : 'Widget created successfully!';
      toast.success(successMessage);

      // Call the update callback if in edit mode
      if (editMode && onWidgetUpdated) {
        onWidgetUpdated();
      }
    } catch (error) {
      const errorMessage = editMode ? 'Failed to update widget' : 'Failed to create widget';
      toast.error(errorMessage);
      console.error('Widget operation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success('Embed code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchTestCredentials = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      // Use agent test endpoint to get credentials for preview
      const response = await fetch(`/api/partner/${agentType}-agents/${agentId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(agentType === 'ultravox' ? { testType: 'web' } : {}) // Specify web test for Ultravox
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[WidgetCreationModal] Test credentials response:', data);
        setTestCredentials({
          publicKey: data.publicKey || undefined,
          accessToken: data.testCall?.accessToken || data.accessToken || data.testCall?.callUrl || data.signedUrl || undefined
        });

        // Update the widget config with the correct agentId from the response
        if (data.agentId) {
          setWidgetConfig(prev => ({
            ...prev,
            providerConfig: {
              ...prev.providerConfig,
              agentId: data.agentId  // Ensure agentId is set correctly
            }
          }));
        }

        console.log('[WidgetCreationModal] Set test credentials:', {
          publicKey: data.publicKey ? 'present' : 'missing',
          accessToken: (data.testCall?.accessToken || data.accessToken || data.testCall?.callUrl || data.signedUrl) ? 'present' : 'missing',
          signedUrl: data.signedUrl ? 'present' : 'missing',
          agentId: data.agentId || 'missing'
        });
      } else {
        console.error('Failed to fetch test credentials:', response.status);
      }
    } catch (error) {
      console.error('Error fetching test credentials:', error);
    }
  };

  // Fetch test credentials when test mode is enabled
  useEffect(() => {
    if (testMode) {
      fetchTestCredentials();
    }
  }, [testMode]);

  const renderConfigurationStep = () => {
    // Safety check to ensure customization object is properly initialized
    if (!widgetConfig.customization?.appearance) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Initializing widget configuration...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
      {/* Widget Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Widget Name
        </label>
        <input
          type="text"
          value={widgetName}
          onChange={(e) => setWidgetName(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter widget name"
        />
      </div>

      {/* Widget Type */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Widget Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          {WIDGET_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => handleConfigChange('widgetType', type.value)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                widgetConfig.widgetType === type.value
                  ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
              }`}
            >
              <div className="font-medium">{type.label}</div>
              <div className="text-xs opacity-70 mt-1">{type.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Appearance */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Appearance
        </label>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <ColorPicker
            label="Primary Color"
            value={widgetConfig.customization.appearance.primaryColor}
            onChange={(color) => handleConfigChange('customization.appearance.primaryColor', color)}
          />
          <ColorPicker
            label="Secondary Color"
            value={widgetConfig.customization.appearance.secondaryColor}
            onChange={(color) => handleConfigChange('customization.appearance.secondaryColor', color)}
          />
        </div>

        {/* Widget Size */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Widget Size</label>
          <div className="grid grid-cols-3 gap-2">
            {SIZES.map((size) => (
              <button
                key={size.value}
                onClick={() => handleConfigChange('customization.behavior.size', size.value)}
                className={`px-3 py-2 rounded text-sm transition-colors ${
                  widgetConfig.customization.behavior.size === size.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Messages
        </label>
        <p className="text-xs text-gray-400 mb-3">
          Leave fields empty for a minimal widget appearance. Only add text if you want to display messages to users.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Welcome Message (optional)</label>
            <input
              type="text"
              value={widgetConfig.customization.messages.welcomeMessage}
              onChange={(e) => handleConfigChange('customization.messages.welcomeMessage', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              placeholder="e.g., Hi! How can I help you today?"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Button Text (optional)</label>
            <input
              type="text"
              value={widgetConfig.customization.messages.buttonText}
              onChange={(e) => handleConfigChange('customization.messages.buttonText', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              placeholder="e.g., Start Conversation"
            />
          </div>
        </div>
      </div>

      {/* Branding Configuration */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Branding & Interaction
        </label>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="showBranding"
              checked={widgetConfig.customization.behavior.showBranding}
              onChange={(e) => handleConfigChange('customization.behavior.showBranding', e.target.checked)}
              className="rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="showBranding" className="text-sm text-gray-300">
              Show branding
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="showInteractionHints"
              checked={widgetConfig.customization.behavior.showInteractionHints}
              onChange={(e) => handleConfigChange('customization.behavior.showInteractionHints', e.target.checked)}
              className="rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="showInteractionHints" className="text-sm text-gray-300">
              Show interaction hints
            </label>
          </div>

          {widgetConfig.customization.behavior.showInteractionHints && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Interaction Hint Text (optional)</label>
              <input
                type="text"
                value={widgetConfig.customization.messages.interactionHint}
                onChange={(e) => handleConfigChange('customization.messages.interactionHint', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                placeholder="e.g., Click to start conversation"
              />
            </div>
          )}

          {widgetConfig.customization.behavior.showBranding && (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Branding Text</label>
                <input
                  type="text"
                  value={widgetConfig.customization.branding.text}
                  onChange={(e) => handleConfigChange('customization.branding.text', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  placeholder="Powered by Your Brand"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Branding URL (optional)</label>
                <input
                  type="url"
                  value={widgetConfig.customization.branding.url || ''}
                  onChange={(e) => handleConfigChange('customization.branding.url', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  placeholder="https://your-website.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Position</label>
                  <select
                    value={widgetConfig.customization.branding.position}
                    onChange={(e) => handleConfigChange('customization.branding.position', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  >
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="top-center">Top Center</option>
                    <option value="top-left">Top Left</option>
                    <option value="top-right">Top Right</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Font Size</label>
                  <input
                    type="number"
                    min="8"
                    max="20"
                    value={widgetConfig.customization.branding.fontSize}
                    onChange={(e) => handleConfigChange('customization.branding.fontSize', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Allowed Domains */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Allowed Domains
        </label>
        <textarea
          value={allowedDomains}
          onChange={(e) => setAllowedDomains(e.target.value)}
          placeholder="example.com&#10;subdomain.example.com&#10;*.example.com"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm h-20 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          Enter one domain per line. Use * for wildcards.
        </p>
      </div>
    </div>
    );
  };

  const renderPreviewStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium text-white mb-2">Widget Preview</h3>
        <p className="text-sm text-gray-400">
          This is how your widget will appear on websites
        </p>
      </div>

      {/* Test Mode Toggle */}
      <div className="flex items-center justify-center space-x-3 mb-4">
        <span className="text-sm text-gray-400">Preview Mode</span>
        <button
          onClick={() => setTestMode(!testMode)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            testMode ? 'bg-blue-600' : 'bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              testMode ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-sm text-gray-400">Test Mode</span>
      </div>

      {testMode && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-300">
            <strong>Test Mode:</strong> Widget will use real voice functionality for testing.
            {testCredentials.publicKey || testCredentials.accessToken ?
              ' Credentials loaded successfully.' :
              ' Loading credentials...'}
          </p>
        </div>
      )}

      <div className="bg-gray-100 rounded-lg p-8 min-h-[300px] relative">
        <WidgetFactory
          config={widgetConfig}
          onError={(error) => console.error('Preview error:', error)}
          previewMode={!testMode}
          publicKey={testMode ? testCredentials.publicKey : undefined}
          accessToken={testMode ? testCredentials.accessToken : undefined}
        />
      </div>
    </div>
  );

  const renderDeployStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <FiCheck className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">Widget Created Successfully!</h3>
        <p className="text-sm text-gray-400">
          Copy the embed code below and paste it into your website
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Embed Code
        </label>
        <div className="relative">
          <textarea
            value={embedCode}
            readOnly
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm h-24 resize-none font-mono"
          />
          <button
            onClick={copyEmbedCode}
            className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            {copied ? <FiCheck className="w-4 h-4 text-green-400" /> : <FiCopy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-400 mb-2">Next Steps:</h4>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• Paste the embed code anywhere in your website's HTML</li>
          <li>• The widget will automatically position itself as configured</li>
          <li>• Works with WordPress, Elementor, and all website builders</li>
          <li>• Monitor usage in the analytics dashboard</li>
        </ul>
      </div>

      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
        <h4 className="text-sm font-medium text-green-400 mb-2">✨ Enhanced Positioning:</h4>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• Widget will appear in the {widgetConfig.customization.behavior.position.replace('-', ' ')} position</li>
          <li>• Positioning works regardless of where you place the embed code</li>
          <li>• Perfect for page builders like Elementor, Divi, or Gutenberg</li>
          <li>• Responsive design adapts to mobile devices automatically</li>
        </ul>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <Dialog.Title className="text-xl font-semibold text-white">
                {step === 'configure' && (editMode ? 'Edit Widget' : 'Create Widget')}
                {step === 'preview' && 'Preview Widget'}
                {step === 'deploy' && (editMode ? 'Update Widget' : 'Deploy Widget')}
              </Dialog.Title>
              <p className="text-sm text-gray-400 mt-1">
                Agent: {agentName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="p-6">
            {isLoadingWidget ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">Loading widget data...</p>
                </div>
              </div>
            ) : (
              <>
                {step === 'configure' && renderConfigurationStep()}
                {step === 'preview' && renderPreviewStep()}
                {step === 'deploy' && renderDeployStep()}
              </>
            )}
          </div>

          <div className="flex items-center justify-between p-6 border-t border-gray-800">
            <div className="flex space-x-2">
              {['configure', 'preview', 'deploy'].map((s, index) => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full ${
                    s === step ? 'bg-blue-500' : 
                    ['configure', 'preview', 'deploy'].indexOf(step) > index ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              {step === 'preview' && (
                <button
                  onClick={() => setStep('configure')}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Back
                </button>
              )}
              
              {step === 'configure' && (
                <button
                  onClick={() => setStep('preview')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <FiEye className="w-4 h-4" />
                  Preview
                </button>
              )}
              
              {step === 'preview' && (
                <button
                  onClick={handleCreateWidget}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      {editMode ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <FiSettings className="w-4 h-4" />
                      {editMode ? 'Update Widget' : 'Create Widget'}
                    </>
                  )}
                </button>
              )}
              
              {step === 'deploy' && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default WidgetCreationModal;
