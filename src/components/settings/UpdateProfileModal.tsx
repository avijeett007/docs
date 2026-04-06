'use client';

import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiAlertCircle, FiInfo } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import NeonContainer from '@/components/NeonContainer';

interface UpdateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerProfile: {
    businessName: string;
    contactName: string;
    businessAddress: string;
    emailAddress: string;
    phoneNumber: string;
    areaOfBusiness: string;
    expertise: string;
    partnershipType: string;
    ghlCalendarId: string | null;
    ghlLocationId: string | null;
    ghlApiKey: string | null;
    vapiApiKey: string | null;
    retellApiKey: string | null;
    ultravoxApiKey: string | null;
  } | null;
  onSuccess: (updatedProfile: any) => void;
}

export default function UpdateProfileModal({
  isOpen,
  onClose,
  partnerProfile,
  onSuccess
}: UpdateProfileModalProps) {
  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    businessAddress: '',
    emailAddress: '',
    phoneNumber: '',
    areaOfBusiness: '',
    expertise: '',
    partnershipType: '',
    ghlCalendarId: '',
    ghlLocationId: '',
    ghlApiKey: '',
    vapiApiKey: '',
    retellApiKey: '',
    ultravoxApiKey: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'integration'>('profile');
  const [hasVapiKey, setHasVapiKey] = useState(false);
  const [hasGhlKey, setHasGhlKey] = useState(false);
  const [hasRetellKey, setHasRetellKey] = useState(false);
  const [hasUltravoxKey, setHasUltravoxKey] = useState(false);

  useEffect(() => {
    if (partnerProfile) {
      setFormData({
        businessName: partnerProfile.businessName || '',
        contactName: partnerProfile.contactName || '',
        businessAddress: partnerProfile.businessAddress || '',
        emailAddress: partnerProfile.emailAddress || '',
        phoneNumber: partnerProfile.phoneNumber || '',
        areaOfBusiness: partnerProfile.areaOfBusiness || '',
        expertise: partnerProfile.expertise || '',
        partnershipType: partnerProfile.partnershipType || '',
        ghlCalendarId: partnerProfile.ghlCalendarId || '',
        ghlLocationId: partnerProfile.ghlLocationId || '',
        ghlApiKey: '',
        vapiApiKey: '',
        retellApiKey: '',
        ultravoxApiKey: ''
      });
    }
  }, [partnerProfile]);

  useEffect(() => {
    if (partnerProfile) {
      setHasVapiKey(!!partnerProfile.vapiApiKey);
      setHasGhlKey(!!partnerProfile.ghlApiKey);
      setHasRetellKey(!!partnerProfile.retellApiKey);
      setHasUltravoxKey(!!partnerProfile.ultravoxApiKey);
    }
  }, [partnerProfile]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      interface SubmissionData {
        businessName: string;
        contactName: string;
        businessAddress: string;
        emailAddress: string;
        phoneNumber: string;
        areaOfBusiness: string;
        expertise: string;
        partnershipType: string;
        ghlCalendarId: string;
        ghlLocationId?: string;
        ghlApiKey?: string;
        vapiApiKey?: string;
        retellApiKey?: string;
        ultravoxApiKey?: string;
      }

      const submissionData: SubmissionData = {
        businessName: formData.businessName,
        contactName: formData.contactName,
        businessAddress: formData.businessAddress,
        emailAddress: formData.emailAddress,
        phoneNumber: formData.phoneNumber,
        areaOfBusiness: formData.areaOfBusiness,
        expertise: formData.expertise,
        partnershipType: formData.partnershipType,
        ghlCalendarId: formData.ghlCalendarId,
      };

      if (formData.vapiApiKey && formData.vapiApiKey !== '') {
        console.log('[UpdateProfileModal] Validating VAPI API key - length:', formData.vapiApiKey.length);
        try {
          const vapiResponse = await fetch('https://api.vapi.ai/assistant', {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${formData.vapiApiKey}`
            }
          });

          console.log('[UpdateProfileModal] VAPI validation response status:', vapiResponse.status);
          
          if (!vapiResponse.ok) {
            console.error('[UpdateProfileModal] VAPI validation failed with status:', vapiResponse.status);
            throw new Error('Invalid VAPI API key. Please check and try again.');
          }

          submissionData.vapiApiKey = formData.vapiApiKey;
          console.log('[UpdateProfileModal] VAPI API key validated successfully');
        } catch (error) {
          console.error('[UpdateProfileModal] VAPI validation error:', error);
          throw new Error('Invalid VAPI API key. Please check and try again.');
        }
      }

      if (formData.retellApiKey && formData.retellApiKey !== '') {
        console.log('[UpdateProfileModal] Validating Retell API key - length:', formData.retellApiKey.length);
        try {
          // Use a simple fetch to validate the Retell API key
          const retellResponse = await fetch('https://api.retellai.com/list-agents', {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${formData.retellApiKey}`
            }
          });

          console.log('[UpdateProfileModal] Retell validation response status:', retellResponse.status);
          
          if (!retellResponse.ok) {
            console.error('[UpdateProfileModal] Retell validation failed with status:', retellResponse.status);
            throw new Error('Invalid Retell API key. Please check and try again.');
          }

          submissionData.retellApiKey = formData.retellApiKey;
          console.log('[UpdateProfileModal] Retell API key validated successfully');
        } catch (error) {
          console.error('[UpdateProfileModal] Retell validation error:', error);
          throw new Error('Invalid Retell API key. Please check and try again.');
        }
      }

      if (formData.ultravoxApiKey && formData.ultravoxApiKey !== '') {
        console.log('[UpdateProfileModal] Validating Ultravox API key - length:', formData.ultravoxApiKey.length);
        try {
          // Use a simple fetch to validate the Ultravox API key
          const ultravoxResponse = await fetch('https://api.ultravox.ai/api/agents', {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'X-API-Key': formData.ultravoxApiKey
            }
          });

          console.log('[UpdateProfileModal] Ultravox validation response status:', ultravoxResponse.status);

          if (!ultravoxResponse.ok) {
            console.error('[UpdateProfileModal] Ultravox validation failed with status:', ultravoxResponse.status);
            throw new Error('Invalid Ultravox API key. Please check and try again.');
          }

          submissionData.ultravoxApiKey = formData.ultravoxApiKey;
          console.log('[UpdateProfileModal] Ultravox API key validated successfully');
        } catch (error) {
          console.error('[UpdateProfileModal] Ultravox validation error:', error);
          throw new Error('Invalid Ultravox API key. Please check and try again.');
        }
      }

      if (formData.ghlApiKey && formData.ghlApiKey !== '') {
        console.log('[UpdateProfileModal] Validating GHL API key - length:', formData.ghlApiKey.length);

        // Check if location ID is provided
        if (!formData.ghlLocationId || formData.ghlLocationId.trim() === '') {
          throw new Error('GHL Location ID is required when setting GHL API key. Please enter your Location ID.');
        }

        try {
          // Use the contacts endpoint to validate the GHL API key with location ID
          // Location ID is passed as a query parameter, not in the path
          const ghlResponse = await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${formData.ghlLocationId}&limit=1`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${formData.ghlApiKey}`,
              'Version': '2021-07-28'
            }
          });

          console.log('[UpdateProfileModal] GHL validation response status:', ghlResponse.status);

          if (!ghlResponse.ok) {
            const errorText = await ghlResponse.text();
            console.error('[UpdateProfileModal] GHL validation failed:', {
              status: ghlResponse.status,
              error: errorText
            });
            throw new Error('Invalid GHL API key or Location ID. Please check both values and try again.');
          }

          submissionData.ghlApiKey = formData.ghlApiKey;
          submissionData.ghlLocationId = formData.ghlLocationId;
          console.log('[UpdateProfileModal] GHL API key and Location ID validated successfully');
        } catch (error) {
          console.error('[UpdateProfileModal] GHL validation error:', error);
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('Invalid GHL API key or Location ID. Please check both values and try again.');
        }
      }

      const response = await fetch('/api/partner/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('partner_token')}`
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const updatedProfile = await response.json();
      onSuccess(updatedProfile);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(error instanceof Error ? error.message : 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!partnerProfile) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          static
          open={isOpen}
          onClose={onClose}
          className="relative z-50"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          <Dialog.Panel
            as={motion.div}
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 overflow-y-auto"
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative w-full max-w-2xl">
                <NeonContainer>
                  <div className="relative bg-gray-900/90 backdrop-blur-xl p-8">
                    <button
                      onClick={onClose}
                      className="absolute right-6 top-6 p-2 rounded-lg text-gray-400 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <FiX className="w-5 h-5" />
                    </button>

                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-white">
                        Update Profile
                      </h2>
                      <p className="text-gray-400 mt-1">
                        Update your business information and integration settings
                      </p>
                    </div>

                    {error && (
                      <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
                        <div className="flex items-center gap-2">
                          <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
                          <p>{error}</p>
                        </div>
                      </div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-4 mb-6">
                      <button
                        onClick={() => setActiveTab('profile')}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          activeTab === 'profile'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        Profile Information
                      </button>
                      <button
                        onClick={() => setActiveTab('integration')}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          activeTab === 'integration'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        Integration Settings
                      </button>
                    </div>

                    <div className="space-y-6">
                      {activeTab === 'profile' ? (
                        <>
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Business Name
                              </label>
                              <input
                                type="text"
                                value={formData.businessName}
                                onChange={(e) => handleInputChange('businessName', e.target.value)}
                                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Contact Name
                              </label>
                              <input
                                type="text"
                                value={formData.contactName}
                                onChange={(e) => handleInputChange('contactName', e.target.value)}
                                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                              />
                            </div>

                            <div className="col-span-2">
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Business Address
                              </label>
                              <textarea
                                value={formData.businessAddress}
                                onChange={(e) => handleInputChange('businessAddress', e.target.value)}
                                rows={3}
                                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Email Address
                              </label>
                              <input
                                type="email"
                                value={formData.emailAddress}
                                onChange={(e) => handleInputChange('emailAddress', e.target.value)}
                                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Phone Number
                              </label>
                              <input
                                type="tel"
                                value={formData.phoneNumber}
                                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Area of Business
                              </label>
                              <input
                                type="text"
                                value={formData.areaOfBusiness}
                                onChange={(e) => handleInputChange('areaOfBusiness', e.target.value)}
                                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Expertise
                              </label>
                              <input
                                type="text"
                                value={formData.expertise}
                                onChange={(e) => handleInputChange('expertise', e.target.value)}
                                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-lg font-medium text-white mb-4">GHL Integration</h3>
                            <div className="space-y-4">
                              <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                                  GHL Private Integration Token
                                  <a
                                    href="https://help.leadconnectorhq.com/support/solutions/articles/155000002774-private-integrations-everything-you-need-to-know#What's-the-difference-between-Private-Integrations-and-API-Keys?"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                    title="Learn how to get your Private Integration Token"
                                  >
                                    <span className="text-xs font-bold">?</span>
                                  </a>
                                </label>
                                <input
                                  type="password"
                                  value={formData.ghlApiKey}
                                  onChange={(e) => handleInputChange('ghlApiKey', e.target.value)}
                                  className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                                  placeholder={hasGhlKey ? '••••••••' : 'Enter GHL Private Integration Token'}
                                />
                                {hasGhlKey && (
                                  <p className="mt-1 text-sm text-gray-400">
                                    Token is set. Enter a new value to update it.
                                  </p>
                                )}
                              </div>

                              <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                                  GHL Location ID
                                  <a
                                    href="https://help.leadconnectorhq.com/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                    title="Learn how to find your Location ID"
                                  >
                                    <span className="text-xs font-bold">?</span>
                                  </a>
                                </label>
                                <input
                                  type="text"
                                  value={formData.ghlLocationId}
                                  onChange={(e) => handleInputChange('ghlLocationId', e.target.value)}
                                  className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                                  placeholder="Enter your GHL Location ID"
                                />
                                <p className="mt-1 text-xs text-gray-400">
                                  Required for GHL integration. Find it in Settings → Business Profile → Location ID
                                </p>
                              </div>

                              {/* Quick Steps */}
                              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                                <h4 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                                  <FiInfo className="w-4 h-4" />
                                  Quick Steps to Setup GHL Integration
                                </h4>
                                <ol className="space-y-2 text-xs text-gray-300">
                                  <li className="flex gap-2">
                                    <span className="font-semibold text-blue-400 min-w-[20px]">1.</span>
                                    <span>Go to your GHL account → Settings → Integrations</span>
                                  </li>
                                  <li className="flex gap-2">
                                    <span className="font-semibold text-blue-400 min-w-[20px]">2.</span>
                                    <span>Click "Private Integrations" → "Create Integration"</span>
                                  </li>
                                  <li className="flex gap-2">
                                    <span className="font-semibold text-blue-400 min-w-[20px]">3.</span>
                                    <span>Give it a name (e.g., "Knotie AI Integration")</span>
                                  </li>
                                  <li className="flex gap-2">
                                    <span className="font-semibold text-blue-400 min-w-[20px]">4.</span>
                                    <span className="font-semibold">Select ALL scopes to enable all features</span>
                                  </li>
                                  <li className="flex gap-2">
                                    <span className="font-semibold text-blue-400 min-w-[20px]">5.</span>
                                    <span>Copy the generated token and paste it above</span>
                                  </li>
                                  <li className="flex gap-2">
                                    <span className="font-semibold text-blue-400 min-w-[20px]">6.</span>
                                    <span className="font-semibold">Go to Settings → Business Profile → Copy your Location ID</span>
                                  </li>
                                  <li className="flex gap-2">
                                    <span className="font-semibold text-blue-400 min-w-[20px]">7.</span>
                                    <span>Paste the Location ID in the field above</span>
                                  </li>
                                </ol>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-lg font-medium text-white mb-4">VAPI Integration</h3>
                            <div className="mt-6">
                              <label className="block text-sm text-white mb-2">VAPI API Key</label>
                              <div className="relative">
                                <input
                                  type="password"
                                  placeholder={hasVapiKey ? '••••••••••••••••' : 'Enter your VAPI API key'}
                                  value={formData.vapiApiKey}
                                  onChange={(e) => handleInputChange('vapiApiKey', e.target.value)}
                                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                                {hasVapiKey && (
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-green-400">
                                    <span className="text-xs">Configured</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                Your VAPI API key is used to manage your voice AI agents.
                              </p>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-lg font-medium text-white mb-4">Retell Integration</h3>
                            <div className="mt-6">
                              <label className="block text-sm text-white mb-2">Retell API Key</label>
                              <div className="relative">
                                <input
                                  type="password"
                                  placeholder={hasRetellKey ? '••••••••••••••••' : 'Enter your Retell API key'}
                                  value={formData.retellApiKey}
                                  onChange={(e) => handleInputChange('retellApiKey', e.target.value)}
                                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                                {hasRetellKey && (
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-green-400">
                                    <span className="text-xs">Configured</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                Your Retell API key is used to manage your Retell voice AI agents.
                              </p>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-lg font-medium text-white mb-4">Ultravox Integration</h3>
                            <div className="mt-6">
                              <label className="block text-sm text-white mb-2">Ultravox API Key</label>
                              <div className="relative">
                                <input
                                  type="password"
                                  placeholder={hasUltravoxKey ? '••••••••••••••••' : 'Enter your Ultravox API key'}
                                  value={formData.ultravoxApiKey}
                                  onChange={(e) => handleInputChange('ultravoxApiKey', e.target.value)}
                                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                                {hasUltravoxKey && (
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-green-400">
                                    <span className="text-xs">Configured</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                Your Ultravox API key is used to manage your Ultravox voice AI agents.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-3 mt-8">
                        <button
                          onClick={onClose}
                          className="px-6 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSubmit}
                          disabled={loading}
                          className={`px-6 py-2 rounded-lg bg-blue-500 text-white transition-colors ${
                            loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                          }`}
                        >
                          {loading ? 'Updating...' : 'Update Profile'}
                        </button>
                      </div>
                    </div>
                  </div>
                </NeonContainer>
              </div>
            </div>
          </Dialog.Panel>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
