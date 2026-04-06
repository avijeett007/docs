import { Voice } from '@/types/voice';

/**
 * Utility functions for filtering and working with voice data
 */

export interface VoiceFilterOptions {
  language?: string;
  provider?: string;
  sex?: string;
  voiceType?: string;
  useCase?: string;
  isActive?: boolean;
}

/**
 * Filter voices based on language capabilities
 */
export function filterVoicesByLanguage(voices: Voice[], targetLanguage: string): Voice[] {
  if (!targetLanguage) return voices;
  
  const normalizedTarget = targetLanguage.toLowerCase();
  
  return voices.filter(voice => {
    // Check if voice has language capabilities defined
    if (voice.languageCapabilities && voice.languageCapabilities.length > 0) {
      return voice.languageCapabilities.some(lang => {
        const normalizedLang = lang.toLowerCase();
        
        // Direct match
        if (normalizedLang === normalizedTarget) return true;
        
        // Check for multilingual support
        if (normalizedLang === 'multilingual') return true;
        
        // Check for specific multilingual combinations like "multilingual (en,es)"
        if (normalizedLang.startsWith('multilingual') && normalizedLang.includes(normalizedTarget)) {
          return true;
        }
        
        // Language code mapping (e.g., 'en' matches 'english')
        const languageMap: Record<string, string[]> = {
          'en': ['english', 'en'],
          'es': ['spanish', 'es'],
          'ar': ['arabic', 'ar'],
          'hi': ['hindi', 'hi'],
          'it': ['italian', 'it'],
          'de': ['german', 'de'],
          'bn': ['bengali', 'bn'],
        };
        
        const targetVariants = languageMap[normalizedTarget] || [normalizedTarget];
        return targetVariants.includes(normalizedLang);
      });
    }
    
    // Fallback to primary language field for backward compatibility
    return voice.language.toLowerCase() === normalizedTarget;
  });
}

/**
 * Filter voices based on use case
 */
export function filterVoicesByUseCase(voices: Voice[], targetUseCase: string): Voice[] {
  if (!targetUseCase) return voices;

  const normalizedTarget = targetUseCase.toLowerCase().replace(/[_\s]/g, '_');

  return voices.filter(voice => {
    // Check if voice has use cases defined
    if (voice.useCases && voice.useCases.length > 0) {
      return voice.useCases.some(useCase => {
        const normalizedUseCase = useCase.toLowerCase().replace(/[_\s]/g, '_');
        return normalizedUseCase === normalizedTarget ||
               normalizedUseCase.includes(normalizedTarget) ||
               normalizedTarget.includes(normalizedUseCase);
      });
    }

    // If no specific use cases defined, consider it suitable for general use
    return targetUseCase.includes('general') || targetUseCase.includes('inquiry');
  });
}

/**
 * Filter voices based on multiple criteria
 */
export function filterVoices(voices: Voice[], options: VoiceFilterOptions): Voice[] {
  let filtered = voices;

  if (options.language) {
    filtered = filterVoicesByLanguage(filtered, options.language);
  }

  if (options.provider) {
    filtered = filtered.filter(voice => voice.provider === options.provider);
  }

  if (options.sex) {
    filtered = filtered.filter(voice => voice.sex === options.sex);
  }

  if (options.voiceType) {
    filtered = filtered.filter(voice => voice.voiceType === options.voiceType);
  }

  if (options.useCase) {
    filtered = filterVoicesByUseCase(filtered, options.useCase);
  }

  if (options.isActive !== undefined) {
    filtered = filtered.filter(voice => voice.isActive === options.isActive);
  }

  return filtered;
}

/**
 * Get the provider-specific voice ID for agent configuration
 */
export function getVoiceModelId(voice: Voice): string {
  // Return the provider-specific ID if available, otherwise fall back to the voice name
  return voice.voiceModelId || voice.name;
}

/**
 * Get supported languages for a voice as a readable string
 */
export function getVoiceLanguagesDisplay(voice: Voice): string {
  if (voice.languageCapabilities && voice.languageCapabilities.length > 0) {
    const languages = voice.languageCapabilities.map(lang => {
      // Convert language codes to readable names
      const languageNames: Record<string, string> = {
        'en': 'English',
        'es': 'Spanish',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'it': 'Italian',
        'de': 'German',
        'bn': 'Bengali',
        'multilingual': 'Multilingual'
      };
      
      return languageNames[lang.toLowerCase()] || lang;
    });
    
    return languages.join(', ');
  }
  
  // Fallback to primary language
  const languageNames: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'it': 'Italian',
    'de': 'German',
    'bn': 'Bengali'
  };
  
  return languageNames[voice.language] || voice.language;
}

/**
 * Check if a voice supports a specific language
 */
export function voiceSupportsLanguage(voice: Voice, language: string): boolean {
  const filtered = filterVoicesByLanguage([voice], language);
  return filtered.length > 0;
}

/**
 * Get all unique languages supported across a set of voices
 */
