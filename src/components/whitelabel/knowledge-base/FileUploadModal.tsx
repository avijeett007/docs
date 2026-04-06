'use client';

import React, { useState, useRef } from 'react';
import { FiX, FiUpload, FiFile, FiAlertCircle, FiInfo, FiCheck } from 'react-icons/fi';
import { formatFileSize } from '@/lib/utils';
import FileValidationService from '@/lib/services/fileValidationService';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, description: string) => void;
  primaryColor: string;
}

export default function FileUploadModal({
  isOpen,
  onClose,
  onUpload,
  primaryColor,
}: FileUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showSupportedFormats, setShowSupportedFormats] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const validateAndSetFile = (file: File) => {
    const validation = FileValidationService.validateFile(file);

    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid file');
      setSelectedFile(null);
      return;
    }

    setValidationError(null);
    setSelectedFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) return;

    setIsSubmitting(true);
    await onUpload(selectedFile, description);
    setIsSubmitting(false);

    // Reset form
    setSelectedFile(null);
    setDescription('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <FiX className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold text-white mb-4">Upload File</h2>

        <form onSubmit={handleSubmit}>
          <div
            className={`mb-4 border-2 border-dashed rounded-lg p-6 text-center ${
              dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={FileValidationService.getAcceptAttribute()}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex flex-col items-center">
                <FiFile className="h-12 w-12 text-blue-500 mb-2" />
                <p className="text-white font-medium mb-1">{selectedFile.name}</p>
                <p className="text-gray-400 text-sm">{formatFileSize(selectedFile.size)}</p>
                <button
                  type="button"
                  className="mt-3 text-sm text-blue-500 hover:text-blue-400"
                  onClick={() => setSelectedFile(null)}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div
                className="flex flex-col items-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <FiUpload className="h-12 w-12 text-gray-500 mb-2" />
                <p className="text-white font-medium mb-1">Drag and drop a file here</p>
                <p className="text-gray-400 text-sm mb-3">or click to browse</p>
                <button
                  type="button"
                  className="px-3 py-1 text-sm rounded-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  Browse Files
                </button>
              </div>
            )}
          </div>

          {/* Validation Error */}
          {validationError && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800/30 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <FiAlertCircle className="w-4 h-4" />
                {validationError}
              </div>
            </div>
          )}

          {/* Supported Formats Info */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowSupportedFormats(!showSupportedFormats)}
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
            >
              <FiInfo className="w-4 h-4" />
              {showSupportedFormats ? 'Hide' : 'Show'} supported formats
            </button>

            {showSupportedFormats && (
              <div className="mt-2 p-3 bg-gray-800/50 rounded-lg text-sm">
                <div className="text-gray-300 mb-2">Supported file formats:</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                  {Object.entries(FileValidationService.getSupportedFormatsByCategory()).map(([category, formats]) => (
                    <div key={category}>
                      <div className="font-medium text-gray-300 capitalize mb-1">{category}:</div>
                      <div className="text-gray-400">
                        {formats.map(f => f.extension).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-opacity-50 h-24"
              style={{ borderColor: primaryColor }}
              placeholder="Add a description for this file"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white rounded-lg"
              style={{ backgroundColor: primaryColor }}
              disabled={isSubmitting || !selectedFile}
            >
              {isSubmitting ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
