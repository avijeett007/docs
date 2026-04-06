'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PartnerLayout from '@/components/partner/PartnerLayout';
import ProspectDetailsModal from '@/components/partner/ProspectDetailsModal';
import UpgradeModal from '@/components/partner/UpgradeModal';
import NeonContainer from '@/components/NeonContainer';
import {
  FiUsers,
  FiMail,
  FiPhone,
  FiCalendar,
  FiEye,
  FiGlobe,
  FiCheckCircle,
  FiClock,
  FiUser,
  FiZap
} from 'react-icons/fi';
import { PartnerTier } from '@/lib/portalModes';

// Human-readable labels and colors for each experience type
const EXPERIENCE_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  AI_RECEPTIONIST:           { label: 'AI Receptionist',        color: '#60A5FA', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)' },
  AI_PERSONAL_ASSISTANT:     { label: 'Personal Assistant',     color: '#34D399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  OPENCLAW_WHITELABEL_SERVICE: { label: 'Whitelabel OpenClaw',  color: '#00C4B4', bg: 'rgba(0,196,180,0.1)',  border: 'rgba(0,196,180,0.3)' },
  OPENCLAW_AUTOINSTALL:      { label: 'OpenClaw Auto-Install',  color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' },
  OPENCLAW_SETUP_SERVICE:    { label: 'OpenClaw Setup Call',    color: '#FB923C', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.3)' },
};

interface Prospect {
  id: string;
  businessName: string;
  businessWebsite: string | null;
  hasNoWebsite: boolean;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  currentStep: number;
  isCompleted: boolean;
  convertedToCustomerId: string | null;
  experienceType: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ProspectsPage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerTier, setPartnerTier] = useState<PartnerTier | null>(null); // Start with null to indicate loading
  const [hasSaasAccess, setHasSaasAccess] = useState(false); // SaaS mode or enterprise tier
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }

    const storedName = localStorage.getItem('partner_name');
    if (storedName) {
      setPartnerName(storedName);
    }

    fetchProspectsWithAccess(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  /**
   * Fetch prospects data in a single API call that includes access check
   * This is much faster than the previous approach of making 3 sequential API calls
   */
  const fetchProspectsWithAccess = async (token: string) => {
    try {
      // Single API call that handles authentication, tier check, SaaS access, and data fetching
      const response = await fetch('/api/partner/prospects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/partner/login');
          return;
        }
        console.error('Failed to fetch prospects:', response.status);
        return;
      }

      const data = await response.json();

      // Map server tier string to PartnerTier enum
      let tier: PartnerTier;
      switch (data.tier) {
        case 'enterprise':
          tier = PartnerTier.ENTERPRISE;
          break;
        case 'pro':
          tier = PartnerTier.PRO;
          break;
        case 'starter':
          tier = PartnerTier.STARTER;
          break;
        case 'lifetime_pro':
          tier = PartnerTier.LIFETIME;
          break;
        case 'free_forever':
        default:
          tier = PartnerTier.FREE_FOREVER;
          break;
      }

      setPartnerTier(tier);
      setHasSaasAccess(data.hasSaasAccess || false);
      setProspects(data.prospects || []);

    } catch (error) {
      console.error('Error fetching prospects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  const handleViewDetails = (prospectId: string) => {
    setSelectedProspectId(prospectId);
    setShowDetailsModal(true);
  };

  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedProspectId(null);
  };

  const getStepName = (step: number) => {
    const steps = [
      'Business Info',
      'Website Verification', 
      'Contact Details',
      'Service Categories',
      'Knowledge Base',
      'Greeting Setup',
      'Information Collection',
      'Communication Settings',
      'Summary & Deploy'
    ];
    return steps[step - 1] || 'Unknown';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Show upgrade modal for users without SaaS access (only after loading is complete)
  // Wait until loading is complete to avoid flashing the modal while access checks are in progress
  if (!loading && partnerTier !== null && !hasSaasAccess) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <UpgradeModal
          isOpen={true}
          onClose={() => router.push('/partner/dashboard')}
          title="Prospects Feature"
          message="Track and manage your SaaS portal prospects with our Ultimate Scale Agency tier or enable SaaS Mode."
          upgradeButtonText="Upgrade to Ultimate Scale Agency"
        />
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
      <div className="space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Prospects</h1>
          <p className="text-gray-300">
            Track customers going through your SaaS portal onboarding process
          </p>
        </div>

        {loading || partnerTier === null ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : prospects.length === 0 ? (
          <div className="text-center py-12">
            <FiUsers className="mx-auto text-6xl text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No prospects yet</h3>
            <p className="text-gray-300">
              Prospects will appear here when customers start your SaaS portal onboarding process.
            </p>
          </div>
        ) : (
          /* Responsive card-based grid layout */
          <div className="grid grid-cols-1 gap-4">
            {prospects.map((prospect) => (
              <NeonContainer key={prospect.id}>
                <div className="p-4 sm:p-6 hover:bg-gray-800/30 transition-colors rounded-lg">
                  {/* Mobile-first responsive layout */}
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Left section: Business & Contact info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h2 className="text-lg sm:text-xl font-semibold text-white truncate">
                          {prospect.businessName || 'Unnamed Business'}
                        </h2>
                        {/* Status Badge */}
                        {prospect.isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30 rounded-full">
                            <FiCheckCircle className="w-3 h-3" />
                            Completed
                          </span>
                        ) : prospect.convertedToCustomerId ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                            <FiUser className="w-3 h-3" />
                            Customer
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full">
                            <FiClock className="w-3 h-3" />
                            In Progress
                          </span>
                        )}
                        {/* Experience / Service Badge */}
                        {prospect.experienceType && (() => {
                          const exp = EXPERIENCE_LABELS[prospect.experienceType!];
                          if (!exp) return null;
                          return (
                            <span style={{ background: exp.bg, border: `1px solid ${exp.border}`, color: exp.color }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full">
                              <FiZap className="w-3 h-3" />
                              {exp.label}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Website */}
                      {prospect.businessWebsite ? (
                        <p className="text-sm text-gray-400 flex items-center gap-1 mb-2 truncate">
                          <FiGlobe className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{prospect.businessWebsite}</span>
                        </p>
                      ) : prospect.hasNoWebsite && (
                        <p className="text-sm text-gray-500 italic mb-2">No website</p>
                      )}

                      {/* Contact Info - Responsive grid */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                        {(prospect.firstName || prospect.lastName) && (
                          <span className="flex items-center gap-1">
                            <FiUser className="w-3 h-3 flex-shrink-0" />
                            {prospect.firstName} {prospect.lastName}
                          </span>
                        )}
                        {prospect.email && (
                          <span className="flex items-center gap-1 truncate max-w-[200px] sm:max-w-none">
                            <FiMail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{prospect.email}</span>
                          </span>
                        )}
                        {prospect.phone && (
                          <span className="flex items-center gap-1">
                            <FiPhone className="w-3 h-3 flex-shrink-0" />
                            {prospect.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle section: Progress */}
                    <div className="flex-shrink-0 w-full sm:w-auto lg:w-48">
                      <div className="flex items-center gap-3 sm:flex-col sm:items-start lg:items-center">
                        <div className="flex-1 sm:w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-white">
                              Step {prospect.currentStep}/9
                            </span>
                            <span className="text-xs text-gray-400 hidden sm:inline">
                              {getStepName(prospect.currentStep)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-600 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(prospect.currentStep / 9) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 sm:hidden mt-1 block">
                            {getStepName(prospect.currentStep)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right section: Date & Actions */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-2 sm:gap-4 lg:gap-2">
                      <div className="text-sm text-gray-400 flex items-center gap-1">
                        <FiCalendar className="w-3 h-3" />
                        <span className="hidden sm:inline">{formatDate(prospect.createdAt)}</span>
                        <span className="sm:hidden">{new Date(prospect.createdAt).toLocaleDateString()}</span>
                      </div>
                      <button
                        onClick={() => handleViewDetails(prospect.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center"
                      >
                        <FiEye className="w-4 h-4" />
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </NeonContainer>
            ))}
          </div>
        )}

        {/* Prospect Details Modal */}
        <ProspectDetailsModal
          isOpen={showDetailsModal}
          onClose={handleCloseDetailsModal}
          prospectId={selectedProspectId}
        />
      </div>
    </PartnerLayout>
  );
}
