'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiCheck } from 'react-icons/fi';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
  className?: string;
}

const PRESET_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B',
  '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
  '#1F2937', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB',
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF'
];

const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  label,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const [inputMode, setInputMode] = useState<'picker' | 'hex'>('picker');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setHexInput(newValue);
    
    // Validate hex color
    if (/^#[0-9A-F]{6}$/i.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleHexInputBlur = () => {
    // If invalid hex, revert to current value
    if (!/^#[0-9A-F]{6}$/i.test(hexInput)) {
      setHexInput(value);
    }
  };

  const handlePresetColorClick = (color: string) => {
    onChange(color);
    setHexInput(color);
    setIsOpen(false);
  };

  const isValidHex = /^#[0-9A-F]{6}$/i.test(hexInput);

  return (
    <div className={`relative ${className}`}>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      
      {/* Main Color Display */}
      <div
        className="relative w-full h-10 rounded border border-gray-700 bg-gray-800 cursor-pointer flex items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div
          className="w-8 h-8 rounded ml-1 border border-gray-600"
          style={{ backgroundColor: value }}
        />
        <span className="ml-2 text-white text-sm flex-1">{value}</span>
        <FiChevronDown 
          className={`w-4 h-4 text-gray-400 mr-2 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 p-3"
        >
          {/* Mode Toggle */}
          <div className="flex mb-3 bg-gray-700 rounded p-1">
            <button
              type="button"
              onClick={() => setInputMode('picker')}
              className={`flex-1 px-3 py-1 text-xs rounded transition-colors ${
                inputMode === 'picker'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Color Picker
            </button>
            <button
              type="button"
              onClick={() => setInputMode('hex')}
              className={`flex-1 px-3 py-1 text-xs rounded transition-colors ${
                inputMode === 'hex'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Hex Code
            </button>
          </div>

          {inputMode === 'picker' ? (
            <>
              {/* Native Color Input */}
              <div className="mb-3">
                <input
                  type="color"
                  value={value}
                  onChange={(e) => {
                    onChange(e.target.value);
                    setHexInput(e.target.value);
                  }}
                  className="w-full h-8 rounded border border-gray-600 bg-gray-700 cursor-pointer"
                />
              </div>

              {/* Preset Colors */}
              <div className="grid grid-cols-10 gap-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handlePresetColorClick(color)}
                    className="w-6 h-6 rounded border border-gray-600 hover:scale-110 transition-transform relative"
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {value === color && (
                      <FiCheck 
                        className="w-3 h-3 absolute inset-0 m-auto text-white drop-shadow-lg" 
                        style={{ 
                          color: color === '#FFFFFF' ? '#000000' : '#FFFFFF' 
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Hex Input Mode */
            <div>
              <label className="block text-xs text-gray-400 mb-2">
                Enter Hex Color Code
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={hexInput}
                  onChange={handleHexInputChange}
                  onBlur={handleHexInputBlur}
                  placeholder="#6366F1"
                  className={`flex-1 px-3 py-2 bg-gray-700 border rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isValidHex ? 'border-gray-600' : 'border-red-500'
                  }`}
                />
                <div
                  className="w-8 h-8 rounded border border-gray-600"
                  style={{ backgroundColor: isValidHex ? hexInput : '#666666' }}
                />
              </div>
              {!isValidHex && hexInput && (
                <p className="text-red-400 text-xs mt-1">
                  Please enter a valid hex color (e.g., #6366F1)
                </p>
              )}
              <p className="text-gray-500 text-xs mt-2">
                Format: #RRGGBB (e.g., #6366F1 for blue)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
