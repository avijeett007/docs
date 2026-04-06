'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FiLoader, FiPlay, FiPause, FiCheck, FiX, FiAlertCircle, FiPlus, FiTrash2, FiRefreshCw, FiVolume2 } from 'react-icons/fi';

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

interface RetellVoice {
  id: string;
  name: string;
  provider: string;
  gender: string;
  language: string;
  accent?: string;
  previewUrl?: string;
  isSaved?: boolean;
}

interface BYOAVoiceSelectorProps {
  partnerId: string;
  hasRetellApiKey: boolean;
  onConfigureApiKey: () => void;
}

const MAX_VOICES = 5;

export default function BYOAVoiceSelector({ partnerId, hasRetellApiKey, onConfigureApiKey }: BYOAVoiceSelectorProps) {
  const [savedVoices, setSavedVoices] = useState<BYOAVoice[]>([]);
  const [availableVoices, setAvailableVoices] = useState<RetellVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterGender, setFilterGender] = useState<string>('all');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch saved voices on mount
  useEffect(() => {
    fetchSavedVoices();
  }, []);

  const getAuthToken = () => localStorage.getItem('partner_token');

  const fetchSavedVoices = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch('/api/partner/byoa-voices', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSavedVoices(data.voices || []);
      }
    } catch (err) {
      console.error('Error fetching saved voices:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableVoices = async () => {
    if (!hasRetellApiKey) {
      setError('Please configure your Retell API key first');
      return;
    }

    try {
      setLoadingVoices(true);
      setError(null);
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch('/api/partner/byoa-voices/load', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableVoices(data.voices || []);
        setShowVoicePicker(true);
      } else {
        const errData = await response.json();
        if (errData.error === 'RETELL_API_KEY_MISSING') {
          setError('Retell API key not found. Please configure it first.');
        } else {
          setError(errData.error || 'Failed to load voices');
        }
      }
    } catch (err) {
      console.error('Error loading voices:', err);
      setError('Failed to load voices from Retell');
    } finally {
      setLoadingVoices(false);
    }
  };

  const addVoice = async (voice: RetellVoice) => {
    if (savedVoices.length >= MAX_VOICES) {
      setError(`Maximum of ${MAX_VOICES} voices allowed`);
      return;
    }

    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch('/api/partner/byoa-voices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voiceId: voice.id,
          provider: voice.provider,
          voiceName: voice.name,
          gender: voice.gender,
          language: voice.language,
          accent: voice.accent,
          previewUrl: voice.previewUrl,
        }),
      });

      if (response.ok) {
        setSuccess('Voice added successfully');
        fetchSavedVoices();
        setAvailableVoices(prev => prev.map(v => v.id === voice.id ? { ...v, isSaved: true } : v));
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to add voice');
      }
    } catch (err) {
      console.error('Error adding voice:', err);
      setError('Failed to add voice');
    }
  };

  const removeVoice = async (voiceId: string) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`/api/partner/byoa-voices?voiceId=${voiceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setSuccess('Voice removed successfully');
        fetchSavedVoices();
        setAvailableVoices(prev => prev.map(v => v.id === voiceId ? { ...v, isSaved: false } : v));
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to remove voice');
      }
    } catch (err) {
      console.error('Error removing voice:', err);
      setError('Failed to remove voice');
    }
  };

  const playVoice = (previewUrl: string | null, voiceId: string) => {
    if (!previewUrl) return;

    if (playingVoiceId === voiceId) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(previewUrl);
    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = () => setPlayingVoiceId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingVoiceId(voiceId);
  };

  const filteredVoices = availableVoices.filter(voice => {
    const matchesSearch = voice.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         voice.provider.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProvider = filterProvider === 'all' || voice.provider === filterProvider;
    // Handle missing/unknown gender for custom voices
    const voiceGender = (voice.gender || 'unknown').toLowerCase();
    const matchesGender = filterGender === 'all' || voiceGender === filterGender;
    return matchesSearch && matchesProvider && matchesGender;
  });

  const providers = [...new Set(availableVoices.map(v => v.provider))].sort();

  if (!hasRetellApiKey) {
    return (
      <div className="mt-4 p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
        <div className="flex items-center gap-2 text-amber-400 mb-2">
          <FiAlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Retell API Key Required</span>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Configure your Retell API key to select voices from your Retell account.
        </p>
        <button
          type="button"
          onClick={onConfigureApiKey}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-lg"
        >
          Configure API Key
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FiVolume2 className="text-emerald-400 w-4 h-4" />
          <span className="text-sm font-medium text-white">BYOA Voice Selection</span>
          <span className="text-xs text-gray-400">({savedVoices.length}/{MAX_VOICES})</span>
        </div>
        <button
          type="button"
          onClick={loadAvailableVoices}
          disabled={loadingVoices}
          className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded disabled:opacity-50"
        >
          {loadingVoices ? <FiLoader className="w-3 h-3 animate-spin" /> : <FiRefreshCw className="w-3 h-3" />}
          Load Voices
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-900/30 border border-red-500/30 rounded text-xs text-red-400 flex items-center gap-2">
          <FiAlertCircle className="w-3 h-3" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><FiX className="w-3 h-3" /></button>
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-green-900/30 border border-green-500/30 rounded text-xs text-green-400 flex items-center gap-2">
          <FiCheck className="w-3 h-3" /> {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <FiLoader className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : savedVoices.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">
          No voices selected. Click &quot;Load Voices&quot; to browse available voices from your Retell account.
        </p>
      ) : (
        <div className="space-y-2">
          {savedVoices.map((voice) => (
            <div key={voice.id} className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                {voice.previewUrl && (
                  <button
                    type="button"
                    onClick={() => playVoice(voice.previewUrl, voice.voiceId)}
                    className="p-1 rounded bg-gray-600 hover:bg-gray-500"
                  >
                    {playingVoiceId === voice.voiceId ? <FiPause className="w-3 h-3" /> : <FiPlay className="w-3 h-3" />}
                  </button>
                )}
                <div>
                  <span className="text-sm text-white">{voice.voiceName}</span>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="capitalize">{voice.provider}</span>
                    {voice.gender && <span>• {voice.gender}</span>}
                    {voice.accent && <span>• {voice.accent}</span>}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeVoice(voice.voiceId)}
                className="p-1.5 text-red-400 hover:bg-red-500/20 rounded"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Voice Picker Modal */}
      {showVoicePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Select Voices ({savedVoices.length}/{MAX_VOICES})</h3>
              <button onClick={() => setShowVoicePicker(false)} className="text-gray-400 hover:text-white">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Search voices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
              />
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
              >
                <option value="all">All Providers</option>
                {providers.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
              >
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="unknown">Custom/Unknown</option>
              </select>
            </div>

            {/* Voice List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredVoices.map((voice) => (
                <div
                  key={voice.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    voice.isSaved ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-gray-700/50 border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {voice.previewUrl && (
                      <button
                        type="button"
                        onClick={() => playVoice(voice.previewUrl!, voice.id)}
                        className="p-2 rounded bg-gray-600 hover:bg-gray-500"
                      >
                        {playingVoiceId === voice.id ? <FiPause className="w-4 h-4" /> : <FiPlay className="w-4 h-4" />}
                      </button>
                    )}
                    <div>
                      <span className="text-sm text-white font-medium">{voice.name}</span>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="capitalize">{voice.provider}</span>
                        <span>• {voice.gender}</span>
                        {voice.accent && <span>• {voice.accent}</span>}
                        {voice.language && <span>• {voice.language}</span>}
                      </div>
                    </div>
                  </div>
                  {voice.isSaved ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <FiCheck className="w-3 h-3" /> Added
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addVoice(voice)}
                      disabled={savedVoices.length >= MAX_VOICES}
                      className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded disabled:opacity-50"
                    >
                      <FiPlus className="w-3 h-3" /> Add
                    </button>
                  )}
                </div>
              ))}
              {filteredVoices.length === 0 && (
                <p className="text-center text-gray-400 py-4">No voices match your filters</p>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => setShowVoicePicker(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
