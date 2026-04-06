'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiArrowRight, FiMessageCircle, FiRefreshCw } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { saveProspectProgress } from '@/lib/prospectTracker';

/**
 * PA Step 4: Personalized Greeting
 * Configure the WhatsApp greeting message for the AI Personal Assistant.
 * Text-based only - no voice preview (unlike AI Receptionist Step6).
 */
export default function PAStep4PersonalizedGreeting() {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Generate default greeting based on business name
  useEffect(() => {
    const businessName = localStorage.getItem('onboarding_businessName') || 'your business';
    const defaultGreeting = `Hi there! 👋 I'm the AI assistant for ${businessName}. I can help you with scheduling, research, email drafting, and much more. How can I help you today?`;
    setGreeting(defaultGreeting);
  }, []);

  const generateNewGreeting = () => {
    const businessName = localStorage.getItem('onboarding_businessName') || 'your business';
    const templates = [
      `Hello! 👋 Welcome to ${businessName}'s AI assistant. I'm here to help with scheduling, tasks, research, and more. What can I do for you?`,
      `Hi! I'm your personal AI assistant from ${businessName}. Whether you need help scheduling meetings, drafting emails, or researching topics - I've got you covered. How can I assist you today?`,
      `Welcome! 🤖 I'm the AI-powered assistant for ${businessName}. I can manage your calendar, draft communications, conduct research, and handle various tasks. What would you like help with?`,
      `Hey there! 👋 I'm your dedicated AI assistant. I help ${businessName} clients with scheduling, task management, research, and more. Let me know how I can help!`,
    ];
    const currentIndex = templates.findIndex(t => t === greeting);
    const nextIndex = (currentIndex + 1) % templates.length;
    setGreeting(templates[nextIndex]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!greeting.trim()) return;
    setIsSubmitting(true);

    try {
      localStorage.setItem('onboarding_greeting', greeting.trim());
      localStorage.setItem('onboarding_greetingType', 'text');

      // Save progress to database
      await saveProspectProgress(6, {
        greetingText: greeting.trim(),
        voiceType: 'text',
      });

      window.location.href = '/assistant/onboarding/5';
    } catch (error) {
      console.error('Error in step 4:', error);
    } finally {
      setIsSubmitting(false);
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
              <div key={s} className={`h-2 w-12 rounded-full ${s <= 4 ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-2">Step 4 of 5</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Customize your greeting</h1>
          <p className="text-gray-600 mb-6">This is the first message your customers will see when they message your AI assistant on WhatsApp.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* WhatsApp Preview */}
            <div className="bg-[#E5DDD5] rounded-xl p-4">
              <div className="bg-white rounded-lg p-3 shadow-sm max-w-[85%] ml-auto">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{greeting || 'Your greeting will appear here...'}</p>
                <p className="text-[10px] text-gray-400 text-right mt-1">Just now ✓✓</p>
              </div>
            </div>

            {/* Greeting textarea */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Greeting Message</label>
                <button type="button" onClick={generateNewGreeting}
                  className="text-emerald-600 text-xs font-medium flex items-center gap-1 hover:text-emerald-700">
                  <FiRefreshCw className="w-3 h-3" /> Try another
                </button>
              </div>
              <textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={4}
                placeholder="Type your greeting message..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none transition-all"
                maxLength={500} />
              <p className="text-gray-400 text-xs text-right mt-1">{greeting.length}/500</p>
            </div>

            <button type="submit" disabled={isSubmitting || !greeting.trim()}
              className="w-full py-3 px-6 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
              style={{ backgroundColor: primaryColor }}>
              {isSubmitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <>Continue <FiArrowRight className="w-5 h-5" /></>}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

