'use client';

import React, { useState, useEffect } from 'react';
import { FiPlay, FiPause, FiLoader, FiVolume2, FiChevronDown } from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Voice {
  id: string;
  name: string;
  provider: string;
  providerId: string;
  gender?: string;
  language?: string;
  description?: string;
  previewUrl?: string;
  [key: string]: any;
}

interface VoiceSelection {
  provider: string;
  providerId: string;
  name: string;
}

interface VapiVoiceSelectorProps {
  selectedVoice: VoiceSelection | null;
  onVoiceSelect: (voice: VoiceSelection) => void;
  className?: string;
}

// VAPI Voice Provider Configuration based on API specification
const VOICE_PROVIDERS = [
  { id: '11labs', name: 'ElevenLabs', hasPreview: false },
  { id: 'openai', name: 'OpenAI', hasPreview: false },
  { id: 'deepgram', name: 'Deepgram', hasPreview: false },
  { id: 'azure', name: 'Azure', hasPreview: false },
  { id: 'cartesia', name: 'Cartesia', hasPreview: false },
  { id: 'vapi', name: 'VAPI', hasPreview: false },
  { id: 'lmnt', name: 'LMNT', hasPreview: false },
  { id: 'hume', name: 'Hume AI', hasPreview: false },
  { id: 'rime-ai', name: 'Rime AI', hasPreview: false },
  { id: 'tavus', name: 'Tavus', hasPreview: false },
  { id: 'neuphonic', name: 'Neuphonic', hasPreview: false },
  { id: 'sesame', name: 'Sesame', hasPreview: false },
];

