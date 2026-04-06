'use client';

import React, { useState } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';

export default function TestCredentialsPage() {
  const { branding } = usePartnerBranding();
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkCredentials = async () => {
    if (!email) {
      alert('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/whitelabel/auth/check-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error checking credentials:', error);
      setResult({ error: 'Failed to check credentials' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: branding.primaryColor }}>
          Test Customer Credentials
        </h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Email Address
            </label>
            <div className="flex">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-l-lg focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800"
                placeholder="customer@example.com"
              />
              <button
                onClick={checkCredentials}
                disabled={loading}
                className="px-4 py-2 rounded-r-lg font-medium text-white disabled:opacity-70"
                style={{ backgroundColor: branding.primaryColor }}
              >
                {loading ? 'Checking...' : 'Check'}
              </button>
            </div>
          </div>
        </div>

        {result && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Results</h2>
            
            {result.found ? (
              <div>
                <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-green-400 font-medium">Credentials found!</p>
                  {result.testPassword && (
                    <p className="mt-2">
                      Test password: <span className="font-mono bg-gray-700 px-2 py-1 rounded">{result.testPassword}</span>
                    </p>
                  )}
                </div>
                
                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-2">Credential Details</h3>
                  <pre className="bg-gray-700 p-4 rounded-lg overflow-x-auto">
                    {JSON.stringify(result.credential, null, 2)}
                  </pre>
                </div>
                
                {result.customer && (
                  <div className="mt-4">
                    <h3 className="text-lg font-medium mb-2">Customer Details</h3>
                    <pre className="bg-gray-700 p-4 rounded-lg overflow-x-auto">
                      {JSON.stringify(result.customer, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400">No credentials found for this email address.</p>
                {result.details && (
                  <pre className="mt-2 bg-gray-700 p-4 rounded-lg overflow-x-auto">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
