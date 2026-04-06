// Language utility functions for whitelabel multi-language support

import { logger } from '../logger';

export interface LanguageData {
  dashboard: {
    hero: {
      defaultTitle: string;
      defaultSlogan: string;
      getStarted: string;
      learnMore: string;
      login: string;
      startFreeTrial: string;
      customerEngagement: string;
    };
    features: {
      title: string;
      subtitle: string;
      availability: {
        title: string;
        description: string;
        benefits: string[];
      };
      analytics: {
        title: string;
        description: string;
        benefits: string[];
      };
      multiChannel: {
        title: string;
        description: string;
        benefits: string[];
      };
      security: {
        title: string;
        description: string;
        benefits: string[];
      };
      collaboration: {
        title: string;
        description: string;
        benefits: string[];
      };
      integration: {
        title: string;
        description: string;
        benefits: string[];
      };
    };
    testimonials: {
      title: string;
      subtitle: string;
    };
    cta: {
      title: string;
      subtitle: string;
      getStarted: string;
      learnMore: string;
    };
    footer: {
      product: string;
      support: string;
      features: string;
      pricing: string;
      integrations: string;
      apiDocumentation: string;
      systemStatus: string;
      helpCenter: string;
      contactSupport: string;
      tutorials: string;
      community: string;
      stayUpdated: string;
      newsletterDescription: string;
      enterEmail: string;
      subscribe: string;
      privacyNote: string;
      followUs: string;
      legal: string;
      allRightsReserved: string;
      secureCompliant: string;
      uptime: string;
      privacyPolicy: string;
      termsOfService: string;
      cookiePolicy: string;
      contactUs: string;
    };
    faqs: {
      defaultQuestions: Array<{
        question: string;
        answer: string;
      }>;
    };
  };
  saas: {
    landing: {
      hero: {
        meet: string;
        aiReceptionist: string;
        subheadline: string;
        benefit1: string;
        benefit2: string;
        benefit3: string;
        benefit4: string;
        ctaFree: string;
        cta: string;
        loginPrompt: string;
        noCreditCard: string;
        incomingCall: string;
        customerCalling: string;
        answering: string;
        aiGreeting: string;
        customerRequest: string;
        aiResponse: string;
      };
      features: {
        whyChoose: string;
        subtitle: string;
        items: {
          neverMissCall: {
            title: string;
            description: string;
          };
          smartBooking: {
            title: string;
            description: string;
          };
          naturalConversations: {
            title: string;
            description: string;
          };
          availability24_7: {
            title: string;
            description: string;
          };
          customerInfo: {
            title: string;
            description: string;
          };
          growBusiness: {
            title: string;
            description: string;
          };
          instantNotifications: {
            title: string;
            description: string;
          };
          easySetup: {
            title: string;
            description: string;
          };
        };
        cta: {
          title: string;
          subtitle: string;
          button: string;
        };
      };
      footer: {
        poweredBy: string;
        quickLinks: string;
        getStarted: string;
        features: string;
        testimonials: string;
        faq: string;
        resources: string;
        helpCenter: string;
        contactUs: string;
        privacyPolicy: string;
        termsOfService: string;
        followUs: string;
        allRightsReserved: string;
      };
      faqs: {
        title: string;
        subtitle: string;
        items: {
          getStarted: {
            question: string;
            answer: string;
          };
          dataSecurity: {
            question: string;
            answer: string;
          };
          integrations: {
            question: string;
            answer: string;
          };
          freeTrial: {
            question: string;
            answer: string;
          };
          pricing: {
            question: string;
            answer: string;
          };
        };
        stillHaveQuestions: string;
        contactSupport: string;
        getStarted: string;
      };
      testimonials: {
        title: string;
        subtitle: string;
        items: {
          sarah: {
            name: string;
            role: string;
            content: string;
          };
          mike: {
            name: string;
            role: string;
            content: string;
          };
          lisa: {
            name: string;
            role: string;
            content: string;
          };
        };
        readMore: string;
        stats: {
          callsHandled: {
            value: string;
            label: string;
          };
          uptime: {
            value: string;
            label: string;
          };
          availability: {
            value: string;
            label: string;
          };
          setupTime: {
            value: string;
            label: string;
          };
        };
      };
      trustIndicators: {
        title: string;
        items: {
          activeUsers: string;
          uptime: string;
          security: string;
          support: string;
        };
      };
      loading: string;
      error: {
        title: string;
        message: string;
        tryAgain: string;
      };
    };
    onboarding: {
      step1: {
        title: string;
        subtitle: string;
        businessName: string;
        businessNamePlaceholder: string;
        website: string;
        websitePlaceholder: string;
        noWebsite: string;
        industry: string;
        industryPlaceholder: string;
        continue: string;
        stepIndicator: string;
      };
      step2: {
        title: string;
        subtitle: string;
        stepIndicator: string;
        verificationMessages: string[];
        marketingMessages: string[];
      };
      step3: {
        title: string;
        subtitle: string;
        firstName: string;
        firstNamePlaceholder: string;
        lastName: string;
        lastNamePlaceholder: string;
        email: string;
        emailPlaceholder: string;
        phone: string;
        phonePlaceholder: string;
        continue: string;
        stepIndicator: string;
      };
    };
  };
  auth: {
    login: {
      subtitle: string;
    };
    register: {
      subtitle: string;
    };
    email: string;
    emailPlaceholder: string;
    password: string;
    confirmPassword: string;
    fullName: string;
    fullNamePlaceholder: string;
    passwordRequirement: string;
    passwordsDoNotMatch: string;
    passwordTooShort: string;
    forgotPassword: string;
    signIn: string;
    signingIn: string;
    createAccount: string;
    creatingAccount: string;
    registerButton: string;
    or: string;
    magicLink: {
      sent: string;
      checkEmail: string;
    };
    sendMagicLink: string;
    sendingMagicLink: string;
    enterEmailForMagicLink: string;
    noAccount: string;
    alreadyHaveAccount: string;
    troubleReset: string;
    accountCreatedVerifyEmail: string;
    registrationError: string;
    registrationSuccessful: string;
    emailNotReceived: string;
    forgotPasswordPage: {
      title: string;
      subtitle: string;
      sendResetLink: string;
      processing: string;
      resetLinkSent: string;
      backToLogin: string;
    };
  };
  loading: string;
  footer: {
    allRightsReserved: string;
  };
}