// Static voice configurations based on VAPI API specification
const VOICE_CONFIGURATIONS: Record<string, Voice[]> = {
  '11labs': [
    { id: 'burt', name: 'Burt', provider: '11labs', providerId: 'burt' },
    { id: 'marissa', name: 'Marissa', provider: '11labs', providerId: 'marissa' },
    { id: 'andrea', name: 'Andrea', provider: '11labs', providerId: 'andrea' },
    { id: 'sarah', name: 'Sarah', provider: '11labs', providerId: 'sarah' },
    { id: 'phillip', name: 'Phillip', provider: '11labs', providerId: 'phillip' },
    { id: 'steve', name: 'Steve', provider: '11labs', providerId: 'steve' },
    { id: 'joseph', name: 'Joseph', provider: '11labs', providerId: 'joseph' },
    { id: 'myra', name: 'Myra', provider: '11labs', providerId: 'myra' },
    { id: 'paula', name: 'Paula', provider: '11labs', providerId: 'paula' },
    { id: 'ryan', name: 'Ryan', provider: '11labs', providerId: 'ryan' },
    { id: 'drew', name: 'Drew', provider: '11labs', providerId: 'drew' },
    { id: 'paul', name: 'Paul', provider: '11labs', providerId: 'paul' },
    { id: 'mrb', name: 'MrB', provider: '11labs', providerId: 'mrb' },
    { id: 'matilda', name: 'Matilda', provider: '11labs', providerId: 'matilda' },
    { id: 'mark', name: 'Mark', provider: '11labs', providerId: 'mark' },
  ],
  openai: [
    { id: 'alloy', name: 'Alloy', provider: 'openai', providerId: 'alloy' },
    { id: 'echo', name: 'Echo', provider: 'openai', providerId: 'echo' },
    { id: 'fable', name: 'Fable', provider: 'openai', providerId: 'fable' },
    { id: 'onyx', name: 'Onyx', provider: 'openai', providerId: 'onyx' },
    { id: 'nova', name: 'Nova', provider: 'openai', providerId: 'nova' },
    { id: 'shimmer', name: 'Shimmer', provider: 'openai', providerId: 'shimmer' },
    { id: 'marin', name: 'Marin', provider: 'openai', providerId: 'marin' },
    { id: 'cedar', name: 'Cedar', provider: 'openai', providerId: 'cedar' },
  ],
  deepgram: [
    { id: 'asteria', name: 'Asteria', provider: 'deepgram', providerId: 'asteria' },
    { id: 'luna', name: 'Luna', provider: 'deepgram', providerId: 'luna' },
    { id: 'stella', name: 'Stella', provider: 'deepgram', providerId: 'stella' },
    { id: 'athena', name: 'Athena', provider: 'deepgram', providerId: 'athena' },
    { id: 'hera', name: 'Hera', provider: 'deepgram', providerId: 'hera' },
    { id: 'orion', name: 'Orion', provider: 'deepgram', providerId: 'orion' },
    { id: 'arcas', name: 'Arcas', provider: 'deepgram', providerId: 'arcas' },
    { id: 'perseus', name: 'Perseus', provider: 'deepgram', providerId: 'perseus' },
    { id: 'angus', name: 'Angus', provider: 'deepgram', providerId: 'angus' },
    { id: 'orpheus', name: 'Orpheus', provider: 'deepgram', providerId: 'orpheus' },
    { id: 'helios', name: 'Helios', provider: 'deepgram', providerId: 'helios' },
    { id: 'zeus', name: 'Zeus', provider: 'deepgram', providerId: 'zeus' },
    { id: 'thalia', name: 'Thalia', provider: 'deepgram', providerId: 'thalia' },
    { id: 'andromeda', name: 'Andromeda', provider: 'deepgram', providerId: 'andromeda' },
    { id: 'helena', name: 'Helena', provider: 'deepgram', providerId: 'helena' },
    { id: 'apollo', name: 'Apollo', provider: 'deepgram', providerId: 'apollo' },
    { id: 'aries', name: 'Aries', provider: 'deepgram', providerId: 'aries' },
    { id: 'amalthea', name: 'Amalthea', provider: 'deepgram', providerId: 'amalthea' },
    { id: 'atlas', name: 'Atlas', provider: 'deepgram', providerId: 'atlas' },
    { id: 'aurora', name: 'Aurora', provider: 'deepgram', providerId: 'aurora' },
    { id: 'callista', name: 'Callista', provider: 'deepgram', providerId: 'callista' },
    { id: 'cora', name: 'Cora', provider: 'deepgram', providerId: 'cora' },
    { id: 'cordelia', name: 'Cordelia', provider: 'deepgram', providerId: 'cordelia' },
    { id: 'delia', name: 'Delia', provider: 'deepgram', providerId: 'delia' },
    { id: 'draco', name: 'Draco', provider: 'deepgram', providerId: 'draco' },
    { id: 'electra', name: 'Electra', provider: 'deepgram', providerId: 'electra' },
    { id: 'harmonia', name: 'Harmonia', provider: 'deepgram', providerId: 'harmonia' },
    { id: 'hermes', name: 'Hermes', provider: 'deepgram', providerId: 'hermes' },
    { id: 'hyperion', name: 'Hyperion', provider: 'deepgram', providerId: 'hyperion' },
    { id: 'iris', name: 'Iris', provider: 'deepgram', providerId: 'iris' },
    { id: 'janus', name: 'Janus', provider: 'deepgram', providerId: 'janus' },
    { id: 'juno', name: 'Juno', provider: 'deepgram', providerId: 'juno' },
    { id: 'jupiter', name: 'Jupiter', provider: 'deepgram', providerId: 'jupiter' },
    { id: 'mars', name: 'Mars', provider: 'deepgram', providerId: 'mars' },
    { id: 'minerva', name: 'Minerva', provider: 'deepgram', providerId: 'minerva' },
    { id: 'neptune', name: 'Neptune', provider: 'deepgram', providerId: 'neptune' },
    { id: 'odysseus', name: 'Odysseus', provider: 'deepgram', providerId: 'odysseus' },
    { id: 'ophelia', name: 'Ophelia', provider: 'deepgram', providerId: 'ophelia' },
    { id: 'pandora', name: 'Pandora', provider: 'deepgram', providerId: 'pandora' },
    { id: 'phoebe', name: 'Phoebe', provider: 'deepgram', providerId: 'phoebe' },
    { id: 'pluto', name: 'Pluto', provider: 'deepgram', providerId: 'pluto' },
    { id: 'saturn', name: 'Saturn', provider: 'deepgram', providerId: 'saturn' },
    { id: 'selene', name: 'Selene', provider: 'deepgram', providerId: 'selene' },
    { id: 'theia', name: 'Theia', provider: 'deepgram', providerId: 'theia' },
    { id: 'vesta', name: 'Vesta', provider: 'deepgram', providerId: 'vesta' },
    { id: 'celeste', name: 'Celeste', provider: 'deepgram', providerId: 'celeste' },
    { id: 'estrella', name: 'Estrella', provider: 'deepgram', providerId: 'estrella' },
    { id: 'nestor', name: 'Nestor', provider: 'deepgram', providerId: 'nestor' },
    { id: 'sirio', name: 'Sirio', provider: 'deepgram', providerId: 'sirio' },
    { id: 'carina', name: 'Carina', provider: 'deepgram', providerId: 'carina' },
    { id: 'alvaro', name: 'Alvaro', provider: 'deepgram', providerId: 'alvaro' },
    { id: 'diana', name: 'Diana', provider: 'deepgram', providerId: 'diana' },
    { id: 'aquila', name: 'Aquila', provider: 'deepgram', providerId: 'aquila' },
    { id: 'selena', name: 'Selena', provider: 'deepgram', providerId: 'selena' },
    { id: 'javier', name: 'Javier', provider: 'deepgram', providerId: 'javier' },
  ],
  azure: [
    { id: 'andrew', name: 'Andrew', provider: 'azure', providerId: 'andrew' },
    { id: 'brian', name: 'Brian', provider: 'azure', providerId: 'brian' },
    { id: 'emma', name: 'Emma', provider: 'azure', providerId: 'emma' },
  ],
  vapi: [
    { id: 'Elliot', name: 'Elliot', provider: 'vapi', providerId: 'Elliot' },
    { id: 'Kylie', name: 'Kylie', provider: 'vapi', providerId: 'Kylie' },
    { id: 'Rohan', name: 'Rohan', provider: 'vapi', providerId: 'Rohan' },
    { id: 'Lily', name: 'Lily', provider: 'vapi', providerId: 'Lily' },
    { id: 'Savannah', name: 'Savannah', provider: 'vapi', providerId: 'Savannah' },
    { id: 'Hana', name: 'Hana', provider: 'vapi', providerId: 'Hana' },
    { id: 'Neha', name: 'Neha', provider: 'vapi', providerId: 'Neha' },
    { id: 'Cole', name: 'Cole', provider: 'vapi', providerId: 'Cole' },
    { id: 'Harry', name: 'Harry', provider: 'vapi', providerId: 'Harry' },
    { id: 'Paige', name: 'Paige', provider: 'vapi', providerId: 'Paige' },
    { id: 'Spencer', name: 'Spencer', provider: 'vapi', providerId: 'Spencer' },
  ],
  lmnt: [
    { id: 'amy', name: 'Amy', provider: 'lmnt', providerId: 'amy' },
    { id: 'ansel', name: 'Ansel', provider: 'lmnt', providerId: 'ansel' },
    { id: 'autumn', name: 'Autumn', provider: 'lmnt', providerId: 'autumn' },
    { id: 'ava', name: 'Ava', provider: 'lmnt', providerId: 'ava' },
    { id: 'brandon', name: 'Brandon', provider: 'lmnt', providerId: 'brandon' },
    { id: 'caleb', name: 'Caleb', provider: 'lmnt', providerId: 'caleb' },
    { id: 'cassian', name: 'Cassian', provider: 'lmnt', providerId: 'cassian' },
    { id: 'chloe', name: 'Chloe', provider: 'lmnt', providerId: 'chloe' },
    { id: 'dalton', name: 'Dalton', provider: 'lmnt', providerId: 'dalton' },
    { id: 'daniel', name: 'Daniel', provider: 'lmnt', providerId: 'daniel' },
    { id: 'dustin', name: 'Dustin', provider: 'lmnt', providerId: 'dustin' },
    { id: 'elowen', name: 'Elowen', provider: 'lmnt', providerId: 'elowen' },
    { id: 'evander', name: 'Evander', provider: 'lmnt', providerId: 'evander' },
    { id: 'huxley', name: 'Huxley', provider: 'lmnt', providerId: 'huxley' },
    { id: 'james', name: 'James', provider: 'lmnt', providerId: 'james' },
    { id: 'juniper', name: 'Juniper', provider: 'lmnt', providerId: 'juniper' },
    { id: 'kennedy', name: 'Kennedy', provider: 'lmnt', providerId: 'kennedy' },
    { id: 'lauren', name: 'Lauren', provider: 'lmnt', providerId: 'lauren' },
    { id: 'leah', name: 'Leah', provider: 'lmnt', providerId: 'leah' },
    { id: 'lily', name: 'Lily', provider: 'lmnt', providerId: 'lily' },
    { id: 'lucas', name: 'Lucas', provider: 'lmnt', providerId: 'lucas' },
    { id: 'magnus', name: 'Magnus', provider: 'lmnt', providerId: 'magnus' },
    { id: 'miles', name: 'Miles', provider: 'lmnt', providerId: 'miles' },
    { id: 'morgan', name: 'Morgan', provider: 'lmnt', providerId: 'morgan' },
    { id: 'natalie', name: 'Natalie', provider: 'lmnt', providerId: 'natalie' },
    { id: 'nathan', name: 'Nathan', provider: 'lmnt', providerId: 'nathan' },
    { id: 'noah', name: 'Noah', provider: 'lmnt', providerId: 'noah' },
    { id: 'nyssa', name: 'Nyssa', provider: 'lmnt', providerId: 'nyssa' },
    { id: 'oliver', name: 'Oliver', provider: 'lmnt', providerId: 'oliver' },
    { id: 'paige', name: 'Paige', provider: 'lmnt', providerId: 'paige' },
    { id: 'ryan', name: 'Ryan', provider: 'lmnt', providerId: 'ryan' },
    { id: 'sadie', name: 'Sadie', provider: 'lmnt', providerId: 'sadie' },
    { id: 'sophie', name: 'Sophie', provider: 'lmnt', providerId: 'sophie' },
    { id: 'stella', name: 'Stella', provider: 'lmnt', providerId: 'stella' },
    { id: 'terrence', name: 'Terrence', provider: 'lmnt', providerId: 'terrence' },
    { id: 'tyler', name: 'Tyler', provider: 'lmnt', providerId: 'tyler' },
    { id: 'vesper', name: 'Vesper', provider: 'lmnt', providerId: 'vesper' },
    { id: 'violet', name: 'Violet', provider: 'lmnt', providerId: 'violet' },
    { id: 'warrick', name: 'Warrick', provider: 'lmnt', providerId: 'warrick' },
    { id: 'zain', name: 'Zain', provider: 'lmnt', providerId: 'zain' },
    { id: 'zeke', name: 'Zeke', provider: 'lmnt', providerId: 'zeke' },
    { id: 'zoe', name: 'Zoe', provider: 'lmnt', providerId: 'zoe' },
  ],
  cartesia: [
    // Cartesia uses custom voice IDs - users need to provide their own voice ID
    { id: 'custom', name: 'Custom Voice ID', provider: 'cartesia', providerId: '', description: 'Enter your Cartesia voice ID' },
  ],
  hume: [
    // Hume uses custom voice IDs - users need to provide their own voice ID
    { id: 'custom', name: 'Custom Voice ID', provider: 'hume', providerId: '', description: 'Enter your Hume AI voice ID' },
  ],
  'rime-ai': [
    // Rime AI uses custom voice IDs - users need to provide their own voice ID
    { id: 'custom', name: 'Custom Voice ID', provider: 'rime-ai', providerId: '', description: 'Enter your Rime AI voice ID' },
  ],
  tavus: [
    // Tavus uses custom voice IDs - users need to provide their own voice ID
    { id: 'custom', name: 'Custom Voice ID', provider: 'tavus', providerId: '', description: 'Enter your Tavus voice ID' },
  ],
  neuphonic: [
    // Neuphonic uses custom voice IDs - users need to provide their own voice ID
    { id: 'custom', name: 'Custom Voice ID', provider: 'neuphonic', providerId: '', description: 'Enter your Neuphonic voice ID' },
  ],
  sesame: [
    // Sesame uses custom voice IDs - users need to provide their own voice ID
    { id: 'custom', name: 'Custom Voice ID', provider: 'sesame', providerId: '', description: 'Enter your Sesame voice ID' },
  ],
};

