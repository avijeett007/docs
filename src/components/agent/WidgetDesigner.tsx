import React, { useState, useEffect, useRef } from 'react';
import { motion as m } from 'framer-motion';
import { FiMic, FiMessageSquare, FiX, FiVideo } from 'react-icons/fi';
import { HexColorPicker } from 'react-colorful';
import { getWidgetDesign, generateEmbedCode, saveWidgetDesign } from '@/utils/widgetDesignStorage';
import type { WidgetConfig } from '@/types/widget';

interface WidgetDesignerProps {
  agentId?: string;
  onClose: () => void;
  onSave: (widgetConfig: WidgetConfig) => void;
}

const DEFAULT_CONFIG: WidgetConfig = {
  id: '',  // This will be set when saving
  agentId: '', // This will be set when saving
  userId: '', // This will be set by the API
  type: 'microphone',
  primaryColor: '#2563eb',
  secondaryColor: '#2563eb',
  backgroundColor: 'transparent',
  connectingColor: '#FCD34D',
  activeColor: '#34D399',
  endedColor: '#EF4444',
  position: 'bottom-right',
  welcomeMessage: 'How can we help you today?',
  buttonText: 'Start Call',
  size: 'medium',
  showParticles: true,
  showPulse: true,
  showBranding: true,
  callStatus: 'idle',
  showTranscript: true,
  showAvatar: true,
  showName: true,
  embedCode: '' // This will be set when saving
};

