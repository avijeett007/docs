'use client';

import { useState } from 'react';
import MigrationWarningPopup from '@/components/notifications/MigrationWarningPopup';

export default function TestMigrationPopup() {
  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState<'existing' | 'new'>('existing');

  const handleResetMigrationStatus = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        alert('Please login as a partner first');
        return;
      }

      const response = await fetch('/api/test-migration-popup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Migration status reset! Now go to /partner/dashboard to see the popup.');
      } else {
        alert('Failed to reset migration status');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error resetting migration status');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Test Migration Popup</h1>
        
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Method 1: Reset Migration Status</h2>
            <p className="text-gray-600 mb-4">
              This will reset your migration status so the popup shows on the partner dashboard.
            </p>
            <button
              onClick={handleResetMigrationStatus}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Reset Migration Status
            </button>
          </div>

          <hr />

          <div>
            <h2 className="text-xl font-semibold mb-4">Method 2: Preview Popup Directly</h2>
            <p className="text-gray-600 mb-4">
              Preview the popup components directly on this page.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Popup Type:</label>
                <select
                  value={popupType}
                  onChange={(e) => setPopupType(e.target.value as 'existing' | 'new')}
                  className="border border-gray-300 rounded px-3 py-2"
                >
                  <option value="existing">Existing Partner (Migration Warning)</option>
                  <option value="new">New Partner (Welcome Message)</option>
                </select>
              </div>
              
              <button
                onClick={() => setShowPopup(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Show Popup Preview
              </button>
            </div>
          </div>

          <hr />

          <div>
            <h2 className="text-xl font-semibold mb-4">Method 3: Direct Dashboard Access</h2>
            <p className="text-gray-600 mb-4">
              If you're logged in as a partner with agents, go directly to the dashboard:
            </p>
            <a
              href="/partner/dashboard"
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 inline-block"
            >
              Go to Partner Dashboard
            </a>
          </div>

          <hr />

          <div>
            <h2 className="text-xl font-semibold mb-4">How the Popup Logic Works</h2>
            <div className="text-sm text-gray-600 space-y-2">
              <p><strong>The popup shows when:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Partner has agents (VAPI or Retell)</li>
                <li>Agents don't have individual API keys (apiKey is null)</li>
                <li>Warning hasn't been shown today</li>
                <li>Migration hasn't been marked as completed</li>
              </ul>
              
              <p className="mt-4"><strong>For new partners:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Shows welcome message instead of migration warning</li>
                <li>No agents = first-time user experience</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Popup Preview */}
      {showPopup && (
        <MigrationWarningPopup
          partnerId="test-partner-id"
          hasAgents={popupType === 'existing'}
          isFirstTimeUser={popupType === 'new'}
          onDismiss={() => setShowPopup(false)}
        />
      )}
    </div>
  );
}
