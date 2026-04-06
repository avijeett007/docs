'use client';

import React, { useState, useEffect } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';

export default function CheckPartnerPage() {
  const { branding } = usePartnerBranding();
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPartnerInfo = async () => {
      try {
        const response = await fetch('/api/whitelabel/auth/check-partner');
        const data = await response.json();
        setPartnerInfo(data);
      } catch (error) {
        console.error('Error fetching partner info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPartnerInfo();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: branding.primaryColor }}>
          Partner Information
        </h1>
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: branding.primaryColor }}></div>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Partner Details</h2>
            
            {partnerInfo ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="font-medium mb-2">Request Information</h3>
                    <p><strong>Host:</strong> {partnerInfo.host}</p>
                    <p><strong>URL:</strong> {partnerInfo.url}</p>
                  </div>
                  
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="font-medium mb-2">Partner Headers</h3>
                    <p><strong>Partner ID:</strong> {partnerInfo.partnerId || 'Not set'}</p>
                    <p><strong>Partner Type:</strong> {partnerInfo.partnerType || 'Not set'}</p>
                    <p><strong>Partner Subdomain:</strong> {partnerInfo.partnerSubdomain || 'Not set'}</p>
                  </div>
                </div>
                
                {partnerInfo.partner ? (
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="font-medium mb-2">Partner Database Record</h3>
                    <pre className="bg-gray-800 p-4 rounded-lg overflow-x-auto">
                      {JSON.stringify(partnerInfo.partner, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400">No partner record found in the database.</p>
                  </div>
                )}
                
                <div className="mt-6">
                  <h3 className="font-medium mb-2">All Headers</h3>
                  <pre className="bg-gray-700 p-4 rounded-lg overflow-x-auto">
                    {JSON.stringify(partnerInfo.headers, null, 2)}
                  </pre>
                </div>
              </>
            ) : (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400">Failed to fetch partner information.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