const WidgetPreview: React.FC<{ config: WidgetConfig }> = ({ config }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [animationPosition, setAnimationPosition] = useState({ x: 0, y: 0 });
  const [focusIntensity, setFocusIntensity] = useState(1);
  const [localCallStatus, setLocalCallStatus] = useState<'idle' | 'connecting' | 'active' | 'ended'>(config.callStatus || 'idle');
  const [hasVideo, setHasVideo] = useState(false);

  // Demo the call flow
  useEffect(() => {
    if (isExpanded && config.type !== 'animated-center') {
      const demoCall = async () => {
        setLocalCallStatus('connecting');
        await new Promise(resolve => setTimeout(resolve, 1500));
        setLocalCallStatus('active');
        await new Promise(resolve => setTimeout(resolve, 5000));
        setLocalCallStatus('ended');
        await new Promise(resolve => setTimeout(resolve, 1500));
        setLocalCallStatus('idle');
        setIsExpanded(false);
      };
      demoCall();
    }
  }, [isExpanded, config.type]);

  // Animation for center widget
  useEffect(() => {
    if (config.type === 'animated-center') {
      const positionInterval = setInterval(() => {
        setAnimationPosition({
          x: Math.random() * 20 - 10,
          y: Math.random() * 20 - 10,
        });
      }, 3000);

      const intensityInterval = setInterval(() => {
        setFocusIntensity(prev => prev === 1 ? 1.1 : 1);
      }, 2000);

      return () => {
        clearInterval(positionInterval);
        clearInterval(intensityInterval);
      };
    }
  }, [config.type]);

  // Request video permission for video widget
  useEffect(() => {
    if (config.type === 'video' && isExpanded) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          const videoElement = document.getElementById('previewVideo') as HTMLVideoElement;
          if (videoElement) {
            videoElement.srcObject = stream;
            setHasVideo(true);
          }
        })
        .catch(() => {
          setHasVideo(false);
        });

      return () => {
        const videoElement = document.getElementById('previewVideo') as HTMLVideoElement;
        if (videoElement && videoElement.srcObject) {
          const stream = videoElement.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
        }
      };
    }
  }, [config.type, isExpanded]);

  const getCallStatusColor = (config: WidgetConfig, status: string) => {
    switch (status) {
      case 'connecting':
        return config.connectingColor;
      case 'active':
        return config.activeColor;
      case 'ended':
        return config.endedColor;
      default:
        return config.primaryColor;
    }
  };

  const getCallStatusMessage = () => {
    switch (localCallStatus) {
      case 'connecting':
        return 'Connecting...';
      case 'active':
        return 'Call in progress';
      case 'ended':
        return 'Call ended';
      default:
        return config.welcomeMessage;
    }
  };

  if (config.type === 'animated-center') {
    const sizeMap = {
      small: 'w-32 h-32',
      medium: 'w-48 h-48',
      large: 'w-64 h-64'
    };

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Background glow effect */}
        {config.showPulse && (
          <div
            className="absolute rounded-full opacity-20 blur-2xl transition-all duration-1000"
            style={{
              backgroundColor: getCallStatusColor(config, localCallStatus),
              width: '150%',
              height: '150%',
              transform: `translate(calc(-50% + ${animationPosition.x}px), calc(-50% + ${animationPosition.y}px)) scale(${focusIntensity})`,
            }}
          />
        )}

        {/* Floating particles */}
        {config.showParticles && (
          <div className="absolute inset-0 opacity-20">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full animate-float"
                style={{
                  backgroundColor: getCallStatusColor(config, localCallStatus),
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 4}s`,
                  animationDuration: `${10 + Math.random() * 10}s`,
                  opacity: 0.3 + Math.random() * 0.7,
                  transform: `scale(${0.5 + Math.random()})`,
                }}
              />
            ))}
          </div>
        )}

        {/* Main button */}
        <m.button
          className={`${sizeMap[config.size]} rounded-full relative group backdrop-blur-lg
            border-2 transition-all duration-700 hover:scale-105 flex items-center justify-center
            ${localCallStatus === 'active' ? 'animate-pulse' : ''}`}
          style={{
            backgroundColor: `${getCallStatusColor(config, localCallStatus)}20`,
            borderColor: `${getCallStatusColor(config, localCallStatus)}40`,
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setLocalCallStatus(prev => prev === 'idle' ? 'connecting' : 'idle')}
        >
          {localCallStatus === 'connecting' ? (
            <m.div
              className="w-10 h-10 border-4 border-white rounded-full border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          ) : (
            <FiMic className={`w-10 h-10 ${localCallStatus === 'active' ? 'text-green-400' : 'text-white'}`} />
          )}
          
          {/* Ripple effects */}
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-full animate-ping"
              style={{
                border: `2px solid ${getCallStatusColor(config, localCallStatus)}`,
                animationDelay: `${i * 0.5}s`,
                opacity: 0.2,
              }}
            />
          ))}
        </m.button>

        {/* Status message */}
        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-white text-center">
          {getCallStatusMessage()}
        </div>
      </div>
    );
  }

  // Regular widget preview
  return (
    <div className={`relative ${config.position === 'bottom-right' ? 'ml-auto' : ''}`}>
      <m.div
        className="relative"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div 
          className={`w-14 h-14 rounded-full flex items-center justify-center cursor-pointer shadow-lg
            ${localCallStatus === 'active' ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: getCallStatusColor(config, localCallStatus) }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {localCallStatus === 'connecting' ? (
            <m.div
              className="w-6 h-6 border-2 border-white rounded-full border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          ) : (
            <>
              {config.type === 'microphone' && <FiMic className={`w-6 h-6 ${localCallStatus === 'active' ? 'text-green-400' : 'text-white'}`} />}
              {config.type === 'text' && <FiMessageSquare className={`w-6 h-6 ${localCallStatus === 'active' ? 'text-green-400' : 'text-white'}`} />}
              {config.type === 'video' && <FiVideo className={`w-6 h-6 ${localCallStatus === 'active' ? 'text-green-400' : 'text-white'}`} />}
            </>
          )}
        </div>
        {isExpanded && (
          <div className="absolute bottom-16 right-0 bg-white p-4 rounded-lg shadow-lg w-80">
            <p className="text-gray-800 mb-3">{getCallStatusMessage()}</p>
            
            {config.type === 'text' && (
              <textarea 
                className="w-full p-2 border rounded-lg mb-3 resize-none"
                placeholder="Type your message..."
                rows={3}
              />
            )}

            {config.type === 'video' && (
              <div className="bg-gray-100 rounded-lg p-4 mb-3">
                {hasVideo ? (
                  <video
                    id="previewVideo"
                    autoPlay
                    playsInline
                    muted
                    className="w-full aspect-video rounded-lg bg-black"
                  />
                ) : (
                  <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                    <p className="text-sm text-gray-600 text-center">
                      {localCallStatus === 'connecting' ? 'Connecting camera...' : 'Camera access required'}
                    </p>
                  </div>
                )}
                {localCallStatus === 'active' && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm text-green-600">Live</span>
                  </div>
                )}
              </div>
            )}

            <button
              className={`w-full py-2 rounded-lg text-white flex items-center justify-center gap-2
                ${localCallStatus === 'active' ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: getCallStatusColor(config, localCallStatus) }}
            >
              {localCallStatus === 'connecting' ? (
                <m.div
                  className="w-4 h-4 border-2 border-white rounded-full border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                <>
                  {config.type === 'microphone' && <FiMic className="w-4 h-4" />}
                  {config.type === 'text' && <FiMessageSquare className="w-4 h-4" />}
                  {config.type === 'video' && <FiVideo className="w-4 h-4" />}
                </>
              )}
              {localCallStatus === 'idle' ? config.buttonText : getCallStatusMessage()}
            </button>
          </div>
        )}
      </m.div>
    </div>
  );
};

export const WidgetDesigner: React.FC<WidgetDesignerProps> = ({ agentId, onClose, onSave }) => {
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT_CONFIG);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);

  // Load saved design when component mounts
  useEffect(() => {
    if (agentId) {
      try {
        console.log(' [WidgetDesigner] Loading saved design for agent:', agentId);
        const savedDesign = getWidgetDesign(agentId);
        if (savedDesign) {
          console.log(' [WidgetDesigner] Found saved design:', savedDesign);
          setConfig(savedDesign);
        } else {
          console.log(' [WidgetDesigner] No saved design found, using default config');
        }
      } catch (error) {
        console.error(' [WidgetDesigner] Error loading widget design:', error);
      }
    }
  }, [agentId]);

  const handleSave = () => {
    try {
      console.log(' [WidgetDesigner] Saving widget design...');
      
      // Get the draft agent ID from local storage
      const draftData = localStorage.getItem('knotie_ai_agent_drafts');
      const draftAgents = draftData ? JSON.parse(draftData) : {};
      const currentDraftId = Object.keys(draftAgents)[0]; // Get the first draft ID since we're in creation mode
      
      const effectiveAgentId = currentDraftId || agentId;
      
      if (!effectiveAgentId) {
        console.error(' [WidgetDesigner] No agent ID available for embed code generation');
        return;
      }

      console.log(' [WidgetDesigner] Using agent ID for save:', effectiveAgentId);
      const embedCode = generateEmbedCode(effectiveAgentId, config);
      
      const widgetConfig: WidgetConfig = {
        ...config,
        id: effectiveAgentId,
        agentId: effectiveAgentId,
        userId: config.userId || '',
        embedCode,
        size: config.size || 'medium',
        showParticles: config.showParticles ?? true,
        showPulse: config.showPulse ?? true,
        showBranding: config.showBranding ?? true,
        showTranscript: config.showTranscript ?? true,
        showAvatar: config.showAvatar ?? true,
        showName: config.showName ?? true
      };
      
      // Save to local storage
      saveWidgetDesign(effectiveAgentId, widgetConfig);
      console.log(' [WidgetDesigner] Saved widget config:', widgetConfig);
      
      onSave(widgetConfig);
      onClose();
    } catch (error) {
      console.error(' [WidgetDesigner] Error saving widget design:', error);
    }
  };

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

        <h2 className="text-2xl font-semibold text-white mb-6">Design Your Widget</h2>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Widget Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  className={`p-4 rounded-lg border ${
                    config.type === 'microphone'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700'
                  }`}
                  onClick={() => setConfig({ ...config, type: 'microphone' })}
                >
                  <FiMic className="w-6 h-6 mx-auto mb-2" />
                  <span className="block text-sm">Voice Call</span>
                </button>
                <button
                  className={`p-4 rounded-lg border ${
                    config.type === 'text'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700'
                  }`}
                  onClick={() => setConfig({ ...config, type: 'text' })}
                >
                  <FiMessageSquare className="w-6 h-6 mx-auto mb-2" />
                  <span className="block text-sm">Text + Voice</span>
                </button>
                <button
                  className={`p-4 rounded-lg border ${
                    config.type === 'video'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700'
                  }`}
                  onClick={() => setConfig({ ...config, type: 'video' })}
                >
                  <FiVideo className="w-6 h-6 mx-auto mb-2" />
                  <span className="block text-sm">Video Call</span>
                </button>
                <button
                  className={`p-4 rounded-lg border ${
                    config.type === 'animated-center'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700'
                  }`}
                  onClick={() => setConfig({ 
                    ...config, 
                    type: 'animated-center',
                    position: 'center'
                  })}
                >
                  <FiMic className="w-6 h-6 mx-auto mb-2" />
                  <span className="block text-sm">Animated Center</span>
                </button>
              </div>
            </div>

            {/* Color Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-200">Widget Colors</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Color
                </label>
                <div className="relative">
                  <button
                    className="w-full h-10 rounded-lg border border-gray-700"
                    style={{ backgroundColor: config.primaryColor }}
                    onClick={() => setShowColorPicker('primary')}
                  />
                  {showColorPicker === 'primary' && (
                    <div className="absolute top-full left-0 mt-2 z-10 bg-gray-800 p-3 rounded-lg shadow-xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-300">Select Color</span>
                        <button
                          onClick={() => setShowColorPicker(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                      <HexColorPicker
                        color={config.primaryColor}
                        onChange={(color) => setConfig({ ...config, primaryColor: color })}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Secondary Color
                </label>
                <div className="relative">
                  <button
                    className="w-full h-10 rounded-lg border border-gray-700"
                    style={{ backgroundColor: config.secondaryColor }}
                    onClick={() => setShowColorPicker('secondary')}
                  />
                  {showColorPicker === 'secondary' && (
                    <div className="absolute top-full left-0 mt-2 z-10 bg-gray-800 p-3 rounded-lg shadow-xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-300">Select Color</span>
                        <button
                          onClick={() => setShowColorPicker(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                      <HexColorPicker
                        color={config.secondaryColor}
                        onChange={(color) => setConfig({ ...config, secondaryColor: color })}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Background Color
                </label>
                <div className="relative">
                  <button
                    className="w-full h-10 rounded-lg border border-gray-700"
                    style={{ backgroundColor: config.backgroundColor }}
                    onClick={() => setShowColorPicker('background')}
                  />
                  {showColorPicker === 'background' && (
                    <div className="absolute top-full left-0 mt-2 z-10 bg-gray-800 p-3 rounded-lg shadow-xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-300">Select Color</span>
                        <button
                          onClick={() => setShowColorPicker(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                      <HexColorPicker
                        color={config.backgroundColor}
                        onChange={(color) => setConfig({ ...config, backgroundColor: color })}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Connecting Color
                </label>
                <div className="relative">
                  <button
                    className="w-full h-10 rounded-lg border border-gray-700"
                    style={{ backgroundColor: config.connectingColor }}
                    onClick={() => setShowColorPicker('connecting')}
                  />
                  {showColorPicker === 'connecting' && (
                    <div className="absolute top-full left-0 mt-2 z-10 bg-gray-800 p-3 rounded-lg shadow-xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-300">Select Color</span>
                        <button
                          onClick={() => setShowColorPicker(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                      <HexColorPicker
                        color={config.connectingColor}
                        onChange={(color) => setConfig({ ...config, connectingColor: color })}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Active Call Color
                </label>
                <div className="relative">
                  <button
                    className="w-full h-10 rounded-lg border border-gray-700"
                    style={{ backgroundColor: config.activeColor }}
                    onClick={() => setShowColorPicker('active')}
                  />
                  {showColorPicker === 'active' && (
                    <div className="absolute top-full left-0 mt-2 z-10 bg-gray-800 p-3 rounded-lg shadow-xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-300">Select Color</span>
                        <button
                          onClick={() => setShowColorPicker(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                      <HexColorPicker
                        color={config.activeColor}
                        onChange={(color) => setConfig({ ...config, activeColor: color })}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Call Ended Color
                </label>
                <div className="relative">
                  <button
                    className="w-full h-10 rounded-lg border border-gray-700"
                    style={{ backgroundColor: config.endedColor }}
                    onClick={() => setShowColorPicker('ended')}
                  />
                  {showColorPicker === 'ended' && (
                    <div className="absolute top-full left-0 mt-2 z-10 bg-gray-800 p-3 rounded-lg shadow-xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-300">Select Color</span>
                        <button
                          onClick={() => setShowColorPicker(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                      <HexColorPicker
                        color={config.endedColor}
                        onChange={(color) => setConfig({ ...config, endedColor: color })}
                      />
                    </div>
                  )}
                </div>
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
                disabled={config.type === 'animated-center'}
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="center">Center</option>
              </select>
            </div>

            {config.type === 'animated-center' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Size
                  </label>
                  <select
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                    value={config.size}
                    onChange={(e) => setConfig({ ...config, size: e.target.value as any })}
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={config.showParticles}
                      onChange={(e) => setConfig({ ...config, showParticles: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-700"
                    />
                    <span className="text-sm text-gray-200">Show Floating Particles</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={config.showPulse}
                      onChange={(e) => setConfig({ ...config, showPulse: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-700"
                    />
                    <span className="text-sm text-gray-200">Show Pulse Effect</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={config.showBranding}
                      onChange={(e) => setConfig({ ...config, showBranding: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-700"
                    />
                    <span className="text-sm text-gray-200">Show Branding</span>
                  </label>
                </div>
              </>
            )}

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
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Save Widget Design
          </button>
        </div>
      </m.div>
    </div>
  );
};