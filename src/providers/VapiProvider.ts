// VAPI provider implementation

import { VoiceProvider, ProviderConfig, CallEndData, TranscriptData } from './types';

declare global {
  interface Window {
    Vapi: any;
  }
}

export class VapiProvider implements VoiceProvider {
  name = 'vapi' as const;
  private vapi: any;
  private currentVolume = 0;
  private isInitialized = false;
  private callStartTime: number = 0;
  private VapiSDK: any = null;

  constructor(private config: ProviderConfig) {}

  async initialize(): Promise<void> {
    try {
      console.log('[VapiProvider] Initializing with config:', this.config);
      // Load the VAPI SDK dynamically
      const { default: Vapi } = await import('@vapi-ai/web');
      this.VapiSDK = Vapi;

      // For VAPI, the apiKey field actually contains the publicKey
      const publicKey = this.config.apiKey || '';
      console.log('[VapiProvider] Initializing VAPI with public key:', publicKey.substring(0, 8) + '...');
      this.vapi = new this.VapiSDK(publicKey);
      console.log('[VapiProvider] VAPI instance created successfully');
      this.setupEventListeners();
      this.isInitialized = true;
      console.log('[VapiProvider] Initialization complete');
    } catch (error) {
      console.error('[VapiProvider] Initialization failed:', error);
      throw new Error(`Failed to initialize VAPI provider: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private setupEventListeners(): void {
    if (!this.vapi) return;
    
    this.vapi.on('call-start', () => {
      this.callStartTime = Date.now();
      this.onCallStart?.();
    });
    
    this.vapi.on('call-end', (data: any) => {
      const duration = this.callStartTime ? (Date.now() - this.callStartTime) / 1000 : 0;
      this.onCallEnd?.({
        duration,
        success: data.endedReason !== 'error',
        reason: data.endedReason,
        cost: data.cost
      });
    });
    
    // Use speech events for better agent speaking detection
    this.vapi.on('speech-start', () => {
      console.log('[VapiProvider] Assistant speech started');
      this.currentVolume = 0.8; // Set high volume when assistant is speaking
      this.onVolumeChange?.(0.8);
    });

    this.vapi.on('speech-end', () => {
      console.log('[VapiProvider] Assistant speech ended');
      this.currentVolume = 0.0; // Set low volume when assistant stops
      this.onVolumeChange?.(0.0);
    });

    // Keep volume-level for debugging but use speech events for animation
    this.vapi.on('volume-level', (volume: number) => {
      console.log('[VapiProvider] Raw volume event received:', volume);
      // Don't use this for animation, use speech events instead
    });
    
    this.vapi.on('message', (message: any) => {
      if (message.type === 'transcript') {
        this.onTranscript?.({
          text: message.transcript,
          role: message.role,
          timestamp: Date.now()
        });
      }
    });
    
    this.vapi.on('error', (error: any) => {
      this.onError?.(new Error(error.message || 'VAPI error'));
    });
    
    this.vapi.on('speech-start', () => {
      // User started speaking
    });
    
    this.vapi.on('speech-end', () => {
      // User stopped speaking
    });
  }
  
  async startCall(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }

    try {
      console.log('[VapiProvider] Starting call with agent ID:', this.config.agentId);
      console.log('[VapiProvider] Full config:', this.config);

      // Use the direct agentId format (matches working VapiTestModal pattern)
      await this.vapi.start(this.config.agentId);
      console.log('[VapiProvider] Call started successfully');
    } catch (error) {
      console.error('[VapiProvider] Failed to start call:', error);
      this.onError?.(new Error(`Failed to start VAPI call: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
  
  async endCall(): Promise<void> {
    if (this.vapi) {
      this.vapi.stop();
    }
  }
  
  mute(): void {
    if (this.vapi) {
      this.vapi.setMuted(true);
    }
  }
  
  unmute(): void {
    if (this.vapi) {
      this.vapi.setMuted(false);
    }
  }
  
  getVolume(): number {
    return this.currentVolume;
  }
  
  isConnected(): boolean {
    return this.vapi?.getCallStatus() === 'connected';
  }
  
  isCallActive(): boolean {
    const status = this.vapi?.getCallStatus();
    return status === 'connected' || status === 'connecting';
  }
  
  destroy(): void {
    if (this.vapi) {
      this.vapi.stop();
      this.vapi = null;
    }
  }
  
  // Event handlers
  onReady?: () => void;
  onCallStart?: () => void;
  onCallEnd?: (data: CallEndData) => void;
  onVolumeChange?: (volume: number) => void;
  onTranscript?: (transcript: TranscriptData) => void;
  onError?: (error: Error) => void;
}
