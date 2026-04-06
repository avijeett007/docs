'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight, FiPlay, FiPause } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { getGreetingForServices } from '@/lib/greetingTemplates';
import { getTtsProviderForTier } from '@/lib/agentTiers';
import { saveProspectProgress } from '@/lib/prospectTracker';
import { navigateToOnboardingStep, navigateToPreviousOnboardingStep } from '@/lib/onboardingNavigation';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';

interface Step6PersonalizedGreetingProps {}

export default function Step6PersonalizedGreeting({}: Step6PersonalizedGreetingProps) {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  // Voice type is now randomly selected for each preview instead of user-selected
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [currentVoiceId, setCurrentVoiceId] = useState<string | null>(null);
  const [currentVoiceType, setCurrentVoiceType] = useState<'male' | 'female' | null>(null);
  const [isLoadingVoice, setIsLoadingVoice] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Voice history for allowing users to select previous voices
  interface VoiceHistoryItem {
    id: string;
    voiceId: string;
    voiceType: 'male' | 'female';
    audioData?: string; // Base64 audio data for Cartesia/Inworld
    previewUrl?: string; // URL for Retell
    timestamp: number;
    name?: string; // Voice name if available
  }
  const [voiceHistory, setVoiceHistory] = useState<VoiceHistoryItem[]>([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState<number | null>(null);
  // Audio mode: 'cartesia' | 'inworld' for Knova/LiveKit agents (auto-deploy), 'retell' for Retell agents
  // When autoDeployEnabled is true: Use agent tier's TTS provider (Inworld/Cartesia)
  // When autoDeployEnabled is false: Always use Retell
  // 'premium' mode uses Grok/xAI pre-recorded premium voices
  // 'byoa' mode uses partner's own Retell voices (enterprise BYOA tier)
  const [audioMode, setAudioMode] = useState<'cartesia' | 'retell' | 'inworld' | 'premium' | 'byoa'>('cartesia');

  // BYOA voices from partner's saved selection (for enterprise BYOA tier)
  interface BYOAVoice {
    id: string;
    voiceId: string;
    voiceName: string;
    provider: string;
    gender: string | null;
    language: string | null;
    accent: string | null;
    previewUrl: string | null;
  }
  const [byoaVoices, setByoaVoices] = useState<BYOAVoice[]>([]);

  // Language data loading
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [languageLoading, setLanguageLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');

  // Load voice history from localStorage on mount
  useEffect(() => {
    // Only access localStorage in the browser
    if (typeof window === 'undefined') return;

    const savedHistory = localStorage.getItem('onboarding_voiceHistory');
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory) as VoiceHistoryItem[];
        setVoiceHistory(history);
        // Set the last voice as selected by default
        if (history.length > 0) {
          setSelectedVoiceIndex(history.length - 1);
          setCurrentVoiceId(history[history.length - 1].voiceId);
          setCurrentVoiceType(history[history.length - 1].voiceType);
        }
      } catch (error) {
        console.error('Error loading voice history:', error);
      }
    }
  }, []);

  // Fetch partner branding and generate default greeting
  useEffect(() => {
    // Only run in the browser
    if (typeof window === 'undefined') return;

    const fetchBranding = async () => {
      try {
        const hostname = window.location.hostname;
        let subdomain = '';

        if (hostname.includes('.lvh.me')) {
          subdomain = hostname.split('.')[0];
        } else if (hostname.includes('.knotie-ai.pro')) {
          subdomain = hostname.split('.')[0];
        } else if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
          subdomain = hostname;
        }

        if (!subdomain) {
          throw new Error('Unable to determine partner from hostname');
        }

        const response = await fetch(`/api/whitelabel/branding/${subdomain}`);
        if (!response.ok) {
          throw new Error('Failed to fetch partner branding');
        }

        const data = await response.json();
        setBranding(data);

        // Determine audio mode based on partner's settings
        // If auto-deploy disabled, use Retell voices
        // If auto-deploy enabled, check agent tier TTS provider
        // Special case: BYOA tier uses partner's own Retell voices
        if (data.saasAgentTier === 'BYOA') {
          // BYOA tier - use partner's saved voices from their Retell account
          setAudioMode('byoa');
          if (data.byoaVoices && data.byoaVoices.length > 0) {
            setByoaVoices(data.byoaVoices);
            console.log(`🎙️ Audio mode set to byoa with ${data.byoaVoices.length} partner voices`);
          } else {
            console.log('🎙️ Audio mode set to byoa (no voices configured by partner)');
          }
        } else if (data.autoDeployEnabled === true) {
          // For auto-deploy mode (Knova/LiveKit agents), use the partner's agent tier TTS provider
          const ttsProvider = getTtsProviderForTier(data.saasAgentTier);
          if (ttsProvider === 'grok') {
            // Premium tier uses Grok/xAI pre-recorded voices
            setAudioMode('premium');
            console.log(`🎙️ Audio mode set to premium/grok (from agent tier: ${data.saasAgentTier || 'PREMIUM'})`);
          } else if (ttsProvider === 'inworld') {
            setAudioMode('inworld');
            console.log(`🎙️ Audio mode set to inworld (from agent tier: ${data.saasAgentTier || 'ESSENTIALS'})`);
          } else if (ttsProvider === 'cartesia') {
            setAudioMode('cartesia');
            console.log(`🎙️ Audio mode set to cartesia (from agent tier: ${data.saasAgentTier || 'MODERATE'})`);
          } else {
            // Fallback to cartesia for unknown TTS providers
            setAudioMode('cartesia');
            console.log(`🎙️ Audio mode set to cartesia (fallback for TTS provider: ${ttsProvider})`);
          }
        } else {
          // For non-auto-deploy mode, always use Retell voices
          setAudioMode('retell');
          console.log('🎙️ Audio mode set to retell (auto-deploy disabled)');
        }

        // Load business name and service categories from previous steps
        const storedBusinessName = localStorage.getItem('onboarding_businessName');
        const storedServiceCategories = localStorage.getItem('onboarding_serviceCategories');

        const businessName = storedBusinessName || data.characterName || data.businessName || 'Your Business';
        const serviceCategories = storedServiceCategories ? JSON.parse(storedServiceCategories) : [];

        // Generate personalized greeting based on business and services
        const personalizedGreeting = getGreetingForServices(serviceCategories, businessName);
        setGreeting(personalizedGreeting);

      } catch (err) {
        console.error('Error fetching branding:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBranding();
  }, []);

  // Load language data
  useEffect(() => {
    // Only run in the browser
    if (typeof window === 'undefined') return;

    const loadLanguage = async () => {
      try {
        const { languageData: data, selectedLanguage: detectedLanguage } = await loadLanguageDataWithLocale();
        setLanguageData(data);
        setSelectedLanguage(detectedLanguage);
      } catch (error) {
        console.error('Error loading language data:', error);
      } finally {
        setLanguageLoading(false);
      }
    };

    loadLanguage();
  }, []);

  // Helper function to get translated text
  const getTranslation = (path: string, customText?: string) => {
    if (!languageData) return customText || path;
    return getTranslatedText(languageData, path, customText, branding?.businessName);
  };

  const handleSelectVoiceFromHistory = async (index: number) => {
    const voice = voiceHistory[index];
    if (!voice) return;

    // Stop current audio if playing
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    setIsPlaying(false);

    // Update selection
    setSelectedVoiceIndex(index);
    setCurrentVoiceId(voice.voiceId);
    setCurrentVoiceType(voice.voiceType);

    // Play the selected voice
    let audio: HTMLAudioElement;
    if (voice.previewUrl) {
      audio = new Audio(voice.previewUrl);
    } else if (voice.audioData) {
      const mimeType = audioMode === 'inworld' ? 'audio/mp3' : 'audio/wav';
      audio = new Audio(`data:${mimeType};base64,${voice.audioData}`);
    } else {
      console.error('No audio data available for this voice');
      return;
    }

    setAudioElement(audio);
    setIsPlaying(true);
    audio.play();

    audio.onended = () => {
      setIsPlaying(false);
    };

    audio.onerror = () => {
      setIsPlaying(false);
      alert('Error playing audio. Please try again.');
    };
  };

  const handlePlayPreview = async () => {
    if (isPlaying) {
      // Stop playing
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
      setIsPlaying(false);
      return;
    }

    // Check preview limit (increased to 10 for better voice exploration)
    if (previewCount >= 10) {
      alert('You have reached the maximum number of voice previews (10). Please continue with your selection.');
      return;
    }

    // For Cartesia/Inworld, validate greeting length and content
    // audioMode is now a state variable that respects autoDeployEnabled
    if (audioMode === 'cartesia' || audioMode === 'inworld') {
      const maxLength = audioMode === 'inworld' ? 500 : 160; // Inworld supports longer text
      if (greeting.length > maxLength) {
        alert(`Please keep your greeting under ${maxLength} characters for voice preview.`);
        return;
      }

      if (!greeting.trim()) {
        alert('Please enter a greeting message to preview.');
        return;
      }
    }

    setIsLoadingVoice(true);

    try {
      // Randomly select voice type for each preview (no user selection)
      const randomVoiceType = Math.random() < 0.5 ? 'male' : 'female';
      setCurrentVoiceType(randomVoiceType);

      // Determine which API to use based on audioMode state (respects autoDeployEnabled)
      let voicesData: { success: boolean; voices: any[] };

      if (audioMode === 'byoa') {
        // BYOA mode - use partner's saved voices directly (no API call needed)
        if (!byoaVoices || byoaVoices.length === 0) {
          throw new Error('No voices configured by your partner. Please contact your partner to set up voices.');
        }
        // Filter by gender if available
        // Custom voices with unknown/missing gender are treated as female for preview purposes
        const genderFiltered = byoaVoices.filter(v => {
          const voiceGender = (v.gender || 'unknown').toLowerCase();
          if (voiceGender === 'unknown') {
            // Custom voices with unknown gender are included when female is selected
            return randomVoiceType === 'female';
          }
          return voiceGender === randomVoiceType;
        });
        const voicesToUse = genderFiltered.length > 0 ? genderFiltered : byoaVoices;
        voicesData = { success: true, voices: voicesToUse };
        console.log('🎙️ BYOA voices loaded:', {
          total: byoaVoices.length,
          genderFiltered: genderFiltered.length,
          using: voicesToUse.length,
          randomVoiceType
        });
      } else {
        let voicesResponse;

        if (audioMode === 'premium') {
          // Use Premium Voices API for Grok/xAI pre-recorded voices
          voicesResponse = await fetch(`/api/premium-voices?gender=${randomVoiceType}&limit=20`);
        } else if (audioMode === 'retell') {
          // Use Retell API with random gender
          voicesResponse = await fetch(`/api/retell/voices?gender=${randomVoiceType}&limit=20`);
        } else if (audioMode === 'inworld') {
          // Use Inworld API with random gender
          voicesResponse = await fetch(`/api/inworld/voices?gender=${randomVoiceType}&limit=20`);
        } else {
          // Use Cartesia API (default) with random gender
          voicesResponse = await fetch(`/api/cartesia/voices?gender=${randomVoiceType}&limit=20`);
        }

        voicesData = await voicesResponse.json();
        console.log('🎙️ Voices API response:', {
          ok: voicesResponse.ok,
          success: voicesData.success,
          voicesCount: voicesData.voices?.length,
          audioMode
        });

        if (!voicesResponse.ok) {
          throw new Error((voicesData as any).error || 'Failed to fetch voices');
        }
      }

      if (!voicesData.success || !voicesData.voices || voicesData.voices.length === 0) {
        throw new Error('No voices available for the selected gender');
      }

      // Select a random voice (different from current if possible)
      let selectedVoice;
      // Determine which field to use for voice ID based on audio mode:
      // - BYOA: uses 'voiceId' (from partner's saved voices)
      // - Retell: uses 'voice_id'
      // - Premium (Grok): uses 'voiceModelId' (the voice name like "aria", "rex")
      // - Cartesia/Inworld: uses 'id'
      const voiceIdField = audioMode === 'byoa' ? 'voiceId' : audioMode === 'retell' ? 'voice_id' : audioMode === 'premium' ? 'voiceModelId' : 'id';

      if (voicesData.voices.length === 1) {
        selectedVoice = voicesData.voices[0];
      } else {
        const availableVoices = voicesData.voices.filter((v: any) => v[voiceIdField] !== currentVoiceId);
        selectedVoice = availableVoices.length > 0
          ? availableVoices[Math.floor(Math.random() * availableVoices.length)]
          : voicesData.voices[Math.floor(Math.random() * voicesData.voices.length)];
      }

      setCurrentVoiceId(selectedVoice[voiceIdField]);

      let audio: HTMLAudioElement;
      let audioDataForHistory: string | undefined;
      let previewUrlForHistory: string | undefined;

      if (audioMode === 'premium') {
        // For Premium (Grok/xAI), use the pre-recorded signed sample URL
        if (!selectedVoice.signedSampleUrl) {
          throw new Error('No preview audio available for this premium voice');
        }

        audio = new Audio(selectedVoice.signedSampleUrl);
        previewUrlForHistory = selectedVoice.signedSampleUrl;
        console.log('🎙️ Playing premium voice:', selectedVoice.displayName || selectedVoice.name);
      } else if (audioMode === 'byoa') {
        // For BYOA, use the partner's saved voice preview URL
        if (!selectedVoice.previewUrl) {
          throw new Error('No preview audio available for this voice. Please contact your partner.');
        }

        audio = new Audio(selectedVoice.previewUrl);
        previewUrlForHistory = selectedVoice.previewUrl;
        console.log('🎙️ Playing BYOA voice:', selectedVoice.voiceName || selectedVoice.name);
      } else if (audioMode === 'retell') {
        // For Retell, use the pre-recorded preview audio URL
        if (!selectedVoice.preview_audio_url) {
          throw new Error('No preview audio available for this voice');
        }

        audio = new Audio(selectedVoice.preview_audio_url);
        previewUrlForHistory = selectedVoice.preview_audio_url;
      } else if (audioMode === 'inworld') {
        // For Inworld, generate TTS
        const ttsResponse = await fetch('/api/inworld/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: greeting.trim(),
            voiceId: selectedVoice.voiceId || selectedVoice.id, // Inworld uses voiceId
          }),
        });

        const ttsData = await ttsResponse.json();
        if (!ttsResponse.ok || !ttsData.success) {
          console.error('Inworld TTS error:', ttsData);
          throw new Error(ttsData.error || 'Failed to generate speech from Inworld');
        }

        // Inworld returns MP3 audio
        audioDataForHistory = ttsData.audioData;
        audio = new Audio(`data:audio/mp3;base64,${ttsData.audioData}`);
      } else {
        // For Cartesia, generate TTS
        const ttsResponse = await fetch('/api/cartesia/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: greeting.trim(),
            voiceId: selectedVoice.id,
          }),
        });

        if (!ttsResponse.ok) {
          throw new Error('Failed to generate speech');
        }

        const ttsData = await ttsResponse.json();
        if (!ttsData.success) {
          throw new Error('TTS generation failed');
        }

        audioDataForHistory = ttsData.audioData;
        audio = new Audio(`data:audio/wav;base64,${ttsData.audioData}`);
      }

      // Add to voice history
      const newVoiceItem: VoiceHistoryItem = {
        id: `voice-${Date.now()}`,
        voiceId: selectedVoice[voiceIdField],
        voiceType: randomVoiceType,
        audioData: audioDataForHistory,
        previewUrl: previewUrlForHistory,
        timestamp: Date.now(),
        name: selectedVoice.displayName || selectedVoice.voiceName || selectedVoice.name || selectedVoice.voice_name || `Voice ${voiceHistory.length + 1}`,
      };

      const updatedHistory = [...voiceHistory, newVoiceItem];
      setVoiceHistory(updatedHistory);
      setSelectedVoiceIndex(updatedHistory.length - 1);

      // Save to localStorage
      localStorage.setItem('onboarding_voiceHistory', JSON.stringify(updatedHistory));

      setAudioElement(audio);

      audio.onloadeddata = () => {
        setIsPlaying(true);
        audio.play();
      };

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        alert('Error playing audio. Please try again.');
      };

      // Increment preview count
      setPreviewCount(prev => prev + 1);

    } catch (error) {
      console.error('Error generating voice preview:', error);
      alert('Failed to generate voice preview. Please try again.');
    } finally {
      setIsLoadingVoice(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!greeting.trim()) return;

    // Validate greeting length
    if (greeting.length > 160) {
      alert('Please keep your greeting under 160 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get the selected voice from history, or use current voice
      const selectedVoice = selectedVoiceIndex !== null ? voiceHistory[selectedVoiceIndex] : null;
      const voiceTypeToSave = selectedVoice?.voiceType || currentVoiceType || 'female';
      const voiceIdToSave = selectedVoice?.voiceId || currentVoiceId;

      // Save greeting and voice settings to localStorage
      localStorage.setItem('onboarding_greeting', greeting);
      localStorage.setItem('onboarding_voiceType', voiceTypeToSave);
      if (voiceIdToSave) {
        localStorage.setItem('onboarding_selectedVoiceId', voiceIdToSave);
      }

      // Save prospect progress to database
      await saveProspectProgress(6, {
        greetingText: greeting,
        voiceType: voiceTypeToSave,
        selectedVoiceId: voiceIdToSave || undefined
      });

      // Navigate to next step
      navigateToOnboardingStep(7);
    } catch (error) {
      console.error('Error submitting greeting:', error);
      setIsSubmitting(false);
    }
  };

  if (loading || languageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const brandName = branding?.characterName || branding?.businessName || 'Your AI Assistant';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white sticky top-0 z-20 border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            {branding?.logo && (
              <img
                src={branding.logo}
                alt={`${branding.businessName} Logo`}
                className="h-10 w-auto object-contain"
              />
            )}
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {getTranslation('saas.onboarding.step6.stepIndicator')}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full">
          <div className="h-1.5 bg-gray-100">
            <div
              className="h-1.5 rounded-r-full transition-all duration-500 ease-out"
              style={{
                width: '66.66%', // 6/9 steps
                background: `linear-gradient(90deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
            {getTranslation('saas.onboarding.step6.title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-lg mx-auto leading-relaxed">
            {getTranslation('saas.onboarding.step6.subtitle')}
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-2xl shadow-blue-900/5 p-8 border border-white/50"
        >
          {/* Greeting Text Area */}
          <div className="mb-8">
            <label htmlFor="greeting" className="block text-sm font-bold text-gray-900 mb-2.5">
              {getTranslation('saas.onboarding.step6.greetingLabel')}
            </label>
            <div className="mb-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
              <p className="text-sm text-blue-700 font-medium flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 text-blue-600 text-xs">✨</span>
                ✨ We've created a personalized greeting based on your business information. Feel free to customize it to match your style!
              </p>
            </div>
            <textarea
              id="greeting"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Enter your personalized greeting..."
              rows={4}
              maxLength={160}
              className="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none text-gray-900 bg-gray-50/50 hover:bg-white shadow-sm"
              required
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-gray-500 text-xs">
                Keep it friendly, professional, and under 160 characters
              </p>
              <span className={`text-xs font-medium ${
                greeting.length > 160 ? 'text-red-500' : greeting.length > 140 ? 'text-amber-500' : 'text-gray-400'
              }`}>
                {greeting.length}/160
              </span>
            </div>
          </div>

          {/* Preview Button */}
          <div className="mb-10">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={handlePlayPreview}
                disabled={isLoadingVoice || (audioMode === 'byoa' && byoaVoices.length === 0) || (!['retell', 'byoa', 'premium'].includes(audioMode) && (!greeting.trim() || greeting.length > (audioMode === 'inworld' ? 500 : 160)))}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl border-2 transition-all duration-200 ${
                  isLoadingVoice || (audioMode === 'byoa' && byoaVoices.length === 0) || (!['retell', 'byoa', 'premium'].includes(audioMode) && (!greeting.trim() || greeting.length > (audioMode === 'inworld' ? 500 : 160)))
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                    : 'border-blue-200 text-blue-600 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md'
                }`}
              >
                {isLoadingVoice ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="font-semibold">
                      {previewCount === 0
                        ? "Generating Voice..."
                        : "Generating New Voice..."
                      }
                    </span>
                  </>
                ) : isPlaying ? (
                  <>
                    <FiPause className="text-lg" />
                    <span className="font-semibold">{getTranslation('saas.onboarding.step6.stop')}</span>
                  </>
                ) : (
                  <>
                    <FiPlay className="text-lg" />
                    <span className="font-semibold">
                      {previewCount === 0
                        ? getTranslation('saas.onboarding.step6.previewVoice')
                        : "Don't Like it? Try New Voice"
                      }
                    </span>
                  </>
                )}
              </button>

              {previewCount > 0 && (
                <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {previewCount}/10 used
                </span>
              )}
            </div>

            {isPlaying && (
              <div className="mt-3 flex items-center space-x-2 text-sm text-blue-600 font-medium">
                <div className="animate-pulse w-2 h-2 bg-blue-600 rounded-full"></div>
                <span>{getTranslation('saas.onboarding.step6.playing')}</span>
              </div>
            )}

            {previewCount > 0 && previewCount < 10 && !isPlaying && !isLoadingVoice && (
              <div className="mt-3 text-sm text-green-600 font-medium flex items-center">
                <span className="mr-1">💡</span>
                Each preview gives you a different voice. Try again for variety!
              </div>
            )}

            {audioMode === 'retell' && previewCount > 0 && previewCount < 10 && (
              <div className="mt-2 text-xs text-blue-600">
                Premium voice sample. Actual voice will match selection.
              </div>
            )}

            {audioMode === 'byoa' && previewCount > 0 && previewCount < 10 && (
              <div className="mt-2 text-xs text-emerald-600">
                Using local language support voice.
              </div>
            )}

            {audioMode === 'byoa' && byoaVoices.length === 0 && (
              <div className="mt-3 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100">
                ⚠️ Voice options are currently being configured. Please check back shortly.
              </div>
            )}

            {previewCount >= 10 && (
              <div className="mt-3 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100">
                ⚠️ You've reached the maximum number of voice previews (10). Please select one of your generated voices to continue.
              </div>
            )}

            {/* Voice History - Show previously generated voices */}
            {voiceHistory.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">
                  Your Voice Options ({voiceHistory.length}/10)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {voiceHistory.map((voice, index) => (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => handleSelectVoiceFromHistory(index)}
                      className={`relative p-3 rounded-xl border-2 transition-all duration-200 ${
                        selectedVoiceIndex === index
                          ? 'border-blue-500 bg-blue-50/50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        {/* Voice Icon */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          selectedVoiceIndex === index
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {voice.voiceType === 'male' ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>

                        {/* Voice Number */}
                        <div className="text-center">
                          <p className={`text-xs font-bold ${
                            selectedVoiceIndex === index ? 'text-blue-700' : 'text-gray-700'
                          }`}>
                            Voice {index + 1}
                          </p>
                          <p className={`text-[10px] uppercase tracking-wide mt-0.5 ${
                            selectedVoiceIndex === index ? 'text-blue-600' : 'text-gray-400'
                          }`}>
                            {voice.voiceType === 'male' ? 'Male' : 'Female'}
                          </p>
                        </div>

                        {/* Selected Indicator */}
                        {selectedVoiceIndex === index && (
                          <div className="absolute top-2 right-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">
                  Click on any voice to select and preview it.
                </p>
              </div>
            )}

            {/* Voice Preview Disclaimer */}
            <div className="mt-6 p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
              <div className="flex items-start space-x-3">
                <div className="text-amber-500 mt-0.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Note:</strong> The preview voice and actual voice in live calls may sound slightly different due to connection quality. We recommend testing thoroughly before deployment.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button
              type="button"
              onClick={() => navigateToPreviousOnboardingStep()}
              className="group sm:w-auto w-full py-4 px-8 rounded-xl font-medium border-2 border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
            >
              <div className="flex items-center justify-center">
                <FiArrowLeft className="mr-2 transition-transform duration-200 group-hover:-translate-x-1" />
                Back
              </div>
            </button>

            <button
              type="submit"
              disabled={!greeting.trim() || isSubmitting || greeting.length > 160}
              className={`flex-1 w-full py-4 px-6 rounded-xl font-bold text-white shadow-sm transition-all duration-300 ${
                !greeting.trim() || isSubmitting || greeting.length > 160
                  ? 'bg-gray-300 cursor-not-allowed opacity-80'
                  : 'hover:shadow-xl hover:scale-[1.02]'
              }`}
              style={{
                background: (!greeting.trim() || isSubmitting || greeting.length > 160)
                  ? '#D1D5DB'
                  : `linear-gradient(135deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
              }}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {getTranslation('saas.onboarding.step6.processing')}
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  {getTranslation('saas.onboarding.step6.continue')}
                  <FiArrowRight className="ml-2" />
                </div>
              )}
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