const VapiVoiceSelector: React.FC<VapiVoiceSelectorProps> = ({
  selectedVoice,
  onVoiceSelect,
  className = ''
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [customVoiceId, setCustomVoiceId] = useState<string>('');

  // Initialize selected provider from selectedVoice
  useEffect(() => {
    if (selectedVoice && !selectedProvider) {
      setSelectedProvider(selectedVoice.provider);
    }
  }, [selectedVoice, selectedProvider]);

  // Initialize custom voice ID for custom providers
  useEffect(() => {
    if (selectedVoice && selectedVoice.providerId) {
      const providerVoices = VOICE_CONFIGURATIONS[selectedVoice.provider] || [];
      const isCustomProvider = providerVoices.length > 0 && providerVoices[0]?.id === 'custom';

      if (isCustomProvider) {
        setCustomVoiceId(selectedVoice.providerId);
      }
    }
  }, [selectedVoice]);

  // Load voices when provider changes
  useEffect(() => {
    if (selectedProvider) {
      loadVoices(selectedProvider);
    } else {
      setVoices([]);
    }
  }, [selectedProvider]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [audioElement]);

  const loadVoices = async (provider: string) => {
    try {
      setLoadingVoices(true);

      // Use static voice configurations from VAPI API specification
      const providerVoices = VOICE_CONFIGURATIONS[provider] || [];
      setVoices(providerVoices);

      // Small delay to show loading state for better UX
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error loading ${provider} voices:`, error);
      toast.error(`Failed to load ${provider} voices`);
      setVoices([]);
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    // Clear current selection if switching providers
    if (selectedVoice && selectedVoice.provider !== provider) {
      onVoiceSelect({ provider, providerId: '', name: '' });
    }
  };

  const handleVoiceSelect = (voice: Voice) => {
    if (voice.id === 'custom') {
      // For custom voice providers, don't select until user enters custom ID
      return;
    }

    onVoiceSelect({
      provider: voice.provider,
      providerId: voice.providerId,
      name: voice.name,
    });
  };

  const handleCustomVoiceIdChange = (voiceId: string) => {
    setCustomVoiceId(voiceId);

    if (voiceId.trim()) {
      onVoiceSelect({
        provider: selectedProvider,
        providerId: voiceId.trim(),
        name: `Custom ${selectedProvider} Voice`,
      });
    }
  };

  const handlePlayPreview = async (voice: Voice) => {
    if (!voice.previewUrl) {
      toast.error('Preview not available for this voice');
      return;
    }

    try {
      // Stop current audio if playing
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }

      if (playingVoice === voice.id) {
        setPlayingVoice(null);
        setAudioElement(null);
        return;
      }

      setPlayingVoice(voice.id);
      
      const audio = new Audio(voice.previewUrl);
      setAudioElement(audio);

      audio.onended = () => {
        setPlayingVoice(null);
        setAudioElement(null);
      };

      audio.onerror = () => {
        setPlayingVoice(null);
        setAudioElement(null);
        toast.error('Failed to play voice preview');
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing voice preview:', error);
      setPlayingVoice(null);
      setAudioElement(null);
      toast.error('Failed to play voice preview');
    }
  };

  const selectedProviderInfo = VOICE_PROVIDERS.find(p => p.id === selectedProvider);

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Voice Provider *
        </label>
        <div className="relative">
          <select
            value={selectedProvider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
          >
            <option value="">Select a provider...</option>
            {VOICE_PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Voice Selection */}
      {selectedProvider && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Voice *
          </label>
          
          {loadingVoices ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-gray-400">
                <FiLoader className="w-4 h-4 animate-spin" />
                <span>Loading voices...</span>
              </div>
            </div>
          ) : voices.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FiVolume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No voices available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
              {voices.map((voice) => (
                <div
                  key={voice.id}
                  className={clsx(
                    "p-3 border rounded-lg cursor-pointer transition-colors",
                    selectedVoice?.providerId === voice.providerId
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-gray-600 hover:border-gray-500 bg-gray-800"
                  )}
                  onClick={() => handleVoiceSelect(voice)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{voice.name}</h4>
                      <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                        {voice.gender && <span>Gender: {voice.gender}</span>}
                        {voice.language && <span>Language: {voice.language}</span>}
                      </div>
                      {voice.description && (
                        <p className="text-sm text-gray-300 mt-1">{voice.description}</p>
                      )}
                    </div>
                    
                    {/* Preview Button */}
                    {selectedProviderInfo?.hasPreview && voice.previewUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayPreview(voice);
                        }}
                        className="ml-3 p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                        title="Play preview"
                      >
                        {playingVoice === voice.id ? (
                          <FiPause className="w-4 h-4" />
                        ) : (
                          <FiPlay className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Custom Voice ID Input for providers that require it */}
          {voices.length > 0 && voices[0]?.id === 'custom' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Custom Voice ID *
              </label>
              <input
                type="text"
                value={customVoiceId}
                onChange={(e) => handleCustomVoiceIdChange(e.target.value)}
                placeholder={`Enter your ${selectedProviderInfo?.name} voice ID`}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                Please provide your custom voice ID from {selectedProviderInfo?.name}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Selected Voice Summary */}
      {selectedVoice && selectedVoice.providerId && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-green-400">
            <FiVolume2 className="w-4 h-4" />
            <span className="font-medium">Selected Voice</span>
          </div>
          <p className="text-white mt-1">
            {selectedVoice.name} ({selectedVoice.provider})
          </p>
        </div>
      )}
    </div>
  );
};

export default VapiVoiceSelector;
