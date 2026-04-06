'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePartnerAuth } from '@/hooks/usePartnerAuth';
import { Permission } from '@/lib/rbac';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import {
  FiMail,
  FiCheck,
  FiX,
  FiClock,
  FiAlertTriangle,
  FiCopy,
  FiRefreshCw,
  FiExternalLink,
  FiInfo
} from 'react-icons/fi';
import PartnerLayout from '@/components/partner/PartnerLayout';
import NeonContainer from '@/components/NeonContainer';
import { toast } from 'react-hot-toast';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';

interface PartnerProfile {
  id: string;
  businessName: string;
  sesDomain: string | null;
  sesDomainStatus: string | null;
  sesDomainVerificationToken: string | null;
  sesDomainVerificationStartedAt: string | null;
  sesDomainVerifiedAt: string | null;
  sesDkimTokens: string | null;
  sesFromEmail: string | null;
  sesFromName: string | null;
  useSESDomain: boolean;
  sesDomainEnabled: boolean;
}

interface DNSRecord {
  type: string;
  name: string;
  value: string;
  description: string;
}

export default function EmailDomainManagementPage() {
  const router = useRouter();
  const { hasPermission } = usePartnerAuth();
  const [partnerName, setPartnerName] = useState('');
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [domainInput, setDomainInput] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [showDnsInstructions, setShowDnsInstructions] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // Free Forever Upgrade Modal state
  const [showFreeForeverUpgrade, setShowFreeForeverUpgrade] = useState(false);
  const [freeForeverUpgradeData, setFreeForeverUpgradeData] = useState({
    title: '',
    message: '',
    featureDescription: '',
  });
  const [pendingAction, setPendingAction] = useState<'setup' | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  useEffect(() => {
    fetchPartnerProfile();
  }, []);

  const fetchPartnerProfile = async () => {
    try {
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
        const data = await response.json();
        setPartnerProfile(data);
        setPartnerName(data.businessName || data.email || 'Partner');

        // Pre-fill form if domain is already configured
        if (data.sesDomain) {
          setDomainInput(data.sesDomain);
          setFromEmail(data.sesFromEmail || '');
          setFromName(data.sesFromName || data.businessName || '');
        } else {
          setFromName(data.businessName || '');
        }
      } else {
        throw new Error('Failed to fetch partner profile');
      }
    } catch (error) {
      console.error('Error fetching partner profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  // Proceed with pending action when "Maybe Later" is clicked
  const proceedWithPendingAction = () => {
    if (pendingAction === 'setup') {
      performDomainSetup();
    }
    setPendingAction(null);
  };

  // Extracted domain setup logic
  const performDomainSetup = async () => {
    if (!domainInput.trim() || !fromEmail.trim() || !fromName.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
    if (!domainRegex.test(domainInput.trim())) {
      toast.error('Please enter a valid domain name');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('partner_token');

      const response = await fetch('/api/partner/email-domain/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: domainInput.trim().toLowerCase(),
          fromEmail: fromEmail.trim().toLowerCase(),
          fromName: fromName.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPartnerProfile(data.partner);
        setDnsRecords(data.dnsRecords || []);
        setShowDnsInstructions(true);
        toast.success('Domain setup initiated! Please configure DNS records.');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to setup domain');
      }
    } catch (error) {
      console.error('Error setting up domain:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to setup domain');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDomainSetup = async () => {
    try {
      // Check if user is on free forever plan first
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();

      if (shouldShowFreeForeverUpgrade) {
        // Show free forever upgrade modal
        const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('email_domain');
        setFreeForeverUpgradeData(upgradeMessage);
        setPendingAction('setup');
        setShowFreeForeverUpgrade(true);
        return;
      }
    } catch (error) {
      console.error('Error checking email domain access:', error);
      // Continue with normal flow if check fails
    }

    // Proceed with domain setup
    performDomainSetup();
  };

  const handleVerifyDomain = async () => {
    try {
      setIsVerifying(true);
      const token = localStorage.getItem('partner_token');
      
      const response = await fetch('/api/partner/email-domain/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPartnerProfile(data.partner);
        
        if (data.partner.sesDomainStatus === 'verified') {
          toast.success('Domain verified successfully!');
        } else {
          toast('Domain verification is still pending. Please ensure DNS records are properly configured.', {
            icon: 'ℹ️',
            duration: 4000
          });
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to verify domain');
      }
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to verify domain');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!partnerProfile?.sesDomain || partnerProfile.sesDomainStatus !== 'verified') {
      toast.error('Domain must be verified before sending test emails');
      return;
    }

    setIsSendingTestEmail(true);
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/email-domain/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          testEmail: testEmail.trim()
        })
      });

      if (response.ok) {
        toast.success(`Test email sent successfully to ${testEmail.trim()}!`);
        setTestEmail(''); // Clear the input after successful send
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to send test email');
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      toast.error('Failed to send test email');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'verified':
        return <FiCheck className="w-5 h-5 text-green-400" />;
      case 'pending_verification':
        return <FiClock className="w-5 h-5 text-yellow-400" />;
      case 'failed':
        return <FiX className="w-5 h-5 text-red-400" />;
      default:
        return <FiAlertTriangle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string | null) => {
    switch (status) {
      case 'verified':
        return 'Verified';
      case 'pending_verification':
        return 'Pending Verification';
      case 'failed':
        return 'Verification Failed';
      default:
        return 'Not Configured';
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'verified':
        return 'text-green-400 bg-green-500/20';
      case 'pending_verification':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'failed':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  // Show loading state while auth is being checked
  if (!partnerName || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!partnerProfile?.sesDomainEnabled) {
    return (
      <ProtectedRoute
        hasPermission={hasPermission}
        requiredPermission={Permission.MANAGE_SETTINGS}
        fallbackPath="/partner/dashboard"
      >
        <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
          <div className="max-w-4xl mx-auto p-6">
            <div className="text-center">
              <FiMail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2">Domain Email Service Not Enabled</h1>
              <p className="text-gray-400 mb-6">
                You need to enable Domain Email Service first before you can manage your email domain.
              </p>
              <button
                onClick={() => router.push('/partner/settings')}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Go to Settings
              </button>
            </div>
          </div>
        </PartnerLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute
      hasPermission={hasPermission}
      requiredPermission={Permission.MANAGE_SETTINGS}
      fallbackPath="/partner/dashboard"
    >
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="max-w-6xl mx-auto p-6 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Email Domain Management</h1>
              <p className="text-gray-400 mt-1">
                Configure your domain to send professional emails from your own domain
              </p>
            </div>
            
            {partnerProfile.sesDomain && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${getStatusColor(partnerProfile.sesDomainStatus)}`}>
                {getStatusIcon(partnerProfile.sesDomainStatus)}
                <span className="font-medium">{getStatusText(partnerProfile.sesDomainStatus)}</span>
              </div>
            )}
          </div>

          {/* Domain Setup Form */}
          {(!partnerProfile.sesDomain || partnerProfile.sesDomainStatus === 'failed') && (
            <NeonContainer>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-white mb-4">
                  {partnerProfile.sesDomain ? 'Reconfigure Domain' : 'Setup Your Domain'}
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Domain Name *
                    </label>
                    <input
                      type="text"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      placeholder="example.com"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Enter your domain without 'www' or 'http://'
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        From Email Address *
                      </label>
                      <input
                        type="email"
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                        placeholder="noreply@example.com"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        From Name *
                      </label>
                      <input
                        type="text"
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        placeholder="Your Business Name"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleDomainSetup}
                    disabled={isSubmitting}
                    className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <FiRefreshCw className="w-4 h-4 animate-spin" />
                        Setting up domain...
                      </>
                    ) : (
                      <>
                        <FiMail className="w-4 h-4" />
                        Setup Domain
                      </>
                    )}
                  </button>
                </div>
              </div>
            </NeonContainer>
          )}

          {/* DNS Configuration Instructions */}
          {partnerProfile.sesDomain && partnerProfile.sesDomainStatus === 'pending_verification' && (
            <NeonContainer>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">DNS Configuration Required</h2>
                  <button
                    onClick={handleVerifyDomain}
                    disabled={isVerifying}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <FiRefreshCw className="w-4 h-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <FiCheck className="w-4 h-4" />
                        Verify Domain
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <FiInfo className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-blue-400 mb-1">DNS Records Setup Required</h3>
                      <p className="text-sm text-blue-300">
                        Add the following DNS records to your domain's DNS settings. This is typically done through your domain registrar or DNS provider (like Cloudflare, GoDaddy, Namecheap, etc.).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Domain Verification Record */}
                {partnerProfile.sesDomainVerificationToken && (
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-white mb-3">1. Domain Verification Record</h3>
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <label className="block text-gray-400 mb-1">Type</label>
                          <div className="flex items-center gap-2">
                            <code className="bg-gray-700 px-2 py-1 rounded text-white">TXT</code>
                            <button
                              onClick={() => copyToClipboard('TXT')}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                              <FiCopy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Name</label>
                          <div className="flex items-center gap-2">
                            <code className="bg-gray-700 px-2 py-1 rounded text-white break-all">
                              _amazonses.{partnerProfile.sesDomain}
                            </code>
                            <button
                              onClick={() => copyToClipboard(`_amazonses.${partnerProfile.sesDomain}`)}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                              <FiCopy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Value</label>
                          <div className="flex items-center gap-2">
                            <code className="bg-gray-700 px-2 py-1 rounded text-white break-all">
                              {partnerProfile.sesDomainVerificationToken}
                            </code>
                            <button
                              onClick={() => copyToClipboard(partnerProfile.sesDomainVerificationToken!)}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                              <FiCopy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* DKIM Records */}
                {partnerProfile.sesDkimTokens && (
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-white mb-3">2. DKIM Authentication Records</h3>
                    <p className="text-sm text-gray-400 mb-4">
                      Add these CNAME records to enable DKIM authentication for better email deliverability:
                    </p>

                    {JSON.parse(partnerProfile.sesDkimTokens).map((token: string, index: number) => (
                      <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 mb-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <label className="block text-gray-400 mb-1">Type</label>
                            <div className="flex items-center gap-2">
                              <code className="bg-gray-700 px-2 py-1 rounded text-white">CNAME</code>
                              <button
                                onClick={() => copyToClipboard('CNAME')}
                                className="p-1 text-gray-400 hover:text-white transition-colors"
                              >
                                <FiCopy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-1">Name</label>
                            <div className="flex items-center gap-2">
                              <code className="bg-gray-700 px-2 py-1 rounded text-white break-all">
                                {token}._domainkey.{partnerProfile.sesDomain}
                              </code>
                              <button
                                onClick={() => copyToClipboard(`${token}._domainkey.${partnerProfile.sesDomain}`)}
                                className="p-1 text-gray-400 hover:text-white transition-colors"
                              >
                                <FiCopy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-1">Value</label>
                            <div className="flex items-center gap-2">
                              <code className="bg-gray-700 px-2 py-1 rounded text-white break-all">
                                {token}.dkim.amazonses.com
                              </code>
                              <button
                                onClick={() => copyToClipboard(`${token}.dkim.amazonses.com`)}
                                className="p-1 text-gray-400 hover:text-white transition-colors"
                              >
                                <FiCopy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Additional DNS Recommendations */}
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-green-400 mb-3">3. Recommended Additional Records</h3>
                  <p className="text-sm text-green-300 mb-4">
                    These records are optional but highly recommended for better email deliverability:
                  </p>

                  {/* SPF Record */}
                  <div className="mb-4">
                    <h4 className="font-medium text-green-400 mb-2">SPF Record</h4>
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <code className="bg-gray-700 px-2 py-1 rounded text-white">TXT</code>
                        </div>
                        <div>
                          <code className="bg-gray-700 px-2 py-1 rounded text-white">{partnerProfile.sesDomain}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-700 px-2 py-1 rounded text-white break-all">
                            v=spf1 include:amazonses.com ~all
                          </code>
                          <button
                            onClick={() => copyToClipboard('v=spf1 include:amazonses.com ~all')}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                          >
                            <FiCopy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DMARC Record */}
                  <div>
                    <h4 className="font-medium text-green-400 mb-2">DMARC Record</h4>
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <code className="bg-gray-700 px-2 py-1 rounded text-white">TXT</code>
                        </div>
                        <div>
                          <code className="bg-gray-700 px-2 py-1 rounded text-white">_dmarc.{partnerProfile.sesDomain}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-700 px-2 py-1 rounded text-white break-all">
                            v=DMARC1; p=quarantine; rua=mailto:{partnerProfile.sesFromEmail}
                          </code>
                          <button
                            onClick={() => copyToClipboard(`v=DMARC1; p=quarantine; rua=mailto:${partnerProfile.sesFromEmail}`)}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                          >
                            <FiCopy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <FiAlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-yellow-400 mb-1">Important Notes</h4>
                      <ul className="text-sm text-yellow-300 space-y-1">
                        <li>• DNS changes can take up to 48 hours to propagate globally</li>
                        <li>• You can verify your domain once the DNS records are added</li>
                        <li>• Make sure to add all required records for proper email delivery</li>
                        <li>• Contact your DNS provider if you need help adding these records</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </NeonContainer>
          )}

          {/* Domain Status Dashboard */}
          {partnerProfile.sesDomain && partnerProfile.sesDomainStatus === 'verified' && (
            <NeonContainer>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Domain Status</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                      <div>
                        <h3 className="font-medium text-green-400">Domain Verified</h3>
                        <p className="text-sm text-green-300">{partnerProfile.sesDomain}</p>
                      </div>
                      <FiCheck className="w-6 h-6 text-green-400" />
                    </div>

                    <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                      <h3 className="font-medium text-white mb-2">Email Configuration</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">From Email:</span>
                          <span className="text-white">{partnerProfile.sesFromEmail}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">From Name:</span>
                          <span className="text-white">{partnerProfile.sesFromName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Verified:</span>
                          <span className="text-green-400">
                            {partnerProfile.sesDomainVerifiedAt
                              ? new Date(partnerProfile.sesDomainVerifiedAt).toLocaleDateString()
                              : 'Recently'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                      <h3 className="font-medium text-blue-400 mb-2">Email Service Active</h3>
                      <p className="text-sm text-blue-300">
                        Your domain is now ready to send professional emails. All customer notifications will be sent from your domain.
                      </p>
                    </div>

                    <div className="p-4 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                      <h3 className="font-medium text-purple-400 mb-3">Test Email Configuration</h3>
                      <p className="text-sm text-purple-300 mb-4">
                        Send a test email to verify your domain configuration is working properly.
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-purple-300 mb-2">
                            Test Email Address
                          </label>
                          <input
                            type="email"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="Enter email address to test"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                        <button
                          onClick={handleSendTestEmail}
                          disabled={isSendingTestEmail || !testEmail.trim()}
                          className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                          {isSendingTestEmail ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Sending Test Email...
                            </>
                          ) : (
                            <>
                              <FiMail className="w-4 h-4" />
                              Send Test Email
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                      <h3 className="font-medium text-white mb-2">Need Help?</h3>
                      <p className="text-sm text-gray-400 mb-3">
                        If you're experiencing issues with email delivery, check our troubleshooting guide.
                      </p>
                      <button
                        onClick={() => window.open('/docs/email-troubleshooting', '_blank')}
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                      >
                        <FiExternalLink className="w-4 h-4" />
                        View Troubleshooting Guide
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </NeonContainer>
          )}
        </div>
      </PartnerLayout>

      {/* Free Forever Upgrade Modal */}
      <FreeForeverUpgradeModal
        isOpen={showFreeForeverUpgrade}
        onClose={() => {
          setShowFreeForeverUpgrade(false);
          setPendingAction(null);
        }}
        onProceed={proceedWithPendingAction}
        title={freeForeverUpgradeData.title}
        message={freeForeverUpgradeData.message}
        featureDescription={freeForeverUpgradeData.featureDescription}
      />
    </ProtectedRoute>
  );
}
