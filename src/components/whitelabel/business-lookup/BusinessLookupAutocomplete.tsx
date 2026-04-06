'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiSearch, FiMapPin, FiLoader, FiHome, FiChevronDown } from 'react-icons/fi';
import { clientLogger } from '@/lib/client-logger';
import CountrySelectionModal from './CountrySelectionModal';

interface BusinessSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
}

interface BusinessDetails {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  types: string[];
  // Extended fields for comprehensive data capture
  totalReviews?: number;
  priceLevel?: number;
  businessStatus?: string;
  coordinates?: { lat: number; lng: number };
  openingHours?: any;
  photos?: any[];
  reviews?: any[];
  amenities?: any;
  hasWebsite: boolean;
  country?: string; // ISO 2-letter country code used for the search
}

interface BusinessLookupAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onBusinessSelect?: (business: BusinessDetails) => void;
  placeholder?: string;
  className?: string;
  partnerId: string;
  disabled?: boolean;
}

export default function BusinessLookupAutocomplete({
  value,
  onChange,
  onBusinessSelect,
  placeholder = "Search for your business...",
  className = "",
  partnerId,
  disabled = false
}: BusinessLookupAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<BusinessSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [country, setCountry] = useState('GB'); // Default to UK for local dev
  const [error, setError] = useState<string | null>(null);
  const [showCountryModal, setShowCountryModal] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Detect country on component mount
  useEffect(() => {
    const detectCountry = async () => {
      try {
        // For local development, use UK as default
        const isLocalDev = window.location.hostname.includes('localhost') || 
                          window.location.hostname.includes('lvh.me');
        
        if (isLocalDev) {
          setCountry('GB');
          return;
        }

        const response = await fetch('/api/whitelabel/business-lookup/country');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.country.code) {
            setCountry(data.data.country.code);
          }
        }
      } catch (err) {
        clientLogger.error('Country detection failed', err as Error, {
          component: 'BusinessLookupAutocomplete',
          operation: 'country_detection'
        });
        // Keep default GB
      }
    };

    detectCountry();
  }, []);

  // Get country name for display
  const getCountryName = (countryCode: string) => {
    const countryNames: { [key: string]: string } = {
      'GB': 'United Kingdom',
      'US': 'United States',
      'CA': 'Canada',
      'AU': 'Australia',
      'DE': 'Germany',
      'FR': 'France',
      'ES': 'Spain',
      'IT': 'Italy',
      'NL': 'Netherlands',
      'BE': 'Belgium',
      'CH': 'Switzerland',
      'AT': 'Austria',
      'SE': 'Sweden',
      'NO': 'Norway',
      'DK': 'Denmark',
      'FI': 'Finland',
      'IE': 'Ireland',
      'PT': 'Portugal',
      'PL': 'Poland',
      'CZ': 'Czech Republic',
      'NZ': 'New Zealand',
      'SG': 'Singapore',
      'HK': 'Hong Kong',
      'JP': 'Japan',
    };
    return countryNames[countryCode] || countryCode;
  };

  // Handle country selection
  const handleCountrySelect = (newCountry: string) => {
    setCountry(newCountry);
    // Clear current suggestions to trigger new search with new country
    setSuggestions([]);
    setShowDropdown(false);

    clientLogger.info('Country changed', {
      component: 'BusinessLookupAutocomplete',
      operation: 'country_change',
      oldCountry: country,
      newCountry,
      partnerId
    });
  };

  // Debounced search function
  const searchBusinesses = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/whitelabel/business-lookup/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-partner-id': partnerId
        },
        body: JSON.stringify({
          query,
          country,
          types: ['establishment']
        })
      });

      const data = await response.json();

      if (data.success && data.data.predictions) {
        setSuggestions(data.data.predictions);
        setShowDropdown(true);
        setSelectedIndex(-1);
      } else {
        setError(data.error || 'Search failed');
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch (err) {
      clientLogger.error('Business search error', err as Error, {
        component: 'BusinessLookupAutocomplete',
        operation: 'business_search',
        query,
        partnerId
      });
      setError('Search failed. Please try again.');
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  }, [partnerId, country]);

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search
    debounceRef.current = setTimeout(() => {
      searchBusinesses(newValue);
    }, 300);
  };

  // Handle business selection
  const handleBusinessSelect = async (suggestion: BusinessSuggestion) => {
    setIsLoading(true);
    setShowDropdown(false);
    
    try {
      // Get detailed business information
      const response = await fetch('/api/whitelabel/business-lookup/details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-partner-id': partnerId
        },
        body: JSON.stringify({
          place_id: suggestion.place_id
        })
      });

      const data = await response.json();

      if (data.success && data.data.business) {
        const business = data.data.business;
        clientLogger.debug('Raw business data from API', { business });
        const businessDetails: BusinessDetails = {
          name: business.name || suggestion.structured_formatting.main_text,
          address: business.formatted_address || suggestion.structured_formatting.secondary_text,
          phone: business.formatted_phone_number || business.international_phone_number,
          website: business.website,
          rating: business.rating,
          types: business.types || suggestion.types,
          // Extended data capture
          totalReviews: business.user_ratings_total,
          priceLevel: business.price_level,
          businessStatus: business.business_status,
          coordinates: business.geometry?.location ? {
            lat: business.geometry.location.lat,
            lng: business.geometry.location.lng
          } : undefined,
          openingHours: business.opening_hours,
          photos: business.photos,
          reviews: business.reviews,
          amenities: business.amenities,
          hasWebsite: !!business.website,
          country: country // Include detected/selected country for phone provisioning
        };

        clientLogger.info('Processed business details', {
          businessName: businessDetails.name,
          hasWebsite: businessDetails.hasWebsite,
          rating: businessDetails.rating,
          country: businessDetails.country
        });
        onChange(businessDetails.name);
        onBusinessSelect?.(businessDetails);
      } else {
        // Fallback to suggestion data
        onChange(suggestion.structured_formatting.main_text);
        onBusinessSelect?.({
          name: suggestion.structured_formatting.main_text,
          address: suggestion.structured_formatting.secondary_text,
          types: suggestion.types,
          hasWebsite: false,
          country: country // Include detected/selected country for phone provisioning
        });
      }
    } catch (err) {
      clientLogger.error('Business details error', err as Error, {
        component: 'BusinessLookupAutocomplete',
        operation: 'business_details',
        placeId: suggestion.place_id,
        partnerId
      });
      // Fallback to suggestion data
      onChange(suggestion.structured_formatting.main_text);
      onBusinessSelect?.({
        name: suggestion.structured_formatting.main_text,
        address: suggestion.structured_formatting.secondary_text,
        types: suggestion.types,
        hasWebsite: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleBusinessSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <FiLoader className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <FiSearch className="h-5 w-5 text-gray-400" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900 bg-white ${className} ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : ''
          }`}
        />
      </div>

      {/* Country indicator */}
      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={() => setShowCountryModal(true)}
          className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 transition-colors group"
        >
          <FiMapPin className="h-4 w-4" />
          <span>Searching in {getCountryName(country)}</span>
          <FiChevronDown className="h-3 w-3 group-hover:text-gray-700" />
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-1 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.place_id}
              onClick={() => handleBusinessSelect(suggestion)}
              className={`px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                index === selectedIndex ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                <FiHome className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {suggestion.structured_formatting.main_text}
                  </div>
                  <div className="text-sm text-gray-500 truncate flex items-center">
                    <FiMapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                    {suggestion.structured_formatting.secondary_text}
                  </div>
                  {suggestion.types.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
                      {suggestion.types.slice(0, 2).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Country Selection Modal */}
      <CountrySelectionModal
        isOpen={showCountryModal}
        onClose={() => setShowCountryModal(false)}
        currentCountry={country}
        onCountrySelect={handleCountrySelect}
      />
    </div>
  );
}