export function getAvailableLanguages(voices: Voice[]): string[] {
  const languages = new Set<string>();
  
  voices.forEach(voice => {
    if (voice.languageCapabilities && voice.languageCapabilities.length > 0) {
      voice.languageCapabilities.forEach(lang => {
        // Skip multilingual entries with parentheses for this list
        if (!lang.toLowerCase().includes('(')) {
          languages.add(lang.toLowerCase());
        }
      });
    } else {
      languages.add(voice.language.toLowerCase());
    }
  });
  
  return Array.from(languages).sort();
}

/**
 * Get use cases for a voice as a readable string
 */
export function getVoiceUseCasesDisplay(voice: Voice): string {
  if (voice.useCases && voice.useCases.length > 0) {
    const useCases = voice.useCases.map(useCase => {
      // Convert use case codes to readable names
      const useCaseNames: Record<string, string> = {
        'customer_service': 'Customer Service',
        'customer service': 'Customer Service',
        'sales': 'Sales',
        'sales calls': 'Sales Calls',
        'support': 'Support',
        'technical support': 'Technical Support',
        'marketing': 'Marketing',
        'marketing campaigns': 'Marketing Campaigns',
        'education': 'Education',
        'educational content': 'Educational Content',
        'entertainment': 'Entertainment',
        'entertainment content': 'Entertainment Content',
        'healthcare': 'Healthcare',
        'healthcare assistance': 'Healthcare Assistance',
        'finance': 'Finance',
        'financial services': 'Financial Services',
        'real_estate': 'Real Estate',
        'real estate': 'Real Estate',
        'hospitality': 'Hospitality',
        'hospitality services': 'Hospitality Services',
        'retail': 'Retail',
        'retail assistance': 'Retail Assistance',
        'automotive': 'Automotive',
        'automotive services': 'Automotive Services',
        'insurance': 'Insurance',
        'insurance services': 'Insurance Services',
        'legal': 'Legal',
        'legal services': 'Legal Services',
        'travel': 'Travel',
        'travel assistance': 'Travel Assistance',
        'food_service': 'Food Service',
        'food service': 'Food Service',
        'appointment_booking': 'Appointment Booking',
        'appointment booking': 'Appointment Booking',
        'lead_qualification': 'Lead Qualification',
        'lead qualification': 'Lead Qualification',
        'survey_collection': 'Survey Collection',
        'survey collection': 'Survey Collection',
        'general_inquiry': 'General Inquiry',
        'general inquiry': 'General Inquiry',
        'multilingual_support': 'Multilingual Support',
        'multilingual support': 'Multilingual Support'
      };

      return useCaseNames[useCase.toLowerCase()] || useCase.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    });

    return useCases.join(', ');
  }

  return 'General Use';
}

/**
 * Get all unique use cases across a set of voices
 */
export function getAvailableUseCases(voices: Voice[]): string[] {
  const useCases = new Set<string>();

  voices.forEach(voice => {
    if (voice.useCases && voice.useCases.length > 0) {
      voice.useCases.forEach(useCase => {
        useCases.add(useCase.toLowerCase());
      });
    }
  });

  return Array.from(useCases).sort();
}

/**
 * Check if a voice supports a specific use case
 */
export function voiceSupportsUseCase(voice: Voice, useCase: string): boolean {
  const filtered = filterVoicesByUseCase([voice], useCase);
  return filtered.length > 0;
}

/**
 * Sort voices by relevance for a given language
 * Voices that support the target language come first
 */
export function sortVoicesByLanguageRelevance(voices: Voice[], targetLanguage: string): Voice[] {
  if (!targetLanguage) return voices;

  const supporting = filterVoicesByLanguage(voices, targetLanguage);
  const notSupporting = voices.filter(voice => !supporting.includes(voice));

  return [...supporting, ...notSupporting];
}

/**
 * Sort voices by relevance for a given use case
 * Voices that support the target use case come first
 */
export function sortVoicesByUseCaseRelevance(voices: Voice[], targetUseCase: string): Voice[] {
  if (!targetUseCase) return voices;

  const supporting = filterVoicesByUseCase(voices, targetUseCase);
  const notSupporting = voices.filter(voice => !supporting.includes(voice));

  return [...supporting, ...notSupporting];
}

/**
 * Get voice recommendations based on use case and language
 */
export function getVoiceRecommendations(voices: Voice[], useCase: string, language?: string): Voice[] {
  let filtered = voices;

  // Filter by use case first
  if (useCase) {
    filtered = filterVoicesByUseCase(filtered, useCase);
  }

  // Then filter by language if specified
  if (language) {
    filtered = filterVoicesByLanguage(filtered, language);
  }

  // Sort by relevance (voices matching both criteria first)
  return filtered.sort((a, b) => {
    const aUseCaseMatch = voiceSupportsUseCase(a, useCase);
    const bUseCaseMatch = voiceSupportsUseCase(b, useCase);
    const aLanguageMatch = language ? voiceSupportsLanguage(a, language) : true;
    const bLanguageMatch = language ? voiceSupportsLanguage(b, language) : true;

    // Prioritize voices that match both criteria
    const aScore = (aUseCaseMatch ? 2 : 0) + (aLanguageMatch ? 1 : 0);
    const bScore = (bUseCaseMatch ? 2 : 0) + (bLanguageMatch ? 1 : 0);

    return bScore - aScore;
  });
}
