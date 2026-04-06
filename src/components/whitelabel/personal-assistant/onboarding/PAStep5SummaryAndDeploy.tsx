'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiZap, FiMessageCircle, FiUser, FiGlobe, FiFileText, FiEdit2 } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { saveProspectProgress } from '@/lib/prospectTracker';

/**
 * PA Step 5: Summary & Deploy
 * Review all information and deploy the AI Personal Assistant.
 * On success, shows the WhatsApp number to message.
 */
export default function PAStep5SummaryAndDeploy() {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [assignedWhatsAppNumber, setAssignedWhatsAppNumber] = useState('');

  // Collected data from previous steps
  const [summaryData, setSummaryData] = useState({
    businessName: '', website: '', firstName: '', lastName: '',
    email: '', whatsappNumber: '', greeting: '', hasKnowledgeBase: false,
  });

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const hostname = window.location.hostname;
        let subdomain = '';
        if (hostname.includes('.lvh.me')) subdomain = hostname.split('.')[0];
        else if (hostname.includes('.knotie-ai.pro')) subdomain = hostname.split('.')[0];
        else if (hostname !== 'localhost' && hostname !== '127.0.0.1') subdomain = hostname;
        if (!subdomain) throw new Error('Unable to determine partner');

        const response = await fetch(`/api/whitelabel/branding/${subdomain}`);
        if (!response.ok) throw new Error('Failed to fetch branding');
        setBranding(await response.json());
      } catch (err) {
        console.error('Error fetching branding:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBranding();
  }, []);

  // Load summary data from localStorage
  useEffect(() => {
    setSummaryData({
      businessName: localStorage.getItem('onboarding_businessName') || '',
      website: localStorage.getItem('onboarding_website') || '',
      firstName: localStorage.getItem('onboarding_firstName') || '',
      lastName: localStorage.getItem('onboarding_lastName') || '',
      email: localStorage.getItem('onboarding_email') || '',
      whatsappNumber: localStorage.getItem('onboarding_whatsappNumber') || '',
      greeting: localStorage.getItem('onboarding_greeting') || '',
      hasKnowledgeBase: !!localStorage.getItem('onboarding_knowledgeBaseId'),
    });
  }, []);

  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentStatus('deploying');
    setError('');

    try {
      const prospectId = localStorage.getItem('onboarding_prospectId');
      if (!prospectId || !branding?.id) {
        throw new Error('Required onboarding data not found. Please complete all previous steps.');
      }

      // Call the complete-onboarding API
      const response = await fetch('/api/whitelabel/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId,
          partnerId: branding.id,
          experienceType: 'AI_PERSONAL_ASSISTANT',
          greeting: summaryData.greeting,
          businessName: summaryData.businessName,
          knowledgeBaseId: localStorage.getItem('onboarding_knowledgeBaseId') || null,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Deployment failed');
      }

      const result = await response.json();
      setDeploymentStatus('success');

      // The API may return an assigned WhatsApp number
      if (result.whatsappNumber) {
        setAssignedWhatsAppNumber(result.whatsappNumber);
      }

      // Save deployment status
      await saveProspectProgress(9, {
        isCompleted: true,
        currentStep: 9,
      });
    } catch (err) {
      console.error('Deployment error:', err);
      setDeploymentStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong during deployment');
    } finally {
      setIsDeploying(false);
    }
  };

  if (loading || !branding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const primaryColor = branding.primaryColor || '#10B981';

  // Success state
  if (deploymentStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Your AI Assistant is Live! 🎉</h1>
            <p className="text-gray-600 mb-6">Your AI Personal Assistant has been deployed and is ready to help your customers.</p>

            {assignedWhatsAppNumber && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-emerald-700 font-medium mb-1">Your WhatsApp Number</p>
                <p className="text-2xl font-bold text-emerald-800">{assignedWhatsAppNumber}</p>
                <p className="text-xs text-emerald-600 mt-1">Share this number with your customers</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {assignedWhatsAppNumber && (
                <a href={`https://wa.me/${assignedWhatsAppNumber.replace(/[^0-9]/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full py-3 px-6 bg-[#25D366] text-white font-semibold rounded-xl hover:bg-[#20BD5A] transition-all flex items-center justify-center gap-2">
                  <FiMessageCircle className="w-5 h-5" /> Message Your Assistant
                </a>
              )}
              <a href="/whitelabel/dashboard"
                className="w-full py-3 px-6 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryColor }}>
                Go to Dashboard
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (deploymentStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiZap className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Deployment Failed</h1>
            <p className="text-red-600 mb-6">{error || 'Something went wrong. Please try again.'}</p>
            <button onClick={() => { setDeploymentStatus('idle'); setError(''); }}
              className="w-full py-3 px-6 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              style={{ backgroundColor: primaryColor }}>
              Try Again
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main idle/deploying state - Summary view
  const summaryCards = [
    { icon: <FiGlobe className="w-5 h-5" />, label: 'Business', value: summaryData.businessName || 'Not provided', sub: summaryData.website || 'No website', editStep: 1 },
    { icon: <FiUser className="w-5 h-5" />, label: 'Contact', value: `${summaryData.firstName} ${summaryData.lastName}`.trim() || 'Not provided', sub: summaryData.email || 'No email', editStep: 2 },
    { icon: <FiFileText className="w-5 h-5" />, label: 'Knowledge Base', value: summaryData.hasKnowledgeBase ? 'Configured' : 'Skipped', sub: summaryData.hasKnowledgeBase ? 'Documents uploaded' : 'You can add later', editStep: 3 },
    { icon: <FiMessageCircle className="w-5 h-5" />, label: 'Greeting', value: summaryData.greeting ? 'Customized' : 'Default', sub: summaryData.greeting ? summaryData.greeting.substring(0, 60) + (summaryData.greeting.length > 60 ? '...' : '') : 'Using default greeting', editStep: 4 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 text-emerald-700 text-sm font-medium mb-2">
            <FiMessageCircle className="w-4 h-4" /> AI Personal Assistant Setup
          </div>
          <div className="flex gap-2 justify-center">
            {[1,2,3,4,5].map(s => (
              <div key={s} className={`h-2 w-12 rounded-full bg-emerald-500`} />
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-2">Step 5 of 5</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Review & Deploy</h1>
          <p className="text-gray-600 mb-6">Review your setup and deploy your AI Personal Assistant.</p>

          {/* Summary Cards */}
          <div className="space-y-3 mb-6">
            {summaryCards.map((card, i) => (
              <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 flex-shrink-0">
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{card.value}</p>
                  <p className="text-xs text-gray-500 truncate">{card.sub}</p>
                </div>
                <button onClick={() => window.location.href = `/assistant/onboarding/${card.editStep}`}
                  className="text-gray-400 hover:text-emerald-600 transition-colors p-1 flex-shrink-0">
                  <FiEdit2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* WhatsApp Number Display */}
          {summaryData.whatsappNumber && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-6 flex items-center gap-3">
              <FiMessageCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-emerald-700 font-medium">Your WhatsApp</p>
                <p className="text-sm font-semibold text-emerald-800">{summaryData.whatsappNumber}</p>
              </div>
            </div>
          )}

          {/* Deploy Button */}
          <button onClick={handleDeploy} disabled={isDeploying}
            className="w-full py-4 px-6 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-lg text-lg"
            style={{ backgroundColor: primaryColor }}>
            {isDeploying ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                Deploying your assistant...
              </>
            ) : (
              <>
                <FiZap className="w-5 h-5" /> Deploy AI Assistant
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">
            Your assistant will be ready in seconds
          </p>
        </div>
      </motion.div>
    </div>
  );
}
