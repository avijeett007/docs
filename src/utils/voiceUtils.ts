import { ParsedVoiceFileName, VoiceProvider, VoiceSex } from "@/types/voice";

export function parseVoiceFileName(fileName: string): ParsedVoiceFileName | null {
  // Remove file extension
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");

  // Expected format: provider-name-type-sex or provider-name-language-type-sex
  const parts = nameWithoutExt.split('-');
  if (parts.length < 4) return null;

  let provider: string;
  let name: string;
  let voiceType: string;
  let sex: string;

  if (parts.length === 4) {
    // Format: provider-name-type-sex
    [provider, name, voiceType, sex] = parts;
  } else if (parts.length === 5) {
    // Format: provider-name-language-type-sex (e.g., cartesia-mila-spanish-female)
    [provider, name, , voiceType, sex] = parts; // Skip the language part
  } else {
    // For more than 5 parts, take first as provider, last as sex, second-to-last as type, and combine middle parts as name
    provider = parts[0];
    sex = parts[parts.length - 1];
    voiceType = parts[parts.length - 2];
    name = parts.slice(1, parts.length - 2).join('-');
  }

  // Validate provider
  if (!isValidProvider(provider)) return null;

  // Validate sex
  if (!isValidSex(sex)) return null;

  return {
    provider: provider as VoiceProvider,
    name,
    voiceType,
    sex: sex as VoiceSex
  };
}

function isValidProvider(provider: string): provider is VoiceProvider {
  return ['deepgram', 'openai', 'elevenlabs', 'azure', 'cartesia', 'grok'].includes(provider);
}

function isValidSex(sex: string): sex is VoiceSex {
  return ['male', 'female', 'neutral'].includes(sex);
}

export function generateVoiceDisplayName(name: string, voiceType: string): string {
  return `${name} (${voiceType})`.replace(/_/g, ' ');
}

export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9-_.]/g, '_').toLowerCase();
}
