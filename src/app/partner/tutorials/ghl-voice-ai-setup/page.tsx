'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft, FiCopy, FiCheck, FiExternalLink, FiPlay, FiBook, FiKey } from 'react-icons/fi';
import clsx from 'clsx';
import NeonContainer from '@/components/NeonContainer';
import PartnerSidebar from '@/components/partner/PartnerSidebar';
import { toast, Toaster } from 'react-hot-toast';
import tutorialContent from '@/data/ghl-tutorial-content.json';

export default function GHLVoiceAISetupTutorial() {
  const router = useRouter();
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [partnerName] = useState('');

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const { webhookUrl } = tutorialContent;

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" />
      <PartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
      
      <div className="ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <FiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                {tutorialContent.title}
              </h1>
              <p className="text-gray-400 mt-2">
                {tutorialContent.subtitle}
              </p>
            </div>
          </div>

          {/* Video Section */}
          <NeonContainer className="mb-8">
            <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center mb-4">
              {tutorialContent.video.url ? (
                <iframe
                  src={tutorialContent.video.url}
                  className="w-full h-full rounded-lg"
                  allowFullScreen
                  title="GHL Voice AI Setup Tutorial"
                />
              ) : (
                <div className="text-center">
                  <FiPlay className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                  <p className="text-gray-400">{tutorialContent.video.placeholder.title}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {tutorialContent.video.placeholder.subtitle}
                  </p>
                </div>
              )}
            </div>
          </NeonContainer>

          {/* Prerequisites */}
          <NeonContainer className="mb-8 p-6">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <FiBook className="w-5 h-5 text-blue-400" />
              {tutorialContent.prerequisites.title}
            </h2>
            <ul className="space-y-3 text-gray-300 pl-2">
              {tutorialContent.prerequisites.items.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                  {item}
                </li>
              ))}
            </ul>
          </NeonContainer>

          {/* Step 1: Create API Key */}
          <NeonContainer className="mb-8 p-6">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">1</span>
              Create API Key
            </h2>
            <div className="space-y-4 pl-2">
              <p className="text-gray-300">
                First, you need to create an API key in your Knotie AI Pro partner dashboard.
              </p>
              <div className="bg-gray-900 rounded-lg p-6">
                <ol className="space-y-3 text-sm text-gray-300 pl-2">
                  <li>1. Navigate to Settings → API Keys in your partner dashboard</li>
                  <li>2. Click "Create New API Key"</li>
                  <li>3. Give it a name like "GHL Voice AI Integration"</li>
                  <li>4. Copy and save the API key securely</li>
                </ol>
              </div>
              <button
                onClick={() => router.push('/partner/settings/api-keys')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                <FiKey className="w-4 h-4" />
                Go to API Keys
                <FiExternalLink className="w-4 h-4" />
              </button>
            </div>
          </NeonContainer>

          {/* Step 2: Configure GHL Workflow */}
          <NeonContainer className="mb-8 p-6">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">2</span>
              Configure GHL Workflow
            </h2>
            <div className="space-y-4 pl-2">
              <p className="text-gray-300">
                Set up a workflow in Go High Level to send webhook data after each voice AI call.
              </p>
              
              <div className="bg-gray-900 rounded-lg p-6">
                <h3 className="font-medium text-white mb-4">Workflow Setup Steps:</h3>
                <ol className="space-y-3 text-sm text-gray-300 pl-2">
                  <li>1. Go to Automations → Workflows in your GHL account</li>
                  <li>2. Create a new workflow or edit existing one</li>
                  <li>3. Set trigger to "Voice AI Call Completed"</li>
                  <li>4. Add "Send Webhook" action</li>
                  <li>5. Configure webhook with the details below</li>
                </ol>
              </div>

              <div className="bg-gray-900 rounded-lg p-6">
                <h3 className="font-medium text-white mb-4">Webhook Configuration:</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Webhook URL:
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-black rounded border border-gray-700 text-green-400 text-sm">
                        {webhookUrl}
                      </code>
                      <button
                        onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                        className="p-2 rounded hover:bg-gray-800 transition-colors"
                      >
                        {copiedText === 'Webhook URL' ? (
                          <FiCheck className="w-4 h-4 text-green-400" />
                        ) : (
                          <FiCopy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      HTTP Method:
                    </label>
                    <code className="px-3 py-2 bg-black rounded border border-gray-700 text-blue-400 text-sm">
                      POST
                    </code>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Content Type:
                    </label>
                    <code className="px-3 py-2 bg-black rounded border border-gray-700 text-blue-400 text-sm">
                      application/json
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </NeonContainer>

          {/* Step 3: Custom Data Configuration */}
          <NeonContainer className="mb-8 p-6">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">3</span>
              Custom Data Configuration
            </h2>
            <div className="space-y-4 pl-2">
              <p className="text-gray-300">
                Configure the custom data that will be sent with each webhook. This data is crucial for proper tracking and billing.
              </p>
              
              <div className="bg-gray-900 rounded-lg p-6">
                <h3 className="font-medium text-white mb-4">Required Custom Data Fields:</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        transcripts:
                      </label>
                      <code className="text-xs text-green-400">{'{{call.transcript}}'}</code>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        duration:
                      </label>
                      <code className="text-xs text-green-400">{'{{call.duration}}'}</code>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        summary:
                      </label>
                      <code className="text-xs text-green-400">{'{{call.summary}}'}</code>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        agent_id:
                      </label>
                      <code className="text-xs text-amber-400">your_unique_agent_id</code>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        partner_email_id:
                      </label>
                      <code className="text-xs text-amber-400">your_partner_email@example.com</code>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        api_key:
                      </label>
                      <code className="text-xs text-amber-400">your_knotie_api_key</code>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        base_per_minute_cost:
                      </label>
                      <code className="text-xs text-amber-400">10</code>
                      <p className="text-xs text-gray-500 mt-1">(cost in cents)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <h3 className="font-medium text-amber-400 mb-2">Important Notes:</h3>
                <ul className="space-y-1 text-sm text-amber-200">
                  <li>• Replace yellow highlighted values with your actual data</li>
                  <li>• Use the same partner email as your Knotie AI Pro account</li>
                  <li>• agent_id should be unique for each voice AI agent</li>
                  <li>• base_per_minute_cost is in cents (10 = $0.10 per minute)</li>
                </ul>
              </div>
            </div>
          </NeonContainer>

          {/* Step 4: Testing */}
          <NeonContainer className="mb-8 p-6">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">4</span>
              Test Your Integration
            </h2>
            <div className="space-y-4 pl-2">
              <p className="text-gray-300">
                Test your integration to ensure everything is working correctly.
              </p>
              
              <div className="bg-gray-900 rounded-lg p-6">
                <h3 className="font-medium text-white mb-4">Testing Steps:</h3>
                <ol className="space-y-3 text-sm text-gray-300 pl-2">
                  <li>1. Make a test call using your GHL Voice AI agent</li>
                  <li>2. Complete the call normally</li>
                  <li>3. Check your GHL workflow logs for webhook delivery</li>
                  <li>4. Verify the agent appears in your Knotie AI Pro dashboard</li>
                  <li>5. Check analytics data is being recorded</li>
                </ol>
              </div>

              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <h3 className="font-medium text-green-400 mb-2">Success Indicators:</h3>
                <ul className="space-y-1 text-sm text-green-200">
                  <li>• Agent appears in GHL Voice AI Agents page</li>
                  <li>• Call analytics are recorded</li>
                  <li>• Credits are deducted from your balance</li>
                  <li>• Transcript data is captured</li>
                </ul>
              </div>
            </div>
          </NeonContainer>

          {/* Support */}
          <NeonContainer className="mb-8 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Need Help?</h2>
            <p className="text-gray-300 mb-4">
              If you encounter any issues during setup, our support team is here to help.
            </p>
            <div className="flex gap-4">
              <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
                Contact Support
              </button>
              <button 
                onClick={() => router.push('/partner/ai-agents/ghl')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                View GHL Agents
              </button>
            </div>
          </NeonContainer>
        </div>
      </div>
    </div>
  );
}
