'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiPlay, FiSquare, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import WidgetFactory from '@/components/widgets/WidgetFactory';
import { WidgetConfig } from '@/providers/types';

interface WidgetTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgetId: string;
  widgetName: string;
  widgetConfig: WidgetConfig;
}

const WidgetTestModal: React.FC<WidgetTestModalProps> = ({
  isOpen,
  onClose,
  widgetId,
  widgetName,
  widgetConfig
}) => {
  const [isWidgetActive, setIsWidgetActive] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'connected' | 'ended' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [testStartTime, setTestStartTime] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (callStatus === 'connected' && testStartTime) {
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - testStartTime.getTime()) / 1000));
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [callStatus, testStartTime]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsWidgetActive(true);
      setCallStatus('idle');
      setError(null);
      setTestStartTime(null);
      setCallDuration(0);
    } else {
      setIsWidgetActive(false);
      setCallStatus('idle');
    }
  }, [isOpen]);

  const handleCallStart = () => {
    setCallStatus('connecting');
    setTestStartTime(new Date());
    setError(null);
    
    // Simulate connection delay
    setTimeout(() => {
      setCallStatus('connected');
      toast.success('Widget test call started!');
    }, 1000);
  };

  const handleCallEnd = () => {
    setCallStatus('ended');
    setTestStartTime(null);
    toast.success(`Widget test completed! Duration: ${formatDuration(callDuration)}`);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setCallStatus('error');
    toast.error(`Widget error: ${errorMessage}`);
  };

  const resetTest = () => {
    setCallStatus('idle');
    setError(null);
    setTestStartTime(null);
    setCallDuration(0);
    toast.success('Widget test reset');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'connecting':
        return 'text-amber-400';
      case 'connected':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'ended':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return `Connected (${formatDuration(callDuration)})`;
      case 'error':
        return 'Error';
      case 'ended':
        return 'Call Ended';
      default:
        return 'Ready to Test';
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="relative bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] shadow-xl border border-gray-800 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <Dialog.Title className="text-xl font-semibold text-white">
                Test Widget: {widgetName}
              </Dialog.Title>
              <div className="text-gray-400 text-sm mt-1 space-y-1">
                <div>
                  Type: <span className="text-blue-400 capitalize">{widgetConfig.widgetType}</span>
                  {' • '}
                  Provider: <span className="text-purple-400 uppercase">{widgetConfig.agentType}</span>
                </div>
                <div>
                  Status: <span className={clsx('capitalize', getStatusColor())}>
                    {getStatusText()}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <FiX className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex">
            {/* Widget Preview */}
            <div className="flex-1 relative bg-gradient-to-br from-gray-800 to-gray-900 border-r border-gray-800">
              <div className="absolute inset-4 bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Simulated webpage background */}
                <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
                  <div className="max-w-2xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                      Sample Website
                    </h1>
                    <p className="text-gray-600 mb-6">
                      This is a preview of how your widget will appear on a website. 
                      The widget should appear in the {widgetConfig.customization.behavior.position} corner.
                    </p>
                    <div className="bg-white rounded-lg p-6 shadow-md">
                      <h2 className="text-xl font-semibold text-gray-800 mb-3">
                        Widget Testing Environment
                      </h2>
                      <p className="text-gray-600">
                        Interact with the widget to test its functionality. 
                        The widget is configured with your actual agent settings.
                      </p>
                    </div>
                  </div>

                  {/* Widget Container */}
                  {isWidgetActive && (
                    <div className="relative">
                      <WidgetFactory
                        config={widgetConfig}
                        onCallStart={handleCallStart}
                        onCallEnd={handleCallEnd}
                        onError={handleError}
                        onAnalyticsEvent={(eventType, data) => {
                          console.log('Widget analytics event:', eventType, data);
                        }}
                        publicKey={(widgetConfig.providerConfig as any).publicKey}
                        accessToken={(widgetConfig.providerConfig as any).accessToken}
                        previewMode={false}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Label */}
              <div className="absolute top-2 left-2 bg-gray-800/90 text-white text-xs px-2 py-1 rounded">
                Widget Preview
              </div>
            </div>

            {/* Test Controls & Info */}
            <div className="w-80 p-6 space-y-6">
              {/* Test Controls */}
              <div>
                <h3 className="text-white font-medium mb-3">Test Controls</h3>
                <div className="space-y-3">
                  <button
                    onClick={resetTest}
                    disabled={callStatus === 'connecting'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                  >
                    <FiRefreshCw className="w-4 h-4" />
                    Reset Test
                  </button>
                </div>
              </div>

              {/* Widget Configuration */}
              <div>
                <h3 className="text-white font-medium mb-3">Configuration</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Type:</span>
                    <span className="text-white capitalize">{widgetConfig.widgetType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Provider:</span>
                    <span className="text-white uppercase">{widgetConfig.agentType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Position:</span>
                    <span className="text-white">{widgetConfig.customization.behavior.position}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Size:</span>
                    <span className="text-white capitalize">{widgetConfig.customization.behavior.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Auto Start:</span>
                    <span className="text-white">{widgetConfig.customization.behavior.autoStart ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                  <h4 className="text-red-400 font-medium mb-2">Error</h4>
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              {/* Test Instructions */}
              <div>
                <h3 className="text-white font-medium mb-3">Instructions</h3>
                <div className="text-sm text-gray-400 space-y-2">
                  <p>• Click the widget to start testing</p>
                  <p>• Speak naturally to test responses</p>
                  <p>• Verify appearance and behavior</p>
                  <p>• Test different interaction patterns</p>
                  <p>• Use reset to start over</p>
                </div>
              </div>

              {/* Provider Info */}
              <div>
                <h3 className="text-white font-medium mb-3">Provider Details</h3>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>Agent Type: <span className="text-white uppercase">{widgetConfig.agentType}</span></p>
                  <p>Agent ID: <span className="text-white font-mono text-xs">{widgetConfig.agentId}</span></p>
                  {widgetConfig.agentType === 'vapi' && (
                    <p>Public Key: <span className="text-white font-mono text-xs">
                      {(widgetConfig.providerConfig as any).publicKey?.substring(0, 12)}...
                    </span></p>
                  )}
                  {widgetConfig.agentType === 'retell' && (
                    <p>Access Token: <span className="text-green-400">✓ Generated</span></p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default WidgetTestModal;
