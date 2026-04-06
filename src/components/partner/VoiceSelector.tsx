import React, { useState } from 'react';
import { FiPlay, FiPause, FiCheck } from 'react-icons/fi';

interface Voice {
  voice_id: string;
  voice_name: string;
  provider: string;
  accent: string;
  gender: string;
  age: string;
  avatar_url: string;
  preview_audio_url: string;
  use_case: string;
}

interface VoiceSelectorProps {
  voices: Voice[];
  selectedVoiceId: string;
  onSelect: (voiceId: string) => void;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  voices,
  selectedVoiceId,
  onSelect
}) => {
  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const handlePlayPreview = (voice: Voice) => {
    // Stop any currently playing audio
    if (playingAudio) {
      playingAudio.pause();
      playingAudio.currentTime = 0;
      setPlayingAudio(null);
      setPlayingVoiceId(null);
    }

    // If we clicked on the currently playing voice, just stop it
    if (playingVoiceId === voice.voice_id) {
      return;
    }

    // Play the new audio
    const audio = new Audio(voice.preview_audio_url);
    audio.onended = () => {
      setPlayingAudio(null);
      setPlayingVoiceId(null);
    };
    audio.play();
    setPlayingAudio(audio);
    setPlayingVoiceId(voice.voice_id);
  };

  const handleSelectVoice = (voiceId: string) => {
    onSelect(voiceId);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {voices.map((voice) => (
          <div 
            key={voice.voice_id}
            className={`p-4 rounded-lg border transition-all cursor-pointer ${
              selectedVoiceId === voice.voice_id 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-gray-700 bg-gray-800 hover:border-gray-500'
            }`}
            onClick={() => handleSelectVoice(voice.voice_id)}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                {voice.avatar_url ? (
                  <img 
                    src={voice.avatar_url} 
                    alt={voice.voice_name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    {voice.voice_name.charAt(0)}
                  </div>
                )}
              </div>
              
              {/* Voice info */}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-white flex items-center">
                    {voice.voice_name}
                    {selectedVoiceId === voice.voice_id && (
                      <FiCheck className="ml-2 text-blue-400" />
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayPreview(voice);
                    }}
                    className={`p-2 rounded-full ${
                      playingVoiceId === voice.voice_id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    aria-label={playingVoiceId === voice.voice_id ? "Pause preview" : "Play preview"}
                  >
                    {playingVoiceId === voice.voice_id ? (
                      <FiPause className="w-4 h-4" />
                    ) : (
                      <FiPlay className="w-4 h-4" />
                    )}
                  </button>
                </div>
                
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="flex items-center">
                    <span className="text-gray-400">Accent:</span>
                    <span className="ml-1 text-gray-200">{voice.accent}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-400">Gender:</span>
                    <span className="ml-1 text-gray-200">{voice.gender}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-400">Age:</span>
                    <span className="ml-1 text-gray-200">{voice.age}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-400">Provider:</span>
                    <span className="ml-1 text-gray-200">{voice.provider}</span>
                  </div>
                </div>
                
                <p className="mt-2 text-xs text-gray-400 line-clamp-2">{voice.use_case}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VoiceSelector;
