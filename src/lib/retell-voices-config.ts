// Curated list of Retell voices without branding in preview audio
// These voices are approved for use in whitelabel SaaS mode

export const APPROVED_RETELL_VOICES = {
  female: [
    'Allie',
    'Chloe',
    'Elena', // Spanish
    'Emma', // French
    'Eva', // German
    'Evie',
    'Florence',
    'Isabel', // Spanish
    'Jenny',
    'Kathrine',
    'Marissa',
    'Nia',
    'Amy', // UK
    'Carola',
    'Fable'
  ],
  male: [
    'Anthony',
    'Brian',
    'Chongz',
    'Kenneth',
    'Luke',
    'Max',
    'Amritangshu'
  ]
} as const;

// Cache for storing voice data to avoid repeated API calls
export interface CachedVoice {
  voice_id: string;
  voice_name: string;
  provider: string;
  gender: string;
  accent: string;
  age: string;
  avatar_url?: string;
  preview_audio_url: string;
  cached_at: number;
}

// In-memory cache (in production, consider using Redis)
const voiceCache: Map<string, CachedVoice[]> = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export function getCachedVoices(gender: 'male' | 'female' | 'all'): CachedVoice[] | null {
  const cached = voiceCache.get(gender);
  if (!cached) return null;
  
  // Check if cache is still valid
  const now = Date.now();
  if (cached.length > 0 && (now - cached[0].cached_at) > CACHE_DURATION) {
    voiceCache.delete(gender);
    return null;
  }
  
  return cached;
}

export function setCachedVoices(gender: 'male' | 'female' | 'all', voices: CachedVoice[]): void {
  const now = Date.now();
  const voicesWithTimestamp = voices.map(voice => ({
    ...voice,
    cached_at: now
  }));
  voiceCache.set(gender, voicesWithTimestamp);
}

export function isApprovedVoice(voiceName: string, gender: 'male' | 'female'): boolean {
  const approvedList = APPROVED_RETELL_VOICES[gender];
  return approvedList.some(approvedName => 
    voiceName.toLowerCase().includes(approvedName.toLowerCase())
  );
}
