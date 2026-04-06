export interface WidgetConfig {
  id: string;
  agentId: string;
  userId: string;
  type: 'microphone' | 'text' | 'video' | 'animated-center';
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  connectingColor: string;
  activeColor: string;
  endedColor: string;
  position: 'bottom-right' | 'bottom-left' | 'center';
  welcomeMessage: string;
  buttonText: string;
  size: 'small' | 'medium' | 'large';
  showParticles: boolean;
  showPulse: boolean;
  showBranding: boolean;
  showTranscript: boolean;
  showAvatar: boolean;
  showName: boolean;
  callStatus?: 'idle' | 'connecting' | 'active' | 'ended';
  embedCode?: string;
}
