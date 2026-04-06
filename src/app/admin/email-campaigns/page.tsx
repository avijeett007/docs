'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EmailCampaign from '@/components/admin/EmailCampaign';
import AdminNavigation from '@/components/admin/AdminNavigation';
import { Recipient } from '@/lib/emailCampaigns';

export default function EmailCampaignsPage() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch recipients on component mount
  useEffect(() => {
    const fetchRecipients = async () => {
      try {
        setLoading(true);
        
        // Fetch partners
        const partnersResponse = await fetch('/api/admin/recipients?type=partner');
        
        if (!partnersResponse.ok) {
          console.error(`Error fetching partners: ${partnersResponse.status}`);
        }
        
        // Fetch waitlist members
        const waitlistResponse = await fetch('/api/admin/recipients?type=waitlist');
        
        if (!waitlistResponse.ok) {
          console.error(`Error fetching waitlist: ${waitlistResponse.status}`);
        }
        
        // Process responses
        let allRecipients: Recipient[] = [];
        
        if (partnersResponse.ok) {
          const partnersData = await partnersResponse.json();
          allRecipients = [...allRecipients, ...(partnersData.recipients || [])];
        }
        
        if (waitlistResponse.ok) {
          const waitlistData = await waitlistResponse.json();
          allRecipients = [...allRecipients, ...(waitlistData.recipients || [])];
        }
        
        // If both requests failed
        if (!partnersResponse.ok && !waitlistResponse.ok) {
          throw new Error('Failed to fetch recipients');
        }
        
        setRecipients(allRecipients);
        setError(null);
        
        console.log(`Loaded ${allRecipients.length} recipients`);
      } catch (err: any) {
        console.error('Error fetching recipients:', err);
        setError(err.message || 'Failed to fetch recipients');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipients();
  }, []);

  // Send email campaign
  const handleSendCampaign = async (campaignData: any) => {
    try {
      console.log(`Sending campaign to ${campaignData.recipients.length} recipients`);
      
      const response = await fetch('/api/admin/email-campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(campaignData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Campaign error response:', errorData);
        throw new Error(errorData.error || 'Failed to send campaign');
      }

      const result = await response.json();
      console.log('Campaign sent successfully:', result);
      
      return { 
        success: true, 
        sent: result.success || 0,
        failed: result.failed || 0,
        errors: result.errors || []
      };
    } catch (err: any) {
      console.error('Error sending campaign:', err);
      return { 
        success: false, 
        error: err.message,
        errors: [err.message]
      };
    }
  };

  // Generate email content with AI
  const handleGenerateWithAI = async (prompt: string, templateType: string) => {
    try {
      const response = await fetch('/api/admin/email-campaigns', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, templateType }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate content');
      }

      const result = await response.json();
      return result.content || '';
    } catch (err: any) {
      console.error('Error generating content with AI:', err);
      return `Error generating content: ${err.message}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      <AdminNavigation />
      <div className="admin-content-wrapper">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-gray-900/50 rounded-lg shadow-xl p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Email Campaigns</h1>
              <p className="text-gray-400">
                Create and send email campaigns to partners and waitlist members
              </p>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <p>Loading recipients...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p className="error-message">{error}</p>
              <button 
                className="btn btn-primary" 
                onClick={() => router.refresh()}
              >
                Retry
              </button>
            </div>
          ) : (
            <EmailCampaign
              recipients={recipients}
              onSendCampaign={handleSendCampaign}
              onGenerateWithAI={handleGenerateWithAI}
            />
          )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .admin-content-wrapper {
          margin-left: 240px;
          width: calc(100% - 240px);
        }
        .loading-state,
        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          background-color: #1f2937;
          border-radius: 0.5rem;
          text-align: center;
          margin-top: 2rem;
        }
        
        .error-message {
          color: #ef4444;
          margin-bottom: 1rem;
        }
        
        .btn {
          display: inline-flex;
          align-items: center;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
        }
        
        .btn-primary {
          background-color: #3b82f6;
          color: white;
          border: none;
        }
      `}</style>
    </div>
  );
}
