'use client';

import React, { useState } from 'react';
import ToolIntegrationsGrid from '@/components/integrations/ToolIntegrationsGrid';

// TODO: DELETE THIS ENTIRE FILE BEFORE PRODUCTION
// This is a test page for simulating per-customer app selection

const ALL_APPS = [
  { name: 'gmail', label: 'Gmail', category: 'free' },
  { name: 'googlecalendar', label: 'Google Calendar', category: 'free' },
  { name: 'gohighlevel', label: 'GoHighLevel', category: 'paid' },
  { name: 'slack', label: 'Slack', category: 'paid' },
  { name: 'shopify', label: 'Shopify', category: 'paid' },
  { name: 'notion', label: 'Notion', category: 'paid' },
  { name: 'airtable', label: 'Airtable', category: 'paid' },
  { name: 'hubspot', label: 'HubSpot', category: 'paid' },
  { name: 'salesforce', label: 'Salesforce', category: 'paid' },
  { name: 'firecrawl', label: 'Firecrawl', category: 'paid' },
  { name: 'whatsapp', label: 'WhatsApp', category: 'paid' },
];

const PRESETS: Record<string, string[]> = {
  'Free Only': ['gmail', 'googlecalendar'],
  'Free + CRM': ['gmail', 'googlecalendar', 'hubspot', 'salesforce'],
  'All Apps': ALL_APPS.map(a => a.name),
  'None': [],
};

export default function TestTierRestrictionPage() {
  const [selectedApps, setSelectedApps] = useState<string[]>(['gmail', 'googlecalendar']);
  const [useRealApi, setUseRealApi] = useState(false);

  const toggleApp = (appName: string) => {
    setSelectedApps(prev =>
      prev.includes(appName)
        ? prev.filter(a => a !== appName)
        : [...prev, appName]
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">App Selection Test Page</h1>
          <p className="text-gray-400 mb-4">
            Simulate per-customer app selection. Toggle apps below to see how the integration grid changes.
            This page is for development only.
          </p>

          {/* Real API toggle */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setUseRealApi(!useRealApi)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                useRealApi
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {useRealApi ? '🔗 Using Real API' : '🧪 Using Mock Data'}
            </button>
          </div>

          {!useRealApi && (
            <>
              {/* Presets */}
              <div className="flex gap-2 mb-4">
                {Object.entries(PRESETS).map(([label, apps]) => (
                  <button
                    key={label}
                    onClick={() => setSelectedApps(apps)}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* App toggles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-6">
                {ALL_APPS.map(app => (
                  <button
                    key={app.name}
                    onClick={() => toggleApp(app.name)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      selectedApps.includes(app.name)
                        ? app.category === 'free'
                          ? 'bg-green-600/20 border-green-500/40 text-green-400'
                          : 'bg-amber-600/20 border-amber-500/40 text-amber-400'
                        : 'bg-gray-800/50 border-gray-700/50 text-gray-500'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      selectedApps.includes(app.name) ? 'bg-current' : 'bg-gray-600'
                    }`} />
                    {app.label}
                    <span className="text-xs opacity-60">({app.category})</span>
                  </button>
                ))}
              </div>

              <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 mb-6">
                <p className="text-sm text-gray-300">
                  <strong>Selected Apps ({selectedApps.length}):</strong>{' '}
                  {selectedApps.length === 0
                    ? 'None — grid will show all apps (no filtering)'
                    : selectedApps.join(', ')}
                </p>
              </div>
            </>
          )}
        </div>

        <ToolIntegrationsGrid testAllowedApps={useRealApi ? null : selectedApps} />
      </div>
    </div>
  );
}