// Supported languages
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  ar: 'العربية',
  it: 'Italiano',
  hi: 'हिन्दी',
  bn: 'বাংলা',
  zh: '中文',
  fr: 'Français',
  cs: 'Čeština',
  pl: 'Polski'
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Cache for loaded language data
const languageCache = new Map<SupportedLanguage, LanguageData>();

/**
 * Load language data for a specific language
 */
export async function loadLanguageData(language: SupportedLanguage): Promise<LanguageData> {
  // Check cache first
  if (languageCache.has(language)) {
    return languageCache.get(language)!;
  }

  try {
    // Use static imports for reliable loading
    let data: LanguageData;
    switch (language) {
      case 'es':
        data = (await import('./es.json')).default;
        break;
      case 'de':
        data = (await import('./de.json')).default;
        break;
      case 'ar':
        data = (await import('./ar.json')).default;
        break;
      case 'it':
        data = (await import('./it.json')).default;
        break;
      case 'hi':
        data = (await import('./hi.json')).default;
        break;
      case 'bn':
        data = (await import('./bn.json')).default;
        break;
      case 'zh':
        data = (await import('./zh.json')).default;
        break;
      case 'fr':
        data = (await import('./fr.json')).default;
        break;
      case 'cs':
        data = (await import('./cs.json')).default;
        break;
      case 'pl':
        data = (await import('./pl.json')).default;
        break;
      case 'en':
      default:
        data = (await import('./en.json')).default;
        break;
    }

    // Cache the loaded data
    languageCache.set(language, data);
    return data;
  } catch (error) {
    logger.error(`Failed to load language data for ${language}`, error as Error, {
      operation: 'languages',
      language
    });

    // Fallback to English if the requested language fails
    if (language !== 'en') {
      return loadLanguageData('en');
    }

    throw new Error(`Failed to load language data for ${language}`);
  }
}

/**
 * Get translated text with fallback to custom partner text and AI translations
 */
