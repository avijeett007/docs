import React, { useState, useEffect } from 'react';
import { FiPlay, FiPause, FiSearch, FiCheck } from 'react-icons/fi';

interface Voice {
  id: string;
  name: string;
  displayName: string;
  sex: string;
  voiceType: string;
  provider: string;
  voiceModelId?: string;
  sampleUrl?: string;
  language?: string;
  languageCapabilities?: string[];
  useCases?: string[];
  accent?: string;
  ageRange?: string;
  description?: string;
  tags?: string[];
  isActive: boolean;
}

interface ImprovedVoiceSelectorProps {
  selectedVoice?: string;
  onVoiceSelect: (voiceName: string) => void;
  className?: string;
}

export default function ImprovedVoiceSelector({ 
  selectedVoice, 
  onVoiceSelect, 
  className = '' 
}: ImprovedVoiceSelectorProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [filteredVoices, setFilteredVoices] = useState<Voice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingPlayback, setLoadingPlayback] = useState<string | null>(null);

  // Utility functions for display
  const getVoiceLanguagesDisplay = (voice: Voice): string => {
    if (voice.languageCapabilities && voice.languageCapabilities.length > 0) {
      const languages = voice.languageCapabilities.map(lang => {
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
    return voice.language === 'en-US' || voice.language === 'en' ? 'English' : voice.language || 'English';
  };

  const getVoiceUseCasesDisplay = (voice: Voice): string => {
    if (voice.useCases && voice.useCases.length > 0) {
      const useCases = voice.useCases.map(useCase => {
        const useCaseNames: Record<string, string> = {
          'customer_service': 'Customer Service',
          'sales': 'Sales',
          'support': 'Support',
          'marketing': 'Marketing',
          'education': 'Education',
          'healthcare': 'Healthcare',
          'finance': 'Finance',
          'real_estate': 'Real Estate',
          'hospitality': 'Hospitality',
          'retail': 'Retail',
          'appointment_booking': 'Appointments',
          'lead_qualification': 'Lead Qualification',
          'general_inquiry': 'General Inquiry'
        };
        return useCaseNames[useCase.toLowerCase()] || useCase.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      });
      return useCases.slice(0, 3).join(', ') + (useCases.length > 3 ? '...' : '');
    }
    return 'General Use';
  };

  // Fetch voices
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/voices');
        if (response.ok) {
          const data = await response.json();
          setVoices(data.voices || []);
          setFilteredVoices(data.voices || []);
        } else {
          console.error('Failed to fetch voices:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching voices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVoices();
  }, []);

  // Filter voices based on search
  useEffect(() => {
    const search = searchTerm.toLowerCase();
    const filtered = voices.filter(voice => {
      const languagesText = getVoiceLanguagesDisplay(voice).toLowerCase();
      const useCasesText = getVoiceUseCasesDisplay(voice).toLowerCase();
      
      return voice.displayName.toLowerCase().includes(search) ||
        voice.voiceType.toLowerCase().includes(search) ||
        voice.sex.toLowerCase().includes(search) ||
        languagesText.includes(search) ||
        useCasesText.includes(search) ||
        (voice.accent && voice.accent.toLowerCase().includes(search)) ||
        (voice.description && voice.description.toLowerCase().includes(search));
    });
    setFilteredVoices(filtered);
  }, [voices, searchTerm]);

  // Handle voice playback
  const handleVoicePlayback = async (voice: Voice) => {
    try {
      if (playingVoiceId === voice.id) {
        setPlayingVoiceId(null);
        return;
      }

      if (!voice.sampleUrl) {
        console.warn('No sample URL available for voice:', voice.name);
        return;
      }

      setLoadingPlayback(voice.id);

      const response = await fetch(`/api/voices/${voice.id}/play`);
      if (!response.ok) {
        throw new Error(`Failed to get voice URL: ${response.statusText}`);
      }

      const data = await response.json();
      const audio = new Audio(data.url);
      
      audio.onended = () => setPlayingVoiceId(null);
      audio.onerror = () => setPlayingVoiceId(null);
      
      await audio.play();
      setPlayingVoiceId(voice.id);
    } catch (error) {
      console.error('Error playing voice:', error);
    } finally {
      setLoadingPlayback(null);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-b-transparent border-indigo-500"></div>
        <span className="ml-3 text-gray-400">Loading voices...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search by language, use case, or voice type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4 py-2 w-full bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Voice Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
        {filteredVoices.map((voice) => (
          <div
            key={voice.id}
            onClick={() => onVoiceSelect(voice.name)}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedVoice === voice.name
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-gray-600 hover:border-gray-500 bg-gray-800'
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-white truncate flex items-center gap-2">
                  {voice.displayName}
                  {selectedVoice === voice.name && (
                    <FiCheck className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  )}
                </h4>
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-gray-400">
                    <span className="font-medium text-gray-300">Languages:</span> {getVoiceLanguagesDisplay(voice)}
                  </div>
                  <div className="text-xs text-gray-400">
                    <span className="font-medium text-gray-300">Best for:</span> {getVoiceUseCasesDisplay(voice)}
                  </div>
                  <div className="text-xs text-gray-400">
                    <span className="font-medium text-gray-300">Voice:</span> {voice.sex} • {voice.voiceType}
                    {voice.accent && ` • ${voice.accent}`}
                  </div>
                  {voice.description && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {voice.description}
                    </div>
                  )}
                </div>
              </div>
              
              {voice.sampleUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVoicePlayback(voice);
                  }}
                  className={`p-2 rounded-full flex-shrink-0 ml-2 ${
                    playingVoiceId === voice.id
                      ? 'bg-blue-500 text-white'
                      : loadingPlayback === voice.id
                      ? 'bg-gray-600 text-gray-300'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  } transition-colors`}
                  disabled={loadingPlayback === voice.id}
                  aria-label={playingVoiceId === voice.id ? "Pause voice" : "Play voice"}
                >
                  {loadingPlayback === voice.id ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-b-transparent border-white/80" />
                  ) : playingVoiceId === voice.id ? (
                    <FiPause className="w-5 h-5" />
                  ) : (
                    <FiPlay className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {!loading && filteredVoices.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No voices found matching your search.
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="block mt-2 text-indigo-400 hover:text-indigo-300 underline mx-auto"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
}
