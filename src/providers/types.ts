// Provider abstraction types for embeddable widgets

export type ProviderName = 'vapi' | 'retell' | 'ultravox' | 'knova' | 'elevenlabs';

export interface ProviderConfig {
  agentId: string;
  apiKey?: string;
  customConfig?: Record<string, any>;
}

export interface CallEndData {
  duration: number;
  success: boolean;
  reason?: string;
  cost?: number;
}

export interface TranscriptData {
  text: string;
  role: 'user' | 'assistant';
  timestamp: number;
}

export interface VoiceProvider {
  name: ProviderName;
  initialize(config: ProviderConfig): Promise<void>;
  startCall(): Promise<void>;
  endCall(): Promise<void>;
  mute(): void;
  unmute(): void;
  getVolume(): number;
  isConnected(): boolean;
  isCallActive(): boolean;
  destroy(): void;
  
  // Event handlers
  onReady?: () => void;
  onCallStart?: () => void;
  onCallEnd?: (data: CallEndData) => void;
  onVolumeChange?: (volume: number) => void;
  onTranscript?: (transcript: TranscriptData) => void;
  onError?: (error: Error) => void;
}

export interface ProviderSDKUrls {
  vapi: string;
  retell: string;
  ultravox: string;
  knova: string;
  elevenlabs: string;
}

export interface ProviderGlobalChecks {
  vapi: () => boolean;
  retell: () => boolean;
  ultravox: () => boolean;
  knova: () => boolean;
  elevenlabs: () => boolean;
}

// Widget configuration types
export type WidgetType = 'siri' | 'orb' | 'floaty' | 'minimal' | 'radial' | 'glob' | 'outbound';

export interface WidgetConfig {
  widgetType: WidgetType;
  agentType: ProviderName;
  agentId: string;
  providerConfig: ProviderConfig;
  customization: {
    appearance: {
      primaryColor: string;
      secondaryColor: string;
      backgroundColor: string;
      textColor: string;
      borderRadius: number;
    };
    behavior: {
      position: string;
      size: string;
      autoStart: boolean;
      showBranding: boolean;
      showTranscript: boolean;
      showInteractionHints: boolean;
    };
    messages: {
      welcomeMessage: string;
      buttonText: string;
      endCallText: string;
      interactionHint: string;
    };
    branding: {
      enabled: boolean;
      text: string;
      url?: string;
      position: 'bottom-left' | 'bottom-right' | 'bottom-center' | 'top-left' | 'top-right' | 'top-center';
      fontSize: number;
      opacity: number;
    };
  };
  security: {
    widgetToken: string;
    allowedDomains: string[];
  };
}
