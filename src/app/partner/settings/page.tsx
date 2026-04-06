'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePartnerAuth } from '@/hooks/usePartnerAuth';
import { Permission } from '@/lib/rbac';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import {
  FiEdit,
  FiKey,
  FiLink,
  FiLock,
  FiCheck,
  FiServer,
  FiShield,
  FiDownload,
  FiAlertTriangle,
  FiInfo,
  FiBarChart2,
  FiToggleRight,
  FiToggleLeft
} from 'react-icons/fi';
import NeonContainer from '@/components/NeonContainer';
import UpdateProfileModal from '@/components/settings/UpdateProfileModal';
import ChangePasswordModal from '@/components/settings/ChangePasswordModal';
import UpdateBrandingModal from '@/components/settings/UpdateBrandingModal';
import SmtpSettingsModal from '@/components/settings/SmtpSettingsModal';
import StripeConnectSettings from '@/components/settings/StripeConnectSettings';
import SubscriptionManagement from '@/components/settings/SubscriptionManagement';
import MFASetupModal from '@/components/mfa/MFASetupModal';
import PasskeyManagement from '@/components/passkey/PasskeyManagement';
import KBProcessingConfig from '@/components/partner/KBProcessingConfig';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { toast } from 'react-hot-toast';

// Menu items are handled by PartnerLayout component

interface PartnerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  expertise: string;
  learningSource?: string; // Make this optional
  partnershipType: string;
  approvalStatus: string;
  partnerCode: string;
  ghlCalendarId: string | null;
  ghlLocationId: string | null;
  ghlApiKey: string | null;
  vapiApiKey: string | null;
  retellApiKey: string | null;
  ultravoxApiKey: string | null;
  logo: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  portalTitle: string | null;
  portalSlogan: string | null;
  subdomain?: string | null;
  customDomain: string | null;
  customDomainVerified?: boolean | null;
  // SMTP settings
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  smtpPassword: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  useCustomSmtp: boolean;
  // SES Domain Email Service settings
  sesDomain: string | null;
  sesDomainStatus: string | null;
  sesFromEmail: string | null;
  sesFromName: string | null;
  useSESDomain: boolean;
  sesDomainEnabled: boolean;
  // MFA settings
  mfaEnabled?: boolean;
  stripeAccountId?: string | null;
  stripeOnboardingCompleted?: boolean;
  // AI Analytics
  enableAiAnalytics?: boolean;
  creditBalance?: number;
}

