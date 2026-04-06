import React, { useState, useEffect } from 'react';
import { FiFilter, FiSearch, FiPlay, FiCheck } from 'react-icons/fi';
import { Voice } from '@/types/voice';
import { 
  filterVoices, 
  getVoiceRecommendations, 
  getVoiceLanguagesDisplay, 
  getVoiceUseCasesDisplay 
} from '@/utils/voiceFilters';

interface VoiceRecommendationEngineProps {
  voices: Voice[];
  onVoiceSelect: (voice: Voice) => void;
  selectedVoiceId?: string;
}

const USE_CASE_OPTIONS = [
  { value: '', label: 'All Use Cases' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'sales', label: 'Sales' },
  { value: 'support', label: 'Technical Support' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'retail', label: 'Retail' },
  { value: 'appointment_booking', label: 'Appointment Booking' },
  { value: 'lead_qualification', label: 'Lead Qualification' },
  { value: 'general_inquiry', label: 'General Inquiry' },
];

const LANGUAGE_OPTIONS = [
  { value: '', label: 'All Languages' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'it', label: 'Italian' },
  { value: 'de', label: 'German' },
  { value: 'bn', label: 'Bengali' },
  { value: 'multilingual', label: 'Multilingual' },
];

const PROVIDER_OPTIONS = [
  { value: '', label: 'All Providers' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'azure', label: 'Azure' },
  { value: 'deepgram', label: 'Deepgram' },
];

export default function VoiceRecommendationEngine({ 
  voices, 
  onVoiceSelect, 
  selectedVoiceId 
}: VoiceRecommendationEngineProps) {
  const [selectedUseCase, setSelectedUseCase] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredVoices, setFilteredVoices] = useState<Voice[]>(voices);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  useEffect(() => {
    let filtered = voices;

    // Apply filters
    if (selectedUseCase || selectedLanguage || selectedProvider) {
      filtered = filterVoices(filtered, {
        useCase: selectedUseCase || undefined,
        language: selectedLanguage || undefined,
        provider: selectedProvider || undefined,
        isActive: true
      });
    }

    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(voice => 
        voice.name.toLowerCase().includes(term) ||
        voice.displayName.toLowerCase().includes(term) ||
        voice.description?.toLowerCase().includes(term) ||
        getVoiceLanguagesDisplay(voice).toLowerCase().includes(term) ||
        getVoiceUseCasesDisplay(voice).toLowerCase().includes(term)
      );
    }

    // Get recommendations if use case and/or language is selected
    if (selectedUseCase || selectedLanguage) {
      filtered = getVoiceRecommendations(filtered, selectedUseCase, selectedLanguage);
    }

    setFilteredVoices(filtered);
  }, [voices, selectedUseCase, selectedLanguage, selectedProvider, searchTerm]);

  const handlePlayVoice = async (voice: Voice) => {
    if (playingVoiceId === voice.id) {
      setPlayingVoiceId(null);
      return;
    }

    if (!voice.sampleUrl) {
      console.warn('No sample URL available for voice:', voice.name);
      return;
    }

    try {
      setPlayingVoiceId(voice.id);
      
      // Get signed URL for playing the voice sample
      const response = await fetch(`/api/voices/${voice.id}/play`);
      if (response.ok) {
        const data = await response.json();
        const audio = new Audio(data.signedUrl);
        
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => setPlayingVoiceId(null);
        
        await audio.play();
      } else {
        console.error('Failed to get voice sample URL');
        setPlayingVoiceId(null);
      }
    } catch (error) {
      console.error('Error playing voice sample:', error);
      setPlayingVoiceId(null);
    }
  };

  const clearFilters = () => {
    setSelectedUseCase('');
    setSelectedLanguage('');
    setSelectedProvider('');
    setSearchTerm('');
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Voice Recommendation Engine</h3>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiFilter className="w-4 h-4" />
          {filteredVoices.length} of {voices.length} voices
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Use Case</label>
          <select
            value={selectedUseCase}
            onChange={(e) => setSelectedUseCase(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {USE_CASE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Language</label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {LANGUAGE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Provider</label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PROVIDER_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search voices..."
              className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Clear Filters */}
      {(selectedUseCase || selectedLanguage || selectedProvider || searchTerm) && (
        <div className="mb-4">
          <button
            onClick={clearFilters}
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Voice Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVoices.map((voice) => (
          <div
            key={voice.id}
            className={`p-4 rounded-lg border transition-all cursor-pointer ${
              selectedVoiceId === voice.id
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-700 bg-gray-700 hover:border-gray-500'
            }`}
            onClick={() => onVoiceSelect(voice)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-medium text-white flex items-center gap-2">
                  {voice.displayName}
                  {selectedVoiceId === voice.id && (
                    <FiCheck className="w-4 h-4 text-blue-400" />
                  )}
                </h4>
                <p className="text-sm text-gray-400 capitalize">
                  {voice.provider} • {voice.sex} • {voice.voiceType}
                </p>
              </div>
              
              {voice.sampleUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayVoice(voice);
                  }}
                  className={`p-2 rounded-full ${
                    playingVoiceId === voice.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                  aria-label="Play voice sample"
                >
                  <FiPlay className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="font-medium text-gray-300">Languages:</span>
                <span className="text-gray-400 ml-1">{getVoiceLanguagesDisplay(voice)}</span>
              </div>
              
              <div>
                <span className="font-medium text-gray-300">Use Cases:</span>
                <span className="text-gray-400 ml-1">{getVoiceUseCasesDisplay(voice)}</span>
              </div>
              
              {voice.description && (
                <div>
                  <span className="font-medium text-gray-300">Description:</span>
                  <span className="text-gray-400 ml-1">{voice.description}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredVoices.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-400">No voices found matching your criteria.</p>
          <button
            onClick={clearFilters}
            className="mt-2 text-blue-400 hover:text-blue-300 underline"
          >
            Clear filters to see all voices
          </button>
        </div>
      )}
    </div>
  );
}
