'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiArrowRight, FiUpload, FiGlobe, FiFileText, FiX, FiPlus, FiMessageCircle, FiSkipForward } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { getBusinessInfo } from '@/lib/onboarding-storage';

/**
 * PA Step 3: Knowledge Base
 * Upload documents or provide website URLs for the AI assistant to learn from.
 * Simplified version - no language system, WhatsApp-focused messaging.
 */
export default function PAStep3KnowledgeBase() {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'upload' | 'website'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [websiteUrls, setWebsiteUrls] = useState<string[]>(['']);
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

  // Auto-populate website URL from Step 1
  useEffect(() => {
    const businessInfo = getBusinessInfo();
    let savedWebsite = businessInfo?.website || localStorage.getItem('onboarding_website') || '';
    if (savedWebsite && savedWebsite.trim() !== '') {
      let fullUrl = savedWebsite.trim();
      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        fullUrl = `https://${fullUrl}`;
      }
      setWebsiteUrls(current => (current.length === 1 && current[0] === '') ? [fullUrl] : current);
    }
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  const addWebsiteUrl = () => setWebsiteUrls(prev => [...prev, '']);
  const updateWebsiteUrl = (index: number, url: string) => setWebsiteUrls(prev => prev.map((u, i) => i === index ? url : u));
  const removeWebsiteUrl = (index: number) => setWebsiteUrls(prev => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const prospectToken = localStorage.getItem('onboarding_prospectToken') || localStorage.getItem('prospect_token');
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (prospectToken) authHeaders['Authorization'] = `Bearer ${prospectToken}`;

      // Create or get knowledge base
      let knowledgeBaseId: string;
      const kbListResponse = await fetch('/api/whitelabel/knowledge-base', { headers: authHeaders });

      if (kbListResponse.ok) {
        const kbData = await kbListResponse.json();
        const existingKB = kbData.knowledgeBases?.find((kb: any) => kb.name === 'Onboarding Knowledge Base');
        if (existingKB) {
          knowledgeBaseId = existingKB.id;
        } else {
          const createKBResponse = await fetch('/api/whitelabel/knowledge-base', {
            method: 'POST', headers: authHeaders,
            body: JSON.stringify({ name: 'Onboarding Knowledge Base', description: 'Knowledge base created during PA onboarding' })
          });
          if (!createKBResponse.ok) throw new Error('Failed to create knowledge base');
          const newKB = await createKBResponse.json();
          knowledgeBaseId = newKB.knowledgeBase.id;
        }
      } else {
        throw new Error('Failed to access knowledge base system');
      }

      // Upload files
      if (uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('knowledgeBaseId', knowledgeBaseId);
          const uploadHeaders: Record<string, string> = {};
          if (prospectToken) uploadHeaders['Authorization'] = `Bearer ${prospectToken}`;
          await fetch('/api/whitelabel/knowledge-base/upload', { method: 'POST', headers: uploadHeaders, body: formData });
        }
      }

      // Add website URLs
      const validUrls = websiteUrls.filter(url => url.trim() !== '');
      if (validUrls.length > 0) {
        for (const url of validUrls) {
          let fullUrl = url.trim();
          if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) fullUrl = `https://${fullUrl}`;
          await fetch('/api/whitelabel/knowledge-base/website', {
            method: 'POST', headers: authHeaders,
            body: JSON.stringify({ knowledgeBaseId, url: fullUrl })
          });
        }
      }

      localStorage.setItem('onboarding_knowledgeBaseId', knowledgeBaseId);
      window.location.href = '/assistant/onboarding/4';
    } catch (error) {
      console.error('Error in step 3:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => { window.location.href = '/assistant/onboarding/4'; };

  if (loading || !branding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const primaryColor = branding.primaryColor || '#10B981';
  const hasContent = uploadedFiles.length > 0 || websiteUrls.some(u => u.trim() !== '');

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
              <div key={s} className={`h-2 w-12 rounded-full ${s <= 3 ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-2">Step 3 of 5</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Train your assistant</h1>
          <p className="text-gray-600 mb-6">Upload documents or add your website so your AI assistant can learn about your business.</p>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button onClick={() => setSelectedTab('upload')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${selectedTab === 'upload' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              <FiUpload className="inline w-4 h-4 mr-1" /> Upload Files
            </button>
            <button onClick={() => setSelectedTab('website')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${selectedTab === 'website' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              <FiGlobe className="inline w-4 h-4 mr-1" /> Website URL
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {selectedTab === 'upload' && (
              <div>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-emerald-400 transition-colors bg-gray-50">
                  <FiUpload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Click to upload PDF, DOC, or TXT files</span>
                  <input type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.txt,.csv" onChange={handleFileUpload} />
                </label>
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadedFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <FiFileText className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm text-gray-700 truncate max-w-[200px]">{file.name}</span>
                          <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
                        </div>
                        <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500"><FiX className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedTab === 'website' && (
              <div className="space-y-3">
                {websiteUrls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="relative flex-1">
                      <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input type="text" value={url} onChange={(e) => updateWebsiteUrl(i, e.target.value)}
                        placeholder="https://yourwebsite.com" className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                    </div>
                    {websiteUrls.length > 1 && (
                      <button type="button" onClick={() => removeWebsiteUrl(i)} className="text-gray-400 hover:text-red-500 px-2"><FiX className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addWebsiteUrl} className="text-emerald-600 text-sm font-medium flex items-center gap-1 hover:text-emerald-700">
                  <FiPlus className="w-4 h-4" /> Add another URL
                </button>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={handleSkip}
                className="flex-1 py-3 px-6 border border-gray-300 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                <FiSkipForward className="w-4 h-4" /> Skip for now
              </button>
              <button type="submit" disabled={isSubmitting || !hasContent}
                className="flex-1 py-3 px-6 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
                style={{ backgroundColor: primaryColor }}>
                {isSubmitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <>Continue <FiArrowRight className="w-5 h-5" /></>}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

