// Unified voice provider hook for embeddable widgets

import { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceProvider, ProviderConfig, ProviderName, CallEndData, TranscriptData } from '@/providers/types';

interface UseUnifiedVoiceProviderProps {
  providerName: ProviderName;
  config: ProviderConfig;
  autoInitialize?: boolean;
  previewMode?: boolean;
  // Real functionality props
  publicKey?: string;
  accessToken?: string;
  onCallStart?: () => void;
  onCallEnd?: (data: CallEndData) => void;
  onError?: (error: Error) => void;
}

interface UseUnifiedVoiceProviderReturn {
  provider: VoiceProvider | null;
  isLoading: boolean;
  isInitialized: boolean;
  isConnected: boolean;
  isCallActive: boolean;
  volume: number;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  startCall: () => Promise<void>;
  endCall: () => Promise<void>;
  mute: () => void;
  unmute: () => void;
  
  // Event data
  transcripts: TranscriptData[];
  callData: CallEndData | null;
}

export function useUnifiedVoiceProvider({
  providerName,
  config,
  autoInitialize = true,
  previewMode = false,
  publicKey,
  accessToken,
  onCallStart,
  onCallEnd,
  onError
}: UseUnifiedVoiceProviderProps): UseUnifiedVoiceProviderReturn {
  console.log('[useUnifiedVoiceProvider] Hook called with:', {
    providerName,
    config,
    previewMode,
    publicKey: publicKey ? 'present' : 'missing',
    accessToken: accessToken ? 'present' : 'missing'
  });
  const [provider, setProvider] = useState<VoiceProvider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptData[]>([]);
  const [callData, setCallData] = useState<CallEndData | null>(null);
  
  const providerRef = useRef<VoiceProvider | null>(null);
  const statusCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const mockVolumeInterval = useRef<NodeJS.Timeout | null>(null);
  const realProviderInstance = useRef<any>(null);

  // SDK loading is handled by dynamic imports in each provider

  // Initialize real provider instances
  const initializeRealProvider = useCallback(async () => {
    console.log('[useUnifiedVoiceProvider] initializeRealProvider called', {
      providerName,
      publicKey: publicKey ? 'present' : 'missing',
      accessToken: accessToken ? 'present' : 'missing'
    });

    // Check for required credentials based on provider type
    if (providerName === 'vapi' && !publicKey) {
      const error = 'Public key required for VAPI';
      console.error('[useUnifiedVoiceProvider]', error);
      throw new Error(error);
    }
    if ((providerName === 'retell' || providerName === 'ultravox') && !accessToken) {
      const error = `Access token required for ${providerName}`;
      console.error('[useUnifiedVoiceProvider]', error);
      throw new Error(error);
    }
    if (providerName === 'elevenlabs' && !accessToken) {
      const error = 'Access token required for ElevenLabs';
      console.error('[useUnifiedVoiceProvider]', error);
      throw new Error(error);
    }
    if (!publicKey && !accessToken) {
      const error = 'Public key or access token required for real functionality';
      console.error('[useUnifiedVoiceProvider]', error);
      throw new Error(error);
    }

    // Create provider instance directly with dynamic imports
    const providerConfig: ProviderConfig = {
      agentId: config.agentId,
      apiKey: (providerName === 'vapi' ? publicKey : accessToken) || '',
      customConfig: providerName === 'ultravox' ? { ...config, joinUrl: accessToken } :
                   providerName === 'elevenlabs' ? { ...config, signedUrl: accessToken } :
                   config
    };

    let instance: VoiceProvider;

    // Create provider instance based on provider name
    switch (providerName) {
      case 'vapi': {
        const { VapiProvider } = await import('@/providers/VapiProvider');
        instance = new VapiProvider(providerConfig);
        break;
      }
      case 'retell': {
        const { RetellProvider } = await import('@/providers/RetellProvider');
        instance = new RetellProvider(providerConfig);
        break;
      }
      case 'ultravox': {
        const { UltravoxProvider } = await import('@/providers/UltravoxProvider');
        instance = new UltravoxProvider(providerConfig);
        break;
      }
      case 'knova': {
        const { KnovaProvider } = await import('@/providers/KnovaProvider');
        instance = new KnovaProvider(providerConfig);
        break;
      }
      case 'elevenlabs': {
        const { ElevenLabsProvider } = await import('@/providers/ElevenLabsProvider');
        instance = new ElevenLabsProvider(providerConfig);
        break;
      }
      default:
        throw new Error(`Unsupported provider: ${providerName}`);
    }

    // Set up common event handlers for all providers
    instance.onCallStart = () => {
      setIsCallActive(true);
      onCallStart?.();
    };

    instance.onCallEnd = (data: any) => {
      setIsCallActive(false);
      const callEndData: CallEndData = {
        duration: data.duration || 0,
        success: data.reason !== 'error',
        reason: data.reason || 'ended',
        cost: data.cost
      };
      setCallData(callEndData);
      onCallEnd?.(callEndData);
    };

    instance.onVolumeChange = (volume: number) => {
      console.log(`[useUnifiedVoiceProvider] ${providerName} Volume received:`, volume);
      setVolume(volume);
    };

    instance.onTranscript = (transcript: TranscriptData) => {
      setTranscripts(prev => [...prev, transcript]);
    };

    instance.onError = (error: Error) => {
      setError(error.message);
      onError?.(error);
    };

    await instance.initialize(providerConfig);



    realProviderInstance.current = instance;
    setIsInitialized(true);
    setIsConnected(true);

    return instance;
  }, [providerName, publicKey, accessToken, onCallStart, onCallEnd, onError, config]);

  // Initialize provider
  const initialize = useCallback(async () => {
    console.log('[useUnifiedVoiceProvider] initialize called', {
      isLoading,
      isInitialized,
      previewMode,
      providerName,
      publicKey: publicKey ? 'present' : 'missing',
      accessToken: accessToken ? 'present' : 'missing'
    });

    if (isLoading || isInitialized) {
      console.log('[useUnifiedVoiceProvider] Skipping initialization - already loading or initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // In preview mode, use mock provider
      if (previewMode) {
        console.log('[useUnifiedVoiceProvider] Using preview mode');
        setIsInitialized(true);
        setIsConnected(true);
        return;
      }

      // For real functionality, initialize real provider
      console.log('[useUnifiedVoiceProvider] Initializing real provider...');
      await initializeRealProvider();
      console.log('[useUnifiedVoiceProvider] Real provider initialized successfully');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize provider';
      console.error('[useUnifiedVoiceProvider] Initialization error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isInitialized, previewMode, initializeRealProvider]);
  
  // Start call
  const startCall = useCallback(async () => {
    if (previewMode) {
      setIsCallActive(true);
      setTranscripts([]);

      // Simulate volume changes for preview
      mockVolumeInterval.current = setInterval(() => {
        const mockVolume = Math.random() * 0.8 + 0.1; // Random volume between 0.1 and 0.9
        setVolume(mockVolume);
      }, 200);

      // Add some mock transcripts
      setTimeout(() => {
        setTranscripts([
          { text: "Hello! How can I help you today?", role: 'assistant', timestamp: Date.now() }
        ]);
      }, 1000);

      return;
    }

    if (!realProviderInstance.current || !isInitialized) {
      const error = 'Provider not initialized';
      console.error('[useUnifiedVoiceProvider]', error);
      throw new Error(error);
    }

    setError(null);
    setTranscripts([]);

    try {
      const instance = realProviderInstance.current;

      switch (providerName) {
        case 'vapi':
          await instance.startCall();
          break;
        case 'retell':
          await instance.startCall();
          break;
        case 'ultravox':
          await instance.startCall();
          break;
        case 'elevenlabs':
          await instance.startCall();
          break;
        case 'knova':
          await instance.startCall();
          break;
        default:
          throw new Error(`Start call not implemented for ${providerName}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start call');
      throw err;
    }
  }, [isInitialized, previewMode, providerName, config.agentId, accessToken]);
  
  // End call
  const endCall = useCallback(async () => {
    if (previewMode) {
      setIsCallActive(false);
      setVolume(0);
      if (mockVolumeInterval.current) {
        clearInterval(mockVolumeInterval.current);
        mockVolumeInterval.current = null;
      }
      return;
    }

    if (!realProviderInstance.current) return;

    try {
      const instance = realProviderInstance.current;

      switch (providerName) {
        case 'vapi':
          await instance.endCall();
          break;
        case 'retell':
          await instance.endCall();
          break;
        case 'ultravox':
          await instance.endCall();
          break;
        default:
          // Generic fallback
          if (instance.endCall) await instance.endCall();
          else if (instance.stop) instance.stop();
          else if (instance.stopCall) instance.stopCall();
          else if (instance.leaveCall) instance.leaveCall();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end call');
    }
  }, [previewMode, providerName]);

  // Mute
  const mute = useCallback(() => {
    if (previewMode) return;

    if (realProviderInstance.current) {
      const instance = realProviderInstance.current;

      switch (providerName) {
        case 'vapi':
          instance.setMuted?.(true);
          break;
        case 'retell':
          // Retell doesn't have direct mute API in web client
          break;
        case 'ultravox':
          instance.setMicMuted?.(true);
          break;
      }
    }
  }, [previewMode, providerName]);

  // Unmute
  const unmute = useCallback(() => {
    if (previewMode) return;

    if (realProviderInstance.current) {
      const instance = realProviderInstance.current;

      switch (providerName) {
        case 'vapi':
          instance.setMuted?.(false);
          break;
        case 'retell':
          // Retell doesn't have direct mute API in web client
          break;
        case 'ultravox':
          instance.setMicMuted?.(false);
          break;
      }
    }
  }, [previewMode, providerName]);
  
  // Auto-initialize on mount or when credentials change
  useEffect(() => {
    if (autoInitialize && !isInitialized && !isLoading) {
      initialize();
    }
  }, [autoInitialize, isInitialized, isLoading, initialize]);

  // Reinitialize when switching between preview and test mode or when credentials change
  useEffect(() => {
    if (isInitialized) {
      setIsInitialized(false);
      setProvider(null);
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      if (realProviderInstance.current) {
        realProviderInstance.current = null;
      }
      // Reinitialize with new mode/credentials
      if (autoInitialize) {
        const timeoutId = setTimeout(() => initialize(), 100);
        // Store timeout ID for cleanup
        return () => clearTimeout(timeoutId);
      }
    }
  }, [previewMode, publicKey, accessToken]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }

      if (mockVolumeInterval.current) {
        clearInterval(mockVolumeInterval.current);
      }

      if (providerRef.current) {
        providerRef.current.destroy();
      }

      if (realProviderInstance.current) {
        try {
          const instance = realProviderInstance.current;
          switch (providerName) {
            case 'vapi':
              instance.stop?.();
              break;
            case 'retell':
              instance.stopCall?.();
              break;
            case 'ultravox':
              instance.leaveCall?.();
              break;
            case 'elevenlabs':
              instance.endCall?.();
              break;
            case 'knova':
              instance.endCall?.();
              break;
          }
        } catch (error) {
          console.error('Error cleaning up real provider:', error);
        }
      }
    };
  }, [providerName]);

  // Update provider when config changes
  useEffect(() => {
    if (isInitialized) {
      // Reinitialize with new config
      setIsInitialized(false);
      setProvider(null);
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      if (realProviderInstance.current) {
        realProviderInstance.current = null;
      }
    }
  }, [providerName, JSON.stringify(config)]);
  
  return {
    provider,
    isLoading,
    isInitialized,
    isConnected,
    isCallActive,
    volume,
    error,
    initialize,
    startCall,
    endCall,
    mute,
    unmute,
    transcripts,
    callData
  };
}
