import React, { useState } from 'react';
import { FiUpload, FiCheck, FiX, FiInfo } from 'react-icons/fi';

interface VoiceUploadFormProps {
  onUploadSuccess?: (voice: any) => void;
  onUploadError?: (error: string) => void;
}

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'it', label: 'Italian' },
  { value: 'de', label: 'German' },
  { value: 'bn', label: 'Bengali' },
  { value: 'multilingual', label: 'Multilingual' },
];

const USE_CASE_OPTIONS = [
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'sales', label: 'Sales' },
  { value: 'support', label: 'Technical Support' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'education', label: 'Education' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'retail', label: 'Retail' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'legal', label: 'Legal' },
  { value: 'travel', label: 'Travel' },
  { value: 'food_service', label: 'Food Service' },
  { value: 'appointment_booking', label: 'Appointment Booking' },
  { value: 'lead_qualification', label: 'Lead Qualification' },
  { value: 'survey_collection', label: 'Survey Collection' },
  { value: 'general_inquiry', label: 'General Inquiry' },
  { value: 'multilingual_support', label: 'Multilingual Support' },
];

export default function VoiceUploadForm({ onUploadSuccess, onUploadError }: VoiceUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [voiceModelId, setVoiceModelId] = useState('');
  const [primaryLanguage, setPrimaryLanguage] = useState('en');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en']);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleLanguageToggle = (language: string) => {
    setSelectedLanguages(prev => {
      if (prev.includes(language)) {
        return prev.filter(lang => lang !== language);
      } else {
        return [...prev, language];
      }
    });
  };

  const handleUseCaseToggle = (useCase: string) => {
    setSelectedUseCases(prev => {
      if (prev.includes(useCase)) {
        return prev.filter(uc => uc !== useCase);
      } else {
        return [...prev, useCase];
      }
    });
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (voiceModelId.trim()) {
        formData.append('voiceModelId', voiceModelId.trim());
      }
      
      if (selectedLanguages.length > 0) {
        formData.append('languageCapabilities', selectedLanguages.join(','));
      }

      if (selectedUseCases.length > 0) {
        formData.append('useCases', selectedUseCases.join(','));
      }

      formData.append('language', primaryLanguage);

      const response = await fetch('/api/voices/upload', {
        method: 'POST',
        headers: {
          'x-admin-api-key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || 'your-secure-admin-key-here'
        },
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult(result);
        onUploadSuccess?.(result.voice);
      } else {
        const errorMessage = result.error || 'Upload failed';
        setError(errorMessage);
        onUploadError?.(errorMessage);
      }
    } catch (err) {
      const errorMessage = 'Network error occurred';
      setError(errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setVoiceModelId('');
    setPrimaryLanguage('en');
    setSelectedLanguages(['en']);
    setSelectedUseCases([]);
    setUploadResult(null);
    setError('');
  };

  if (uploadResult) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <FiCheck className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white">Upload Successful!</h3>
        </div>
        
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-white mb-2">Voice Details:</h4>
          <div className="space-y-1 text-sm text-gray-300">
            <p><span className="font-medium">Name:</span> {uploadResult.voice.displayName}</p>
            <p><span className="font-medium">Provider:</span> {uploadResult.voice.provider}</p>
            <p><span className="font-medium">Voice Model ID:</span> {uploadResult.voice.voiceModelId || 'Not specified'}</p>
            <p><span className="font-medium">Languages:</span> {uploadResult.voice.languageCapabilities?.join(', ') || 'English'}</p>
            <p><span className="font-medium">Use Cases:</span> {uploadResult.voice.useCases?.join(', ') || 'General Use'}</p>
          </div>
        </div>
        
        <button
          onClick={resetForm}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
        >
          Upload Another Voice
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-6">Upload Voice Sample</h3>
      
      {/* File Upload */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Audio File *
        </label>
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
            id="voice-file"
          />
          <label htmlFor="voice-file" className="cursor-pointer">
            <FiUpload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-300">
              {file ? file.name : 'Click to select audio file'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Format: provider-name-type-sex.extension (e.g., azure-luna-neural-female.wav)
            </p>
          </label>
        </div>
      </div>

      {/* Voice Model ID */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Voice Model ID (Optional)
        </label>
        <input
          type="text"
          value={voiceModelId}
          onChange={(e) => setVoiceModelId(e.target.value)}
          placeholder="e.g., cartesia-uuid-12345-67890-abcdef"
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Provider-specific voice ID used in agent configurations
        </p>
      </div>

      {/* Primary Language */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Primary Language
        </label>
        <select
          value={primaryLanguage}
          onChange={(e) => setPrimaryLanguage(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {LANGUAGE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Language Capabilities */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Language Capabilities
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {LANGUAGE_OPTIONS.map(option => (
            <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedLanguages.includes(option.value)}
                onChange={() => handleLanguageToggle(option.value)}
                className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">{option.label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Select all languages this voice can speak
        </p>
      </div>

      {/* Use Cases */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Recommended Use Cases
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {USE_CASE_OPTIONS.map(option => (
            <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedUseCases.includes(option.value)}
                onChange={() => handleUseCaseToggle(option.value)}
                className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">{option.label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Select the use cases where this voice would be most effective
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg flex items-center gap-2">
          <FiX className="w-4 h-4 text-red-400" />
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!file || isUploading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isUploading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <FiUpload className="w-4 h-4" />
            Upload Voice
          </>
        )}
      </button>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg flex items-start gap-2">
        <FiInfo className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-300">
          <p className="font-medium mb-1">File Naming Convention:</p>
          <p>Use format: provider-name-type-sex.extension</p>
          <p>Example: azure-luna-neural-female.wav</p>
        </div>
      </div>
    </div>
  );
}
