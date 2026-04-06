export type VoiceProvider = 'deepgram' | 'openai' | 'elevenlabs' | 'azure' | 'cartesia' | 'grok';
export type VoiceSex = 'male' | 'female' | 'neutral';

export interface Voice {
  id: string;
  name: string;
  displayName: string;
  sex: VoiceSex;
  voiceType: string;
  provider: VoiceProvider;
  voiceModelId?: string; // Provider-specific voice ID (e.g., Cartesia UUID)
  sampleUrl?: string;
  language: string; // Primary language for backward compatibility
  languageCapabilities?: string[]; // Supported languages array
  useCases?: string[]; // Recommended use cases for this voice
  accent?: string;
  ageRange?: string;
  description?: string;
  tags?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VoiceUploadResponse {
  success: boolean;
  voice: Voice;
  sampleUrl?: string;
  error?: string;
}

export interface VoiceListResponse {
  voices: Voice[];
  total: number;
}

export interface ParsedVoiceFileName {
  provider: VoiceProvider;
  name: string;
  voiceType: string;
  sex: VoiceSex;
}