export function getTranslatedText(
  languageData: LanguageData,
  path: string,
  customText?: string,
  brandName?: string,
  translatedTexts?: Record<string, any>,
  currentLanguage?: string,
  fieldName?: string
): string {
  // Debug logging for AI-translated fields
  if (fieldName === 'testimonials' || fieldName === 'portalTitle' || fieldName === 'portalSlogan' ||
      fieldName === 'features' || fieldName === 'faqs' || fieldName === 'trustIndicators') {
    logger.debug('getTranslatedText Debug', {
      operation: 'languages',
      fieldName,
      currentLanguage,
      hasTranslatedTexts: !!translatedTexts,
      translatedTexts: translatedTexts ? Object.keys(translatedTexts) : 'none',
      hasLanguageData: !!languageData,
      translatedTextForCurrentLang: !!translatedTexts?.[currentLanguage || '']
    });
  }

  // Priority 1: Use AI-translated custom text if available
  if (translatedTexts && currentLanguage && currentLanguage !== 'en' && fieldName) {
    const translatedCustomText = translatedTexts[currentLanguage]?.[fieldName];
    if (fieldName === 'testimonials' || fieldName === 'portalTitle' || fieldName === 'portalSlogan') {
      logger.debug('AI Translation Check', {
        operation: 'languages',
        fieldName,
        hasTranslatedTexts: !!translatedTexts,
        currentLanguage,
        hasLanguageData: !!translatedTexts[currentLanguage],
        willUseTranslation: !!(translatedCustomText && translatedCustomText.trim())
      });
    }
    if (translatedCustomText && translatedCustomText.trim()) {
      logger.info('Using AI translation', {
        operation: 'languages',
        fieldName,
        translationPreview: translatedCustomText.substring(0, 100) + '...'
      });
      return replaceBrandName(translatedCustomText, brandName);
    }
  }

  // Priority 2: Use original custom text (partner customization)
  if (customText && customText.trim()) {
    return replaceBrandName(customText, brandName);
  }

  // Priority 3: Get the translated text from language data
  const translatedText = getNestedValue(languageData, path);

  if (typeof translatedText === 'string') {
    return replaceBrandName(translatedText, brandName);
  }

  // Fallback to the path itself if translation is not found
  logger.warn('Translation not found for path', {
    operation: 'languages',
    path
  });
  return path;
}

/**
 * Replace {brandName} placeholder with actual brand name
 */
function replaceBrandName(text: string, brandName?: string): string {
  if (!brandName) return text;
  return text.replace(/\{brandName\}/g, brandName);
}

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Validate if a language code is supported
 */
export function isSupportedLanguage(language: string): language is SupportedLanguage {
  return language in SUPPORTED_LANGUAGES;
}

/**
 * Get language options for dropdowns
 */
export function getLanguageOptions() {
  return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    value: code,
    label: name
  }));
}

/**
 * Detect browser locale and return supported language code
 */
export function detectBrowserLocale(): SupportedLanguage | null {
  if (typeof window === 'undefined') {
    logger.debug('detectBrowserLocale: Server-side rendering, returning null', {
      operation: 'languages'
    });
    return null; // Server-side rendering
  }

  // Get browser languages in order of preference
  const browserLanguages = [
    navigator.language,
    ...(navigator.languages || [])
  ];

  logger.debug('detectBrowserLocale: Browser languages', {
    operation: 'languages',
    browserLanguages
  });

  for (const browserLang of browserLanguages) {
    // Extract language code (e.g., 'en-US' -> 'en', 'zh-CN' -> 'zh')
    const langCode = browserLang.split('-')[0].toLowerCase();
    logger.debug('detectBrowserLocale: Checking language code', {
      operation: 'languages',
      langCode
    });

    if (isSupportedLanguage(langCode)) {
      logger.debug('detectBrowserLocale: Found supported language', {
        operation: 'languages',
        langCode
      });
      return langCode;
    }
  }

  logger.debug('detectBrowserLocale: No supported language found', {
    operation: 'languages'
  });
  return null; // No supported language found
}

/**
 * Determine the best language to use based on browser locale and partner settings
 * Priority: Browser locale (if supported) -> Partner language -> English
 */
export function getBestLanguage(partnerLanguage?: string): SupportedLanguage {
  logger.debug('getBestLanguage: Starting language selection', {
    operation: 'languages',
    partnerLanguage
  });

  // First, try browser locale
  const browserLocale = detectBrowserLocale();
  logger.debug('getBestLanguage: Detected browser locale', {
    operation: 'languages',
    browserLocale
  });

  if (browserLocale) {
    logger.debug('getBestLanguage: Using browser locale', {
      operation: 'languages',
      browserLocale
    });
    return browserLocale;
  }

  // Second, try partner's chosen language
  if (partnerLanguage && isSupportedLanguage(partnerLanguage)) {
    logger.debug('getBestLanguage: Using partner language', {
      operation: 'languages',
      partnerLanguage
    });
    return partnerLanguage;
  }

  // Fallback to English
  logger.debug('getBestLanguage: Using fallback language: en', {
    operation: 'languages'
  });
  return 'en';
}

/**
 * Load language data with browser locale priority
 * This is the main function components should use
 */
export async function loadLanguageDataWithLocale(partnerLanguage?: string): Promise<{
  languageData: LanguageData;
  selectedLanguage: SupportedLanguage;
}> {
  const selectedLanguage = getBestLanguage(partnerLanguage);
  const languageData = await loadLanguageData(selectedLanguage);

  return {
    languageData,
    selectedLanguage
  };
}