export default function PartnerSettings() {
  const router = useRouter();
  const { hasPermission } = usePartnerAuth();
  const [partnerName, setPartnerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [showDomainEmailConfirm, setShowDomainEmailConfirm] = useState(false);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaStatus, setMfaStatus] = useState<{
    mfaEnabled: boolean;
    stripeConnectEnabled: boolean;
    backupCodesCount: number;
  } | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [portalCopyStatus, setPortalCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [brandedUrlCopyStatus, setBrandedUrlCopyStatus] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    const fetchPartnerDetails = async () => {
      try {
        // First try to get from localStorage
        const storedName = localStorage.getItem('partner_name');
        if (storedName) {
          setPartnerName(storedName);
        }

        const token = localStorage.getItem('partner_token');
        if (!token) {
          router.push('/partner/login');
          return;
        }

        const response = await fetch('/api/partner/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const partnerData = await response.json();



          // Map the partner data to the expected format
          const mappedPartnerData = {
            id: partnerData.id,
            name: partnerData.contactName || partnerData.businessName,
            company: partnerData.businessName,
            email: partnerData.emailAddress,
            phone: partnerData.phoneNumber,
            expertise: partnerData.expertise,
            partnershipType: partnerData.partnershipType,
            approvalStatus: partnerData.approvalStatus,
            partnerCode: partnerData.partnerCode,
            ghlCalendarId: partnerData.ghlCalendarId,
            ghlLocationId: partnerData.ghlLocationId,
            ghlApiKey: partnerData.ghlApiKey,
            vapiApiKey: partnerData.vapiApiKey,
            retellApiKey: partnerData.retellApiKey,
            ultravoxApiKey: partnerData.ultravoxApiKey,
            // SMTP settings
            useCustomSmtp: partnerData.useCustomSmtp || false,
            smtpHost: partnerData.smtpHost,
            smtpPort: partnerData.smtpPort,
            smtpUsername: partnerData.smtpUsername,
            smtpPassword: partnerData.smtpPassword,
            smtpFromEmail: partnerData.smtpFromEmail,
            smtpFromName: partnerData.smtpFromName,
            // SES Domain Email Service settings
            sesDomain: partnerData.sesDomain,
            sesDomainStatus: partnerData.sesDomainStatus,
            sesFromEmail: partnerData.sesFromEmail,
            sesFromName: partnerData.sesFromName,
            useSESDomain: partnerData.useSESDomain || false,
            sesDomainEnabled: Boolean(partnerData.sesDomainEnabled),
            // Branding settings
            logo: partnerData.logo,
            primaryColor: partnerData.primaryColor,
            secondaryColor: partnerData.secondaryColor,
            fontFamily: partnerData.fontFamily,
            portalTitle: partnerData.portalTitle,
            portalSlogan: partnerData.portalSlogan,
            subdomain: partnerData.subdomain,
            customDomain: partnerData.customDomain,
            customDomainVerified: partnerData.customDomainVerified,
            // MFA settings
            mfaEnabled: partnerData.mfaEnabled,
            stripeAccountId: partnerData.stripeAccountId,
            stripeOnboardingCompleted: partnerData.stripeOnboardingCompleted,
            // AI Analytics
            enableAiAnalytics: partnerData.enableAiAnalytics || false,
            creditBalance: partnerData.creditBalance ?? 0,
          };


          setPartnerProfile(mappedPartnerData);

          // Fetch MFA status
          fetchMFAStatus(token);
          if (mappedPartnerData.name) {
            setPartnerName(mappedPartnerData.name);
            localStorage.setItem('partner_name', mappedPartnerData.name);
          }
        } else if (response.status === 401) {
          localStorage.removeItem('partner_token');
          router.push('/partner/login');
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching partner details:', error);
        setLoading(false);
      }
    };

    fetchPartnerDetails();
  }, [router]);

  const fetchMFAStatus = async (token: string) => {
    try {
      const [mfaResponse, backupCodesResponse] = await Promise.all([
        fetch('/api/partner/auth/mfa/setup', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/partner/auth/mfa/backup-codes', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (mfaResponse.ok) {
        const mfaData = await mfaResponse.json();
        let backupCodesCount = 0;

        if (backupCodesResponse.ok) {
          const backupData = await backupCodesResponse.json();
          backupCodesCount = backupData.backupCodesCount || 0;
        }

        setMfaStatus({
          mfaEnabled: mfaData.mfaEnabled,
          stripeConnectEnabled: mfaData.stripeConnectEnabled,
          backupCodesCount
        });
      }
    } catch (error) {
      console.error('Error fetching MFA status:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  const handleMFASetupSuccess = () => {
    setShowMFASetup(false);
    // Refresh MFA status
    const token = localStorage.getItem('partner_token');
    if (token) {
      fetchMFAStatus(token);
    }
    toast.success('Multi-factor authentication enabled successfully!');
  };

  const handleToggleAiAnalytics = async () => {
    const token = localStorage.getItem('partner_token');
    if (!token || !partnerProfile) return;

    const newValue = !partnerProfile.enableAiAnalytics;

    try {
      const res = await fetch('/api/partner/settings', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enableAiAnalytics: newValue }),
      });

      if (res.ok) {
        setPartnerProfile({ ...partnerProfile, enableAiAnalytics: newValue });
        toast.success(newValue ? 'AI Analytics enabled' : 'AI Analytics disabled');
      } else {
        toast.error('Failed to update AI Analytics setting');
      }
    } catch (error) {
      console.error('Error toggling AI Analytics:', error);
      toast.error('Failed to update AI Analytics setting');
    }
  };

  const handleDisableMFA = async () => {
    const password = prompt('Enter your password to disable MFA:');
    if (!password) return;

    try {
      const response = await fetch('/api/partner/auth/mfa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disable MFA');
      }

      // Refresh MFA status
      const token = localStorage.getItem('partner_token');
      if (token) {
        fetchMFAStatus(token);
      }

      toast.success('Multi-factor authentication disabled successfully');
    } catch (error: any) {
      console.error('Error disabling MFA:', error);
      toast.error(error.message || 'Failed to disable MFA');
    }
  };

  const handleRegenerateBackupCodes = async () => {
    const password = prompt('Enter your password to regenerate backup codes:');
    if (!password) return;

    try {
      const response = await fetch('/api/partner/auth/mfa/backup-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate backup codes');
      }

      // Download the new backup codes
      const content = `Knotie AI Pro - MFA Backup Codes\n\nGenerated: ${new Date().toLocaleString()}\n\nBackup Codes:\n${data.backupCodes.map((code: string, index: number) => `${index + 1}. ${code}`).join('\n')}\n\nImportant:\n- Store these codes in a safe place\n- Each code can only be used once\n- Use these codes if you lose access to your authenticator app\n- Generate new codes if you suspect they have been compromised`;

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'knotie-mfa-backup-codes.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Refresh MFA status
      const token = localStorage.getItem('partner_token');
      if (token) {
        fetchMFAStatus(token);
      }

      toast.success('New backup codes generated and downloaded!');
    } catch (error: any) {
      console.error('Error regenerating backup codes:', error);
      toast.error(error.message || 'Failed to regenerate backup codes');
    }
  };

  // Get the host based on environment
  const host = typeof window !== 'undefined' ?
    process.env.NODE_ENV === 'production' ?
      'https://knotie-ai.pro' :
      `${window.location.protocol}//${window.location.host}` :
    '';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute
      hasPermission={hasPermission}
      requiredPermission={Permission.MANAGE_SETTINGS}
      fallbackPath="/partner/dashboard"
    >
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Settings</h1>
          </div>

          <div className="grid gap-6">
            {/* Profile Settings */}
            <NeonContainer>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">Profile Settings</h2>
                    <p className="text-gray-400 mt-1">Update your business information and contact details</p>
                  </div>
                  <button
                    onClick={() => setShowUpdateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  >
                    <FiEdit className="w-4 h-4" />
                    Update Profile
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Business Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400">Business Name</label>
                        <p className="text-white">{partnerProfile?.company}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Contact Name</label>
                        <p className="text-white">{partnerProfile?.name}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Business Address</label>
                        <p className="text-white">Not available</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Contact Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400">Email Address</label>
                        <p className="text-white">{partnerProfile?.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Phone Number</label>
                        <p className="text-white">{partnerProfile?.phone}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Area of Business</label>
                        <p className="text-white">Not available</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </NeonContainer>

            {/* Partner Code Section */}
            <NeonContainer>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">Partner Information</h2>
                    <p className="text-gray-400 mt-1">Your unique partner identifier and referral details</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Partner Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400">Partner Code</label>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-white font-mono">{partnerProfile?.partnerCode || 'Not available'}</p>
                          <button
                            onClick={async () => {
                              if (partnerProfile?.partnerCode) {
                                try {
                                  await navigator.clipboard.writeText(partnerProfile.partnerCode);
                                  setCopyStatus('copied');
                                  setTimeout(() => setCopyStatus('idle'), 2000);
                                } catch (err) {
                                  console.error('Failed to copy:', err);
                                }
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-1 text-sm rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
                            disabled={copyStatus === 'copied'}
                          >
                            {copyStatus === 'copied' ? (
                              <>
                                <FiCheck className="w-4 h-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <FiKey className="w-4 h-4" />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Partnership Type</label>
                        <p className="text-white">{partnerProfile?.partnershipType}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Your Whitelabel Customer Portal</label>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-white font-mono text-sm truncate">
                            {partnerProfile?.subdomain ?
                              `https://${partnerProfile.subdomain}.knotie-ai.pro` :
                              partnerProfile?.customDomain && partnerProfile?.customDomainVerified ?
                              `https://${partnerProfile.customDomain}` :
                              'Configure subdomain or custom domain in Whitelabel settings'
                            }
                          </p>
                          <button
                            onClick={async () => {
                              const portalUrl = partnerProfile?.subdomain ?
                                `https://${partnerProfile.subdomain}.knotie-ai.pro` :
                                partnerProfile?.customDomain && partnerProfile?.customDomainVerified ?
                                `https://${partnerProfile.customDomain}` : null;

                              if (portalUrl) {
                                try {
                                  await navigator.clipboard.writeText(portalUrl);
                                  setPortalCopyStatus('copied');
                                  setTimeout(() => setPortalCopyStatus('idle'), 2000);
                                } catch (err) {
                                  console.error('Failed to copy:', err);
                                }
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-1 text-sm rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors whitespace-nowrap"
                            disabled={portalCopyStatus === 'copied' || (!partnerProfile?.subdomain && !(partnerProfile?.customDomain && partnerProfile?.customDomainVerified))}
                          >
                            {portalCopyStatus === 'copied' ? (
                              <>
                                <FiCheck className="w-4 h-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <FiLink className="w-4 h-4" />
                                Copy URL
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Configure your subdomain or custom domain in the Whitelabel settings to enable your customer portal.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Account Status</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400">Approval Status</label>
                        <p className="text-white capitalize">{partnerProfile?.approvalStatus.toLowerCase()}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Area of Expertise</label>
                        <p className="text-white">{partnerProfile?.expertise}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </NeonContainer>

            {/* Subscription & Billing */}
            <div id="subscription">
              <SubscriptionManagement />
            </div>

            {/* Integration Settings */}
            <NeonContainer>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">Integration Settings</h2>
                    <p className="text-gray-400 mt-1">Configure your integrations</p>
                  </div>
                  <button
                    onClick={() => setShowUpdateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  >
                    <FiLink className="w-4 h-4" />
                    Update Integration
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                      GoHighLevel Private Integration Token
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
                    <p className="text-white">
                      {partnerProfile?.ghlApiKey ? '••••••••••••••••' : 'Not configured'}
                    </p>

                    {/* Quick Steps */}
                    <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-2">
                        <FiInfo className="w-3 h-3" />
                        Quick Steps to Create Token
                      </h4>
                      <ol className="space-y-1.5 text-xs text-gray-300">
                        <li className="flex gap-2">
                          <span className="font-semibold text-blue-400 min-w-[16px]">1.</span>
                          <span>Go to your GHL account → Settings → Integrations</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-semibold text-blue-400 min-w-[16px]">2.</span>
                          <span>Click "Private Integrations" → "Create Integration"</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-semibold text-blue-400 min-w-[16px]">3.</span>
                          <span>Give it a name (e.g., "Knotie AI Integration")</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-semibold text-blue-400 min-w-[16px]">4.</span>
                          <span className="font-semibold">Select ALL scopes to enable all features</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-semibold text-blue-400 min-w-[16px]">5.</span>
                          <span>Copy the token and click "Update Integration" above</span>
                        </li>
                      </ol>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400">VAPI API Key</label>
                    <p className="text-white">
                      {partnerProfile?.vapiApiKey ? '••••••••••••••••' : 'Not configured'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400">Retell API Key</label>
                    <p className="text-white">
                      {partnerProfile?.retellApiKey ? '••••••••••••••••' : 'Not configured'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400">Ultravox API Key</label>
                    <p className="text-white">
                      {partnerProfile?.ultravoxApiKey ? '••••••••••••••••' : 'Not configured'}
                    </p>
                  </div>
                </div>
              </div>
            </NeonContainer>

            {/* AI Analytics Settings */}
            <NeonContainer>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <FiBarChart2 className="w-5 h-5 text-blue-400" />
                      AI Analytics
                    </h2>
                    <p className="text-gray-400 mt-1">
                      Enable AI-powered call analysis for your agents.
                      Credits will be charged per analysis.
                    </p>
                  </div>
                  <button onClick={handleToggleAiAnalytics} className="relative">
                    {partnerProfile?.enableAiAnalytics ? (
                      <FiToggleRight className="w-10 h-6 text-blue-500" />
                    ) : (
                      <FiToggleLeft className="w-10 h-6 text-gray-500" />
                    )}
                  </button>
                </div>

                {partnerProfile?.enableAiAnalytics && (
                  <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-400 text-sm">
                      <FiInfo className="w-4 h-4" />
                      <span>1 credit per AI analysis. Current balance: {partnerProfile.creditBalance ?? 0} credits</span>
                    </div>
                  </div>
                )}
              </div>
            </NeonContainer>

            {/* Security Settings */}
            <NeonContainer>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">Security Settings</h2>
                    <p className="text-gray-400 mt-1">Update your password and security preferences</p>
                  </div>
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  >
                    <FiKey className="w-4 h-4" />
                    Change Password
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Password Section */}
                  <div>
                    <div className="flex items-center gap-3 text-gray-400">
                      <FiLock className="w-5 h-5" />
                      <span>Password last changed: Never</span>
                    </div>
                  </div>

                  {/* MFA Section */}
                  <div className="border-t border-gray-700 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-white">Multi-Factor Authentication</h3>
                        <p className="text-gray-400 text-sm">Add an extra layer of security to your account</p>
                      </div>
                      {mfaStatus?.mfaEnabled ? (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                            Enabled
                          </span>
                          {!mfaStatus.stripeConnectEnabled && (
                            <button
                              onClick={handleDisableMFA}
                              className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors text-sm"
                            >
                              Disable
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowMFASetup(true)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                        >
                          <FiShield className="w-4 h-4" />
                          Enable MFA
                        </button>
                      )}
                    </div>

                    {mfaStatus?.mfaEnabled && (
                      <div className="space-y-4">
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-white font-medium">Authenticator App</h4>
                              <p className="text-gray-400 text-sm">
                                Use your authenticator app to generate verification codes
                              </p>
                            </div>
                            <div className="text-green-400">
                              <FiCheck className="w-5 h-5" />
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-white font-medium">Backup Codes</h4>
                              <p className="text-gray-400 text-sm">
                                {mfaStatus.backupCodesCount} backup codes remaining
                              </p>
                            </div>
                            <button
                              onClick={handleRegenerateBackupCodes}
                              className="flex items-center gap-2 px-3 py-1 bg-yellow-500/20 text-amber-400 rounded hover:bg-yellow-500/30 transition-colors text-sm"
                            >
                              <FiDownload className="w-4 h-4" />
                              Regenerate
                            </button>
                          </div>
                        </div>

                        {mfaStatus.stripeConnectEnabled && (
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-blue-400 mb-2">
                              <FiShield className="w-4 h-4" />
                              <span className="font-medium">Required for Stripe Connect</span>
                            </div>
                            <p className="text-blue-200 text-sm">
                              MFA cannot be disabled while Stripe Connect is active. This ensures secure payment processing.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {!mfaStatus?.mfaEnabled && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-amber-400 mb-2">
                          <FiShield className="w-4 h-4" />
                          <span className="font-medium">Recommended Security Enhancement</span>
                        </div>
                        <p className="text-amber-200 text-sm mb-3">
                          Enable multi-factor authentication to protect your account and customer data.
                        </p>
                        <ul className="text-amber-200 text-sm space-y-1">
                          <li>• Protects against unauthorized access</li>
                          <li>• Required for Stripe Connect partners</li>
                          <li>• Includes backup codes for recovery</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </NeonContainer>

            {/* Passkey Authentication */}
            <NeonContainer>
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold">Passkey Authentication</h2>
                  <p className="text-gray-400 mt-1">Manage your passkeys for secure, passwordless authentication</p>
                </div>

                <PasskeyManagement
                  isCustomer={false}
                  userDisplayName={partnerProfile?.name || partnerName}
                />
              </div>
            </NeonContainer>

            {/* Email Settings */}
            <NeonContainer>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">Email Settings</h2>
                    <p className="text-gray-400 mt-1">Configure your SMTP server for white-label emails</p>
                  </div>
                  <button
                    onClick={() => setShowSmtpModal(true)}
                    disabled={partnerProfile?.sesDomainEnabled}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      partnerProfile?.sesDomainEnabled
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    <FiServer className="w-4 h-4" />
                    Configure SMTP
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Domain Email Service Toggle */}
                  <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                    <div>
                      <h3 className="text-white font-medium">Domain Email Service</h3>
                      <p className="text-sm text-gray-400">
                        One-click setup to send emails from your own domain
                      </p>
                      {partnerProfile?.sesDomainEnabled && (
                        <p className="text-xs text-yellow-400 mt-1">
                          ⚠️ This is an irreversible operation. SMTP cannot be re-enabled once this is activated.
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {partnerProfile?.sesDomainEnabled ? (
                        // Enabled state - show green status
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-green-400 font-medium">Active</span>
                        </div>
                      ) : (
                        // Disabled state - show toggle button
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                            <span className="text-gray-400">Inactive</span>
                          </div>
                          {!partnerProfile?.useCustomSmtp && (
                            <button
                              onClick={() => setShowDomainEmailConfirm(true)}
                              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm font-medium"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SMTP Server Section */}
                  <div className={`flex items-center justify-between p-4 bg-gray-800/50 rounded-lg ${
                    partnerProfile?.sesDomainEnabled ? 'opacity-50' : ''
                  }`}>
                    <div>
                      <h3 className="text-white font-medium">Custom SMTP Server</h3>
                      <p className="text-sm text-gray-400">
                        Use your own SMTP server for sending white-label emails
                      </p>
                      {partnerProfile?.sesDomainEnabled && (
                        <p className="text-xs text-red-400 mt-1">
                          Disabled - Domain Email Service is active
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {partnerProfile?.useCustomSmtp && !partnerProfile?.sesDomainEnabled ? (
                        <>
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-green-400 font-medium">Active</span>
                        </>
                      ) : (
                        <>
                          <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                          <span className="text-gray-400">Inactive</span>
                        </>
                      )}
                    </div>
                  </div>

                  {partnerProfile?.useCustomSmtp && (
                    <div className="grid grid-cols-2 gap-6 mt-4">
                      <div>
                        <label className="block text-sm text-gray-400">SMTP Host</label>
                        <p className="text-white">{partnerProfile?.smtpHost || 'Not configured'}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">SMTP Port</label>
                        <p className="text-white">{partnerProfile?.smtpPort || 'Not configured'}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">SMTP Username</label>
                        <p className="text-white">{partnerProfile?.smtpUsername || 'Not configured'}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">SMTP Password</label>
                        <p className="text-white">{partnerProfile?.smtpPassword ? '••••••••' : 'Not configured'}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">From Email</label>
                        <p className="text-white">{partnerProfile?.smtpFromEmail || 'Not configured'}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">From Name</label>
                        <p className="text-white">{partnerProfile?.smtpFromName || 'Not configured'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </NeonContainer>

            {/* Stripe Connect Settings */}
            <NeonContainer>
              <StripeConnectSettings
                partnerId={partnerProfile?.id || ''}
                onStatusUpdate={(status) => {
                  console.log('Stripe status updated:', status);
                }}
              />
            </NeonContainer>

            {/* Branding Settings */}
            <NeonContainer>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">Branding Settings</h2>
                    <p className="text-gray-400 mt-1">Customize your customer portal appearance</p>
                  </div>
                  <button
                    onClick={() => setShowBrandingModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  >
                    <FiEdit className="w-4 h-4" />
                    Update Branding
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Portal Content</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400">Portal Title</label>
                        <p className="text-white">{partnerProfile?.portalTitle || 'Not configured'}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Portal Slogan</label>
                        <p className="text-white">{partnerProfile?.portalSlogan || 'Not configured'}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Whitelabel Customer Portal</label>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-white font-mono text-sm truncate">
                            {partnerProfile?.subdomain ?
                              `https://${partnerProfile.subdomain}.knotie-ai.pro` :
                              partnerProfile?.customDomain && partnerProfile?.customDomainVerified ?
                              `https://${partnerProfile.customDomain}` :
                              'Configure subdomain or custom domain in Whitelabel settings'
                            }
                          </p>
                          <button
                            onClick={async () => {
                              const portalUrl = partnerProfile?.subdomain ?
                                `https://${partnerProfile.subdomain}.knotie-ai.pro` :
                                partnerProfile?.customDomain && partnerProfile?.customDomainVerified ?
                                `https://${partnerProfile.customDomain}` : null;

                              if (portalUrl) {
                                try {
                                  await navigator.clipboard.writeText(portalUrl);
                                  setPortalCopyStatus('copied');
                                  setTimeout(() => setPortalCopyStatus('idle'), 2000);
                                } catch (err) {
                                  console.error('Failed to copy:', err);
                                }
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-1 text-sm rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors whitespace-nowrap"
                            disabled={portalCopyStatus === 'copied' || (!partnerProfile?.subdomain && !(partnerProfile?.customDomain && partnerProfile?.customDomainVerified))}
                          >
                            {portalCopyStatus === 'copied' ? (
                              <>
                                <FiCheck className="w-4 h-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <FiLink className="w-4 h-4" />
                                Copy URL
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Your customers can access their dashboard through your whitelabel portal.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Visual Branding</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400">Logo</label>
                        <p className="text-white">{partnerProfile?.logo ? 'Configured' : 'Not configured'}</p>
                        {partnerProfile?.logo && (
                          <div className="mt-2 h-12 w-32 relative">
                            <img
                              src={partnerProfile.logo}
                              alt="Company Logo"
                              className="h-full object-contain"
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Primary Color</label>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full border border-gray-600"
                            style={{ backgroundColor: partnerProfile?.primaryColor || '#3B82F6' }}
                          />
                          <p className="text-white">{partnerProfile?.primaryColor || '#3B82F6'}</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Secondary Color</label>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full border border-gray-600"
                            style={{ backgroundColor: partnerProfile?.secondaryColor || '#10B981' }}
                          />
                          <p className="text-white">{partnerProfile?.secondaryColor || '#10B981'}</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Font Family</label>
                        <p className="text-white">{partnerProfile?.fontFamily || 'Inter'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </NeonContainer>

            {/* Knowledge Base Processing Configuration */}
            <KBProcessingConfig className="mt-6" />
          </div>
        </div>
      </div>

      {/* SMTP Settings Modal */}
      <SmtpSettingsModal
        isOpen={showSmtpModal}
        onClose={() => setShowSmtpModal(false)}
        partnerProfile={partnerProfile ? {
          id: partnerProfile.id,
          smtpHost: partnerProfile.smtpHost || undefined,
          smtpPort: partnerProfile.smtpPort || undefined,
          smtpUsername: partnerProfile.smtpUsername || undefined,
          smtpPassword: partnerProfile.smtpPassword || undefined,
          smtpFromEmail: partnerProfile.smtpFromEmail || undefined,
          smtpFromName: partnerProfile.smtpFromName || undefined,
          useCustomSmtp: partnerProfile.useCustomSmtp || false,
          sesDomainEnabled: partnerProfile.sesDomainEnabled || false
        } : null}
        onSuccess={(updatedSmtpSettings) => {
          try {
            // Create a new object with all the updated SMTP settings
            const updatedProfile = {
              ...partnerProfile!,
              smtpHost: updatedSmtpSettings.smtpHost,
              smtpPort: updatedSmtpSettings.smtpPort,
              smtpUsername: updatedSmtpSettings.smtpUsername,
              smtpFromEmail: updatedSmtpSettings.smtpFromEmail,
              smtpFromName: updatedSmtpSettings.smtpFromName,
              useCustomSmtp: updatedSmtpSettings.useCustomSmtp
            };

            // If the password was updated, include it in the updated profile
            if (updatedSmtpSettings.smtpPassword) {
              updatedProfile.smtpPassword = updatedSmtpSettings.smtpPassword;
            }

            // Update the partner profile state
            setPartnerProfile(updatedProfile);

            // Show success message
            toast.success('SMTP settings updated successfully');

            // Log the updated settings for debugging
            console.log('SMTP settings updated:', {
              useCustomSmtp: updatedProfile.useCustomSmtp,
              smtpHost: updatedProfile.smtpHost,
              smtpPort: updatedProfile.smtpPort
            });
          } catch (error) {
            console.error('Error updating SMTP settings:', error);
            toast.error('Failed to update SMTP settings');
          }
        }}
      />

      {/* Update Profile Modal */}
      <UpdateProfileModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        partnerProfile={partnerProfile ? {
          businessName: partnerProfile.company,
          contactName: partnerProfile.name,
          businessAddress: '',
          emailAddress: partnerProfile.email,
          phoneNumber: partnerProfile.phone,
          areaOfBusiness: partnerProfile.learningSource || '',
          expertise: partnerProfile.expertise,
          partnershipType: partnerProfile.partnershipType,
          ghlCalendarId: partnerProfile.ghlCalendarId,
          ghlLocationId: partnerProfile.ghlLocationId,
          ghlApiKey: partnerProfile.ghlApiKey,
          vapiApiKey: partnerProfile.vapiApiKey,
          retellApiKey: partnerProfile.retellApiKey,
          ultravoxApiKey: partnerProfile.ultravoxApiKey
        } : null}
        onSuccess={(updatedProfile) => {
          try {
            const token = localStorage.getItem('partner_token');
            fetch('/api/partner/profile', {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(updatedProfile)
            })
            .then(response => {
              if (response.ok) {
                return response.json();
              }
              throw new Error('Failed to update profile');
            })
            .then(() => {
              setPartnerProfile({
                ...partnerProfile!,
                company: updatedProfile.businessName,
                name: updatedProfile.contactName,
                email: updatedProfile.emailAddress,
                phone: updatedProfile.phoneNumber,
                learningSource: updatedProfile.areaOfBusiness,
                expertise: updatedProfile.expertise,
                partnershipType: updatedProfile.partnershipType,
                ghlCalendarId: updatedProfile.ghlCalendarId,
                ghlApiKey: updatedProfile.ghlApiKey,
                vapiApiKey: updatedProfile.vapiApiKey,
                retellApiKey: updatedProfile.retellApiKey,
                ultravoxApiKey: updatedProfile.ultravoxApiKey
              });
              if (updatedProfile.contactName) {
                setPartnerName(updatedProfile.contactName);
                localStorage.setItem('partner_name', updatedProfile.contactName);
              }
              toast.success('Profile updated successfully');
            })
            .catch(error => {
              console.error('Error updating profile:', error);
              toast.error('Failed to update profile');
            });
          } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Failed to update profile');
          }
        }}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          try {
            const token = localStorage.getItem('partner_token');
            const passwordData = {
              currentPassword: '', // This will be filled in the modal
              newPassword: '',     // This will be filled in the modal
              confirmPassword: ''  // This will be filled in the modal
            };

            fetch('/api/partner/change-password', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(passwordData)
            })
            .then(response => {
              if (!response.ok) {
                throw new Error('Failed to change password');
              }
              toast.success('Password changed successfully');
            })
            .catch(error => {
              console.error('Error changing password:', error);
              toast.error('Failed to change password');
            });
          } catch (error) {
            console.error('Error changing password:', error);
            toast.error('Failed to change password');
          }
        }}
      />

      {/* Update Branding Modal */}
      <UpdateBrandingModal
        isOpen={showBrandingModal}
        onClose={() => setShowBrandingModal(false)}
        currentBranding={{
          logo: partnerProfile?.logo || null,
          primaryColor: partnerProfile?.primaryColor || null,
          secondaryColor: partnerProfile?.secondaryColor || null,
          fontFamily: partnerProfile?.fontFamily || null,
          portalTitle: partnerProfile?.portalTitle || null,
          portalSlogan: partnerProfile?.portalSlogan || null,
        }}
        onUpdate={async (brandingData) => {
          try {
            const token = localStorage.getItem('partner_token');
            const response = await fetch('/api/partner/branding', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: brandingData
            });

            if (response.ok) {
              const updatedProfile = await response.json();
              setPartnerProfile(updatedProfile);
              toast.success('Branding settings updated successfully');
            } else {
              const errorData = await response.json();
              throw new Error(errorData.message || 'Failed to update branding');
            }
          } catch (error) {
            console.error('Error updating branding:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update branding');
            throw error;
          }
        }}
      />

      {/* MFA Setup Modal */}
      {/* Domain Email Service Confirmation Modal */}
      {showDomainEmailConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <FiAlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Enable Domain Email Service</h3>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-gray-300">
                This will enable our managed email service for your domain. You'll be able to send emails
                from your own domain with professional branding.
              </p>

              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FiAlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-yellow-400 mb-1">Important Warning</h4>
                    <p className="text-sm text-yellow-300">
                      This is an <strong>irreversible operation</strong>. Once enabled, you cannot
                      go back to using custom SMTP settings. Your current SMTP configuration will
                      be disabled permanently.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-medium text-blue-400 mb-2">What happens next:</h4>
                <ul className="text-sm text-blue-300 space-y-1">
                  <li>• You'll be redirected to Email Domain Management</li>
                  <li>• Add your domain and configure DNS records</li>
                  <li>• We'll verify your domain automatically</li>
                  <li>• Start sending emails from your domain</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDomainEmailConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('partner_token');
                    const response = await fetch('/api/partner/email-domain/enable', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      }
                    });

                    if (response.ok) {
                      // Update local state
                      setPartnerProfile(prev => prev ? {
                        ...prev,
                        sesDomainEnabled: true,
                        useCustomSmtp: false
                      } : null);

                      setShowDomainEmailConfirm(false);
                      toast.success('Domain Email Service enabled successfully!');

                      // Redirect to email domain management page
                      router.push('/partner/settings/email-domain');
                    } else {
                      throw new Error('Failed to enable domain email service');
                    }
                  } catch (error) {
                    console.error('Error enabling domain email service:', error);
                    toast.error('Failed to enable domain email service');
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Enable Domain Email Service
              </button>
            </div>
          </div>
        </div>
      )}

      <MFASetupModal
        isOpen={showMFASetup}
        onClose={() => setShowMFASetup(false)}
        onSuccess={handleMFASetupSuccess}
      />
      </PartnerLayout>
    </ProtectedRoute>
  );
}
