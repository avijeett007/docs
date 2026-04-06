'use client';

import { useState } from 'react';
import { FiSearch, FiMapPin, FiGlobe } from 'react-icons/fi';

export default function BusinessLookupTestPage() {
  const [country, setCountry] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [businessDetails, setBusinessDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testCountry, setTestCountry] = useState('US');

  const detectCountry = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/whitelabel/business-lookup/country?testCountry=${testCountry}`);
      const data = await response.json();
      setCountry(data);
    } catch (error) {
      console.error('Error detecting country:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchBusinesses = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/test/business-lookup-demo?query=${encodeURIComponent(searchQuery)}&country=${testCountry}`);
      const data = await response.json();
      setSearchResults(data.data?.businesses || []);
    } catch (error) {
      console.error('Error searching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBusinessDetails = async (placeId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/test/business-lookup-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          place_id: placeId
        })
      });
      const data = await response.json();
      setBusinessDetails(data.data?.business || null);
    } catch (error) {
      console.error('Error getting business details:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Business Lookup Test Page
        </h1>
        
        {/* Test Country Selection */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <FiGlobe className="mr-2" />
            Test Country Selection
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <select
              value={testCountry}
              onChange={(e) => setTestCountry(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            >
              <option value="US">🇺🇸 United States</option>
              <option value="GB">🇬🇧 United Kingdom</option>
              <option value="CA">🇨🇦 Canada</option>
              <option value="AU">🇦🇺 Australia</option>
              <option value="DE">🇩🇪 Germany</option>
              <option value="FR">🇫🇷 France</option>
              <option value="IT">🇮🇹 Italy</option>
              <option value="ES">🇪🇸 Spain</option>
            </select>
            <button
              onClick={detectCountry}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
            >
              {loading ? 'Detecting...' : 'Detect Country'}
            </button>
          </div>
          
          {country && (
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Country Detection Result:</h3>
              <p>Country: {country.data?.country?.flag} {country.data?.country?.name} ({country.data?.country?.code})</p>
              <p>Source: {country.data?.detected_from}</p>
              <p>Confidence: {(country.data?.confidence * 100).toFixed(1)}%</p>
            </div>
          )}
        </div>

        {/* Business Search */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <FiSearch className="mr-2" />
            Business Search
          </h2>
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a business (e.g., 'Pizza restaurant near me')"
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              onKeyPress={(e) => e.key === 'Enter' && searchBusinesses()}
            />
            <button
              onClick={searchBusinesses}
              disabled={loading || !searchQuery.trim()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Search Results:</h3>
              {searchResults.map((business, index) => (
                <div
                  key={index}
                  className="bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600"
                  onClick={() => getBusinessDetails(business.place_id)}
                >
                  <p className="font-medium">{business.name}</p>
                  <p className="text-sm text-gray-400">{business.address}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Business Details */}
        {businessDetails && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <FiMapPin className="mr-2" />
              Business Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-lg">{businessDetails.name}</h3>
                <p className="text-gray-400">{businessDetails.address}</p>
                <p className="text-yellow-400">⭐ {businessDetails.rating} ({businessDetails.review_count} reviews)</p>
                {businessDetails.phone && <p>📞 {businessDetails.phone}</p>}
                {businessDetails.website && (
                  <p>🌐 <a href={businessDetails.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    {businessDetails.website}
                  </a></p>
                )}
              </div>
              <div>
                {businessDetails.business_hours && (
                  <div>
                    <h4 className="font-semibold mb-2">Business Hours:</h4>
                    <div className="text-sm space-y-1">
                      {businessDetails.business_hours.map((hours: string, index: number) => (
                        <p key={index}>{hours}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
