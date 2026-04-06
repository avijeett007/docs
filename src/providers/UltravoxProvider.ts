// Ultravox provider implementation

import { VoiceProvider, ProviderConfig, CallEndData, TranscriptData } from './types';

declare global {
  interface Window {
    UltravoxSession: any;
  }
}

export class UltravoxProvider implements VoiceProvider {
  name = 'ultravox' as const;
  private session: any;
  private currentVolume = 0;
  private isInitialized = false;
  private callStartTime: number = 0;
  private UltravoxSession: any = null;

  constructor(private config: ProviderConfig) {}

  async initialize(): Promise<void> {
    try {
      // Load the Ultravox SDK dynamically
      const { UltravoxSession } = await import('ultravox-client');
      this.UltravoxSession = UltravoxSession;

      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Ultravox provider: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private setupEventListeners(): void {
    if (!this.session) return;
    
    this.session.addEventListener('status', (event: any) => {
      const status = event.target.status;
      
      if (status === 'connected') {
        this.callStartTime = Date.now();
        this.onReady?.();
        this.onCallStart?.();
      } else if (status === 'disconnected') {
        const duration = this.callStartTime ? (Date.now() - this.callStartTime) / 1000 : 0;
        this.onCallEnd?.({
          duration,
          success: true
        });
      }
    });
    
    this.session.addEventListener('transcripts', (event: any) => {
      const transcripts = event.target.transcripts;
      transcripts.forEach((transcript: any) => {
        const role = transcript.speaker === 'user' ? 'user' : 'assistant';

        // Use transcript events to detect agent speaking for visualization
        if (role === 'assistant' && transcript.text && transcript.text.trim()) {
          console.log('[UltravoxProvider] Agent speaking detected from transcript');
          this.currentVolume = 0.8; // Set high volume when agent is speaking
          this.onVolumeChange?.(0.8);

          // Reset volume after a delay (simulating speech end)
          setTimeout(() => {
            console.log('[UltravoxProvider] Agent speaking ended (timeout)');
            this.currentVolume = 0.0;
            this.onVolumeChange?.(0.0);
          }, transcript.text.length * 50); // Rough estimate based on text length
        }

        this.onTranscript?.({
          text: transcript.text,
          role,
          timestamp: Date.now()
        });
      });
    });
    
    this.session.addEventListener('error', (event: any) => {
      this.onError?.(new Error(event.target.error || 'Ultravox error'));
    });
    
    // Keep audio event for debugging but use transcript-based detection for animation
    this.session.addEventListener('audio', (event: any) => {
      console.log('[UltravoxProvider] Raw audio event received:', event);
      // Don't use this for animation, use transcript events instead
    });
  }
  
  async startCall(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }
    
    try {
      // Ultravox requires a join URL
      const joinUrl = this.config.customConfig?.joinUrl;
      if (!joinUrl) {
        throw new Error('Ultravox join URL required');
      }
      
      this.session = new this.UltravoxSession();
      this.setupEventListeners();
      
      await this.session.joinCall(joinUrl);
    } catch (error) {
      this.onError?.(new Error(`Failed to start Ultravox call: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
  
  async endCall(): Promise<void> {
    if (this.session) {
      await this.session.leaveCall();
    }
  }
  
  mute(): void {
    if (this.session) {
      this.session.setMicMuted(true);
    }
  }
  
  unmute(): void {
    if (this.session) {
      this.session.setMicMuted(false);
    }
  }
  
  getVolume(): number {
    return this.currentVolume;
  }
  
  isConnected(): boolean {
    return this.session?.getStatus() === 'connected';
  }
  
  isCallActive(): boolean {
    return this.session?.getStatus() === 'connected';
  }
  
  destroy(): void {
    if (this.session) {
      this.session.leaveCall();
      this.session = null;
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
