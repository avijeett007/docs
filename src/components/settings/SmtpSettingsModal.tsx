'use client';

import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiAlertCircle, FiMail, FiServer, FiUser, FiLock, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import NeonContainer from '@/components/NeonContainer';

interface SmtpSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerProfile: {
    id: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUsername?: string;
    smtpPassword?: string;
    smtpFromEmail?: string;
    smtpFromName?: string;
    useCustomSmtp: boolean;
    sesDomainEnabled?: boolean;
  } | null;
  onSuccess: (updatedProfile: any) => void;
}

export default function SmtpSettingsModal({
  isOpen,
  onClose,
  partnerProfile,
  onSuccess
}: SmtpSettingsModalProps) {
  const [formData, setFormData] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    smtpFromEmail: '',
    smtpFromName: '',
    useCustomSmtp: false
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testWarning, setTestWarning] = useState<string | null>(null);
  const [hasSmtpPassword, setHasSmtpPassword] = useState(false);
  const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);

  useEffect(() => {
    if (partnerProfile) {
      setFormData({
        smtpHost: partnerProfile.smtpHost || '',
        smtpPort: partnerProfile.smtpPort || 587,
        smtpUsername: partnerProfile.smtpUsername || '',
        smtpPassword: '',
        smtpFromEmail: partnerProfile.smtpFromEmail || '',
        smtpFromName: partnerProfile.smtpFromName || '',
        useCustomSmtp: partnerProfile.useCustomSmtp
      });
      setHasSmtpPassword(!!partnerProfile.smtpPassword);
      // Reset acknowledgment when modal opens
      setAcknowledgeRisk(false);
    }
  }, [partnerProfile, isOpen]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleToggleCustomSmtp = () => {
    // Reset acknowledgment when toggling
    setAcknowledgeRisk(false);

    setFormData(prev => ({
      ...prev,
      useCustomSmtp: !prev.useCustomSmtp
    }));
  };

  const validateForm = () => {
    if (formData.useCustomSmtp) {
      // Check for acknowledgment first
      if (!acknowledgeRisk) {
        setError('You must acknowledge the risk of using custom SMTP settings');
        return false;
      }

      if (!formData.smtpHost) {
        setError('SMTP Host is required');
        return false;
      }
      if (!formData.smtpPort) {
        setError('SMTP Port is required');
        return false;
      }
      if (!formData.smtpUsername) {
        setError('SMTP Username is required');
        return false;
      }
      if (!formData.smtpFromEmail) {
        setError('From Email is required');
        return false;
      }
      if (!formData.smtpFromName) {
        setError('From Name is required');
        return false;
      }
      // Only require password if it's a new configuration or being changed
      if (!hasSmtpPassword && !formData.smtpPassword) {
        setError('SMTP Password is required');
        return false;
      }
    }
    return true;
  };

  const handleTestConnection = async () => {
    // Validate form but don't check for acknowledgment when testing
    if (!formData.useCustomSmtp) return;

    // Check required fields manually since we're bypassing validateForm()
    if (!formData.smtpHost) {
      setTestError('SMTP Host is required');
      return;
    }
    if (!formData.smtpPort) {
      setTestError('SMTP Port is required');
      return;
    }
    if (!formData.smtpUsername) {
      setTestError('SMTP Username is required');
      return;
    }
    if (!formData.smtpFromEmail) {
      setTestError('From Email is required');
      return;
    }
    if (!formData.smtpFromName) {
      setTestError('From Name is required');
      return;
    }
    // Check password only if it's a new configuration or being changed
    if (!hasSmtpPassword && !formData.smtpPassword) {
      setTestError('SMTP Password is required');
      return;
    }

    setTestLoading(true);
    setTestSuccess(null);
    setTestError(null);
    setTestWarning(null);

    try {
      // Prepare the data for the API call
      const testData = {
        smtpHost: formData.smtpHost,
        smtpPort: formData.smtpPort,
        smtpUsername: formData.smtpUsername,
        smtpFromEmail: formData.smtpFromEmail,
        smtpFromName: formData.smtpFromName,
        // Use the current password if it exists and no new one is provided
        smtpPassword: formData.smtpPassword || (hasSmtpPassword ? '**use-existing-password**' : '')
      };

      // Call the API to test the SMTP connection
      const response = await fetch('/api/partner/smtp/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('partner_token')}`
        },
        body: JSON.stringify(testData)
      });

      const data = await response.json();

      if (response.ok) {
        setTestSuccess(data.message || 'SMTP connection successful!');

        // Check if there's a warning
        if (data.warning) {
          setTestWarning(data.warning);
        }
      } else {
        setTestError(data.error || 'Failed to test SMTP connection');
      }
    } catch (error) {
      console.error('Error testing SMTP connection:', error);
      setTestError(error instanceof Error ? error.message : 'Failed to test SMTP connection');
    } finally {
      setTestLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      setError(null);

      const submissionData: any = {
        useCustomSmtp: formData.useCustomSmtp
      };

      if (formData.useCustomSmtp) {
        submissionData.smtpHost = formData.smtpHost;
        submissionData.smtpPort = formData.smtpPort;
        submissionData.smtpUsername = formData.smtpUsername;
        submissionData.smtpFromEmail = formData.smtpFromEmail;
        submissionData.smtpFromName = formData.smtpFromName;

        // Only include password if it's been changed
        if (formData.smtpPassword) {
          submissionData.smtpPassword = formData.smtpPassword;
        }
      }

      const response = await fetch('/api/partner/smtp', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('partner_token')}`
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update SMTP settings');
      }

      const updatedProfile = await response.json();
      onSuccess(updatedProfile);
      onClose();
    } catch (error) {
      console.error('Error updating SMTP settings:', error);
      setError(error instanceof Error ? error.message : 'Failed to update SMTP settings');
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
                        SMTP Settings
                      </h2>
                      <p className="text-gray-400 mt-1">
                        Configure your custom SMTP server for sending white-label emails
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

                    {partnerProfile.sesDomainEnabled && (
                      <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-400">
                        <div className="flex items-center gap-2">
                          <FiAlertTriangle className="w-5 h-5 flex-shrink-0" />
                          <div>
                            <p className="font-medium">SMTP Configuration Disabled</p>
                            <p className="text-sm text-yellow-300 mt-1">
                              Domain Email Service is active. SMTP settings cannot be modified while this service is enabled.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-6">
                      <div className={`flex items-center justify-between p-4 bg-gray-800/50 rounded-lg ${partnerProfile.sesDomainEnabled ? 'opacity-50' : ''}`}>
                        <div>
                          <h3 className="text-white font-medium">Use Custom SMTP Server</h3>
                          <p className="text-sm text-gray-400">
                            {partnerProfile.sesDomainEnabled
                              ? 'Disabled - Domain Email Service is active'
                              : 'Enable to use your own SMTP server for sending emails'
                            }
                          </p>
                        </div>
                        <button
                          onClick={partnerProfile.sesDomainEnabled ? undefined : handleToggleCustomSmtp}
                          disabled={partnerProfile.sesDomainEnabled}
                          className={`relative ${partnerProfile.sesDomainEnabled ? 'cursor-not-allowed' : ''}`}
                        >
                          <div className={`w-14 h-7 rounded-full transition-colors ${formData.useCustomSmtp && !partnerProfile.sesDomainEnabled ? 'bg-blue-500' : 'bg-gray-700'}`}>
                            <div className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full transition-transform ${formData.useCustomSmtp && !partnerProfile.sesDomainEnabled ? 'translate-x-7' : ''}`}></div>
                          </div>
                        </button>
                      </div>

                      {formData.useCustomSmtp && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4">
                          <div className="flex items-start gap-3">
                            <FiAlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-amber-400 font-medium mb-1">Important: Custom SMTP Configuration</h4>
                              <p className="text-sm text-amber-300/80">
                                When you enable custom SMTP settings, all emails to your customers will be sent through your SMTP server instead of our default email provider.
                                If your SMTP server is not properly configured or becomes unavailable, emails will not be delivered to your customers.
                              </p>
                              <div className="mt-3 flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id="acknowledge-risk"
                                  checked={acknowledgeRisk}
                                  onChange={(e) => setAcknowledgeRisk(e.target.checked)}
                                  className="w-4 h-4 rounded border-amber-500/50 text-blue-500 focus:ring-blue-500/50"
                                />
                                <label htmlFor="acknowledge-risk" className="text-sm text-amber-300/90">
                                  I understand that if my SMTP server is not working, emails will not be sent and I accept this risk.
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {formData.useCustomSmtp && (
                        <>
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                SMTP Host
                              </label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <FiServer className="text-gray-400" />
                                </div>
                                <input
                                  type="text"
                                  value={formData.smtpHost}
                                  onChange={(e) => handleInputChange('smtpHost', e.target.value)}
                                  placeholder="smtp.example.com"
                                  className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                SMTP Port
                              </label>
                              <input
                                type="number"
                                value={formData.smtpPort}
                                onChange={(e) => handleInputChange('smtpPort', parseInt(e.target.value))}
                                placeholder="587"
                                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Common ports: 25, 465 (SSL), 587 (TLS)
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                SMTP Username
                              </label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <FiUser className="text-gray-400" />
                                </div>
                                <input
                                  type="text"
                                  value={formData.smtpUsername}
                                  onChange={(e) => handleInputChange('smtpUsername', e.target.value)}
                                  placeholder="username@example.com"
                                  className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                SMTP Password
                              </label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <FiLock className="text-gray-400" />
                                </div>
                                <input
                                  type="password"
                                  value={formData.smtpPassword}
                                  onChange={(e) => handleInputChange('smtpPassword', e.target.value)}
                                  placeholder={hasSmtpPassword ? "••••••••" : "Enter password"}
                                  className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                                />
                              </div>
                              {hasSmtpPassword && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Leave blank to keep current password
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                From Email
                              </label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <FiMail className="text-gray-400" />
                                </div>
                                <input
                                  type="email"
                                  value={formData.smtpFromEmail}
                                  onChange={(e) => handleInputChange('smtpFromEmail', e.target.value)}
                                  placeholder="noreply@yourdomain.com"
                                  className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                From Name
                              </label>
                              <input
                                type="text"
                                value={formData.smtpFromName}
                                onChange={(e) => handleInputChange('smtpFromName', e.target.value)}
                                placeholder="Your Company Name"
                                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                              />
                            </div>
                          </div>

                          <div className="mt-4">
                            <button
                              onClick={handleTestConnection}
                              disabled={testLoading}
                              className={`px-4 py-2 rounded-lg text-white transition-colors ${
                                testLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                              }`}
                            >
                              {testLoading ? 'Testing...' : 'Test Connection'}
                            </button>

                            {testSuccess && (
                              <div className="mt-2 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400">
                                <div className="flex items-center gap-2">
                                  <FiCheck className="w-5 h-5 flex-shrink-0" />
                                  <p>{testSuccess}</p>
                                </div>
                              </div>
                            )}

                            {testWarning && (
                              <div className="mt-2 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400">
                                <div className="flex items-center gap-2">
                                  <FiAlertTriangle className="w-5 h-5 flex-shrink-0" />
                                  <p>{testWarning}</p>
                                </div>
                              </div>
                            )}

                            {testError && (
                              <div className="mt-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
                                <div className="flex items-center gap-2">
                                  <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
                                  <p>{testError}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
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
                          {loading ? 'Saving...' : 'Save Settings'}
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
