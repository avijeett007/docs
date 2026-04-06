// Knova provider implementation (using LiveKit)

import { VoiceProvider, ProviderConfig, CallEndData, TranscriptData } from './types';

declare global {
  interface Window {
    LiveKit: any;
  }
}

export class KnovaProvider implements VoiceProvider {
  name = 'knova' as const;
  private room: any;
  private audioTrack: any;
  private currentVolume = 0;
  private isInitialized = false;
  private callStartTime: number = 0;
  
  constructor(private config: ProviderConfig) {}
  
  async initialize(): Promise<void> {
    if (!window.LiveKit) {
      throw new Error('LiveKit SDK not loaded');
    }
    
    this.isInitialized = true;
  }
  
  private setupEventListeners(): void {
    if (!this.room) return;
    
    this.room.on('connected', () => {
      this.callStartTime = Date.now();
      this.onReady?.();
      this.onCallStart?.();
    });
    
    this.room.on('disconnected', () => {
      const duration = this.callStartTime ? (Date.now() - this.callStartTime) / 1000 : 0;
      this.onCallEnd?.({
        duration,
        success: true
      });
    });
    
    this.room.on('trackSubscribed', (track: any, publication: any, participant: any) => {
      if (track.kind === 'audio') {
        // Handle audio track for volume monitoring
        track.on('audioLevel', (level: number) => {
          this.currentVolume = level;
          this.onVolumeChange?.(level);
        });
      }
    });
    
    this.room.on('dataReceived', (payload: any, participant: any) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === 'transcript') {
          this.onTranscript?.({
            text: data.text,
            role: data.role || 'assistant',
            timestamp: Date.now()
          });
        }
      } catch (error) {
        // Ignore non-JSON data
      }
    });
    
    this.room.on('error', (error: any) => {
      this.onError?.(new Error(error.message || 'LiveKit error'));
    });
  }
  
  async startCall(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }
    
    try {
      const wsUrl = this.config.customConfig?.wsUrl;
      const accessToken = this.config.customConfig?.accessToken;
      
      if (!wsUrl || !accessToken) {
        throw new Error('LiveKit WebSocket URL and access token required');
      }
      
      this.room = new window.LiveKit.Room();
      this.setupEventListeners();
      
      await this.room.connect(wsUrl, accessToken);
      
      // Enable microphone
      this.audioTrack = await window.LiveKit.createLocalAudioTrack();
      await this.room.localParticipant.publishTrack(this.audioTrack);
      
    } catch (error) {
      this.onError?.(new Error(`Failed to start Knova call: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
  
  async endCall(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
    }
  }
  
  mute(): void {
    if (this.room && this.audioTrack) {
      this.audioTrack.mute();
    }
  }
  
  unmute(): void {
    if (this.room && this.audioTrack) {
      this.audioTrack.unmute();
    }
  }
  
  getVolume(): number {
    return this.currentVolume;
  }
  
  isConnected(): boolean {
    return this.room?.state === 'connected';
  }
  
  isCallActive(): boolean {
    return this.room?.state === 'connected';
  }
  
  destroy(): void {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
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
