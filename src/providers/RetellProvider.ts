// Retell provider implementation

import { VoiceProvider, ProviderConfig, CallEndData, TranscriptData } from './types';

declare global {
  interface Window {
    RetellWebClient: any;
  }
}

export class RetellProvider implements VoiceProvider {
  name = 'retell' as const;
  private client: any;
  private currentVolume = 0;
  private isInitialized = false;
  private callStartTime: number = 0;
  private RetellWebClient: any = null;
  private volumeAnimationInterval: NodeJS.Timeout | null = null;
  private speechStartTime: number = 0;
  private speechPhase: 'building' | 'speaking' | 'fading' = 'building';

  constructor(private config: ProviderConfig) {}

  async initialize(): Promise<void> {
    try {
      // Load the Retell SDK dynamically
      const { RetellWebClient } = await import('retell-client-js-sdk');
      this.RetellWebClient = RetellWebClient;

      this.client = new this.RetellWebClient();
      this.setupEventListeners();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Retell provider: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private setupEventListeners(): void {
    if (!this.client) return;
    
    this.client.on('conversationStarted', () => {
  
      this.callStartTime = Date.now();
      this.onCallStart?.();
    });
    
    this.client.on('conversationEnded', (data: any) => {
      const duration = this.callStartTime ? (Date.now() - this.callStartTime) / 1000 : 0;
      this.onCallEnd?.({
        duration,
        success: true,
        reason: data.reason
      });
    });
    
    // Use agent speaking events instead of audio levels for better visualization
    this.client.on('agent_start_talking', () => {
  
      try {
        this.startVolumeAnimation();
      } catch (error) {
        console.error('[RetellProvider] Error starting volume animation:', error);
        // Fallback to simple animation
        this.currentVolume = 0.7;
        this.onVolumeChange?.(0.7);
      }
    });

    this.client.on('agent_stop_talking', () => {
      console.log('[RetellProvider] Agent stopped talking');
      try {
        this.stopVolumeAnimation();
      } catch (error) {
        console.error('[RetellProvider] Error stopping volume animation:', error);
        // Fallback to simple stop
        this.currentVolume = 0.0;
        this.onVolumeChange?.(0.0);
      }
    });

    // Keep audio event for debugging but don't use for volume
    this.client.on('audio', (audio: any) => {
      console.log('[RetellProvider] Raw audio event received:', audio);
    });
    
    this.client.on('update', (update: any) => {
      if (update.transcript) {
        update.transcript.forEach((item: any) => {
          this.onTranscript?.({
            text: item.content,
            role: item.role === 'agent' ? 'assistant' : 'user',
            timestamp: Date.now()
          });
        });
      }
    });
    
    this.client.on('error', (error: any) => {
      this.onError?.(new Error(error.message || 'Retell error'));
    });
    
    this.client.on('connected', () => {
      this.onReady?.();
    });
  }
  
  async startCall(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }

    try {
      // Retell requires a call access token
      const accessToken = this.config.apiKey || this.config.customConfig?.accessToken;
      if (!accessToken) {
        throw new Error('Retell access token required');
      }

      await this.client.startCall({
        accessToken: accessToken,
      });
      console.log('[RetellProvider] Call start request sent');
    } catch (error) {
      console.error('[RetellProvider] Failed to start call:', error);
      this.onError?.(new Error(`Failed to start Retell call: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
  
  async endCall(): Promise<void> {
    this.stopVolumeAnimation();
    if (this.client) {
      this.client.stopCall();
    }
  }
  
  mute(): void {
    if (this.client) {
      this.client.toggleMute(true);
    }
  }
  
  unmute(): void {
    if (this.client) {
      this.client.toggleMute(false);
    }
  }
  
  getVolume(): number {
    return this.currentVolume;
  }
  
  isConnected(): boolean {
    return this.client?.getConnectionState() === 'connected';
  }
  
  isCallActive(): boolean {
    const state = this.client?.getConnectionState();
    return state === 'connected' || state === 'connecting';
  }
  
  destroy(): void {
    if (this.client) {
      this.client.stopConversation();
      this.client = null;
    }
    this.stopVolumeAnimation();
  }

  private startVolumeAnimation(): void {
    try {
      console.log('[RetellProvider] Starting volume animation...');

      // Clear any existing animation
      this.stopVolumeAnimation();

      this.speechStartTime = Date.now();
      this.speechPhase = 'building';

      // Simplified speech-like volume animation
      this.volumeAnimationInterval = setInterval(() => {
        try {
          const elapsed = Date.now() - this.speechStartTime;
          let volume = 0;

          if (this.speechPhase === 'building') {
            // Build up phase (0-200ms): smooth ramp up
            const buildProgress = Math.min(elapsed / 200, 1);
            volume = buildProgress * 0.6;

            if (buildProgress >= 1) {
              this.speechPhase = 'speaking';
            }
          } else if (this.speechPhase === 'speaking') {
            // Speaking phase: simple pulsing pattern
            const speakingTime = elapsed - 200;

            // Simple sine wave with some variation
            const pulse = Math.sin(speakingTime * 0.008) * 0.2 + 0.6;
            const variation = Math.sin(speakingTime * 0.003) * 0.1;

            volume = Math.max(0.4, Math.min(0.8, pulse + variation));
          }

          this.currentVolume = volume;
    
          this.onVolumeChange?.(volume);
        } catch (innerError) {
          console.error('[RetellProvider] Error in animation interval:', innerError);
        }
      }, 50); // 20fps for stability

      console.log('[RetellProvider] Volume animation started successfully');
    } catch (error) {
      console.error('[RetellProvider] Failed to start volume animation:', error);
      throw error;
    }
  }

  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  private stopVolumeAnimation(): void {
    try {
      console.log('[RetellProvider] Stopping volume animation...');

      if (this.volumeAnimationInterval) {
        clearInterval(this.volumeAnimationInterval);
        this.volumeAnimationInterval = null;
      }

      // Simple fade to 0
      this.currentVolume = 0.0;
      this.onVolumeChange?.(0.0);

      console.log('[RetellProvider] Volume animation stopped');
    } catch (error) {
      console.error('[RetellProvider] Error stopping volume animation:', error);
      throw error;
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
