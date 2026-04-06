// ElevenLabs provider implementation (placeholder - coming soon)

import { VoiceProvider, ProviderConfig, CallEndData, TranscriptData } from './types';

declare global {
  interface Window {
    Conversation: any;
  }
}

export class ElevenLabsProvider implements VoiceProvider {
  name = 'elevenlabs' as const;
  private conversation: any;
  private currentVolume = 0;
  private isInitialized = false;
  private callStartTime: number = 0;
  
  constructor(private config: ProviderConfig) {}
  
  async initialize(): Promise<void> {
    try {
      console.log('[ElevenLabsProvider] Initializing with config:', this.config);

      // Load the real ElevenLabs SDK dynamically (like the working test modal)
      console.log('[ElevenLabsProvider] Loading ElevenLabs SDK...');

      // ElevenLabs uses a different initialization pattern
      // They require either a signed URL or agent ID + connection type
      this.isInitialized = true;
      console.log('[ElevenLabsProvider] Initialization complete');
    } catch (error) {
      console.error('[ElevenLabsProvider] Initialization failed:', error);
      throw new Error(`Failed to initialize ElevenLabs provider: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private setupEventListeners(): void {
    if (!this.conversation) return;
    
    // Note: ElevenLabs SDK event system is still being documented
    // This is a placeholder implementation based on expected patterns
    
    // Volume monitoring (if available)
    if (this.conversation.onVolumeChange) {
      this.conversation.onVolumeChange((volume: number) => {
        this.currentVolume = volume;
        this.onVolumeChange?.(volume);
      });
    }
    
    // Connection status monitoring
    if (this.conversation.onStatusChange) {
      this.conversation.onStatusChange((status: string) => {
        if (status === 'connected') {
          this.onReady?.();
        } else if (status === 'disconnected') {
          const duration = this.callStartTime ? (Date.now() - this.callStartTime) / 1000 : 0;
          this.onCallEnd?.({
            duration,
            success: true
          });
        }
      });
    }
    
    // Transcript handling (if available)
    if (this.conversation.onTranscript) {
      this.conversation.onTranscript((transcript: any) => {
        this.onTranscript?.({
          text: transcript.text || transcript.message,
          role: transcript.role || 'assistant',
          timestamp: Date.now()
        });
      });
    }
    
    // Error handling
    if (this.conversation.onError) {
      this.conversation.onError((error: any) => {
        this.onError?.(new Error(error.message || 'ElevenLabs conversation error'));
      });
    }
  }
  
  async startCall(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }

    try {
      console.log('[ElevenLabsProvider] Starting call with agent ID:', this.config.agentId);
      console.log('[ElevenLabsProvider] Full config:', this.config);

      this.callStartTime = Date.now();

      // Load the real ElevenLabs SDK (like the working test modal)
      const { Conversation } = await import('@elevenlabs/client');

      // Method 1: Using agent ID (for public agents)
      if (this.config.agentId && !this.config.customConfig?.signedUrl) {
        console.log('[ElevenLabsProvider] Starting session with agent ID');
        this.conversation = await Conversation.startSession({
          agentId: this.config.agentId,
          connectionType: this.config.customConfig?.connectionType || 'webrtc', // 'webrtc' or 'websocket'
          userId: this.config.customConfig?.userId || 'anonymous',
          // Add event handlers like the working test modal
          onConnect: () => {
            console.log('[ElevenLabsProvider] Connected');
            this.onCallStart?.();
          },
          onDisconnect: () => {
            console.log('[ElevenLabsProvider] Disconnected');
            this.onCallEnd?.({
              duration: this.callStartTime ? (Date.now() - this.callStartTime) / 1000 : 0,
              success: true,
              reason: 'ended'
            });
          },
          onMessage: (message: any) => {
            console.log('[ElevenLabsProvider] Message:', message);
            if (message.type === 'agent_response') {
              this.onTranscript?.({
                text: message.message,
                role: 'assistant',
                timestamp: Date.now()
              });
            } else if (message.type === 'user_transcript') {
              this.onTranscript?.({
                text: message.message,
                role: 'user',
                timestamp: Date.now()
              });
            }
          },
          onModeChange: ({ mode }: { mode: string }) => {
            console.log('[ElevenLabsProvider] Mode change:', mode);
            // Use mode change for volume animation like the working test modal
            if (mode === 'speaking') {
              this.currentVolume = 0.8;
              this.onVolumeChange?.(0.8);
            } else {
              this.currentVolume = 0.0;
              this.onVolumeChange?.(0.0);
            }
          },
          onError: (error: any) => {
            console.error('[ElevenLabsProvider] Error:', error);
            this.onError?.(new Error(error.message || 'ElevenLabs conversation error'));
          }
        });
      }
      // Method 2: Using signed URL (for private agents)
      else if (this.config.customConfig?.signedUrl) {
        console.log('[ElevenLabsProvider] Starting session with signed URL');
        this.conversation = await Conversation.startSession({
          signedUrl: this.config.customConfig.signedUrl,
          connectionType: this.config.customConfig?.connectionType || 'websocket',
          // Add same event handlers for signed URL method
          onConnect: () => {
            console.log('[ElevenLabsProvider] Connected');
            this.onCallStart?.();
          },
          onDisconnect: () => {
            console.log('[ElevenLabsProvider] Disconnected');
            this.onCallEnd?.({
              duration: this.callStartTime ? (Date.now() - this.callStartTime) / 1000 : 0,
              success: true,
              reason: 'ended'
            });
          },
          onMessage: (message: any) => {
            console.log('[ElevenLabsProvider] Message:', message);
            if (message.type === 'agent_response') {
              this.onTranscript?.({
                text: message.message,
                role: 'assistant',
                timestamp: Date.now()
              });
            } else if (message.type === 'user_transcript') {
              this.onTranscript?.({
                text: message.message,
                role: 'user',
                timestamp: Date.now()
              });
            }
          },
          onModeChange: ({ mode }: { mode: string }) => {
            console.log('[ElevenLabsProvider] Mode change:', mode);
            // Use mode change for volume animation
            if (mode === 'speaking') {
              this.currentVolume = 0.8;
              this.onVolumeChange?.(0.8);
            } else {
              this.currentVolume = 0.0;
              this.onVolumeChange?.(0.0);
            }
          },
          onError: (error: any) => {
            console.error('[ElevenLabsProvider] Error:', error);
            this.onError?.(new Error(error.message || 'ElevenLabs conversation error'));
          }
        });
      }
      else {
        throw new Error('ElevenLabs requires either agentId or signedUrl');
      }
      
      this.setupEventListeners();
      this.onCallStart?.();
      
    } catch (error) {
      this.onError?.(new Error(`Failed to start ElevenLabs conversation: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
  
  async endCall(): Promise<void> {
    if (this.conversation) {
      try {
        await this.conversation.endSession();
      } catch (error) {
        console.warn('Error ending ElevenLabs conversation:', error);
      }
    }
  }
  
  mute(): void {
    if (this.conversation) {
      console.log('[ElevenLabsProvider] Muting microphone');
      this.conversation.setMicMuted(true);
    }
  }

  unmute(): void {
    if (this.conversation) {
      console.log('[ElevenLabsProvider] Unmuting microphone');
      this.conversation.setMicMuted(false);
    }
  }
  
  getVolume(): number {
    return this.currentVolume;
  }
  
  isConnected(): boolean {
    // Check connection status (when available)
    return this.conversation?.getStatus?.() === 'connected' || false;
  }
  
  isCallActive(): boolean {
    return this.conversation?.getStatus?.() === 'connected' || false;
  }
  
  destroy(): void {
    if (this.conversation) {
      this.conversation.endSession?.();
      this.conversation = null;
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
