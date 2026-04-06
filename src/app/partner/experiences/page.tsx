'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PartnerLayout from '@/components/partner/PartnerLayout';
import UpgradeModal from '@/components/partner/UpgradeModal';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';
import NeonContainer from '@/components/NeonContainer';
import {
  FiZap,
  FiPhone,
  FiMessageCircle,
  FiTrendingUp,
  FiHeadphones,
  FiCalendar,
  FiFilter,
  FiClipboard,
  FiDollarSign,
  FiUserPlus,
  FiCheck,
  FiLock,
  FiClock,
  FiToggleLeft,
  FiToggleRight,
  FiSettings,
  FiExternalLink,
  FiInfo,
  FiX,
  FiBookOpen,
} from 'react-icons/fi';
import { ExperienceType, ExperienceStatus } from '@/types/experience';
import { getAllExperiences } from '@/lib/experiences/experienceTypes';

// Map icon string names to actual icon components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FiZap,
  FiPhone,
  FiMessageCircle,
  FiTrendingUp,
  FiHeadphones,
  FiCalendar,
  FiFilter,
  FiClipboard,
  FiDollarSign,
  FiUserPlus,
};

interface EnabledExperience {
  id: string;
  experienceType: string;
  alias: string | null;
  displayName: string;
  enabled: boolean;
  totalProspects: number;
  totalCustomers: number;
}

// Status label mapping for experience types
const EXPERIENCE_STATUS_LABELS: Partial<Record<ExperienceType, { label: string; color: string }>> = {
  [ExperienceType.AI_RECEPTIONIST]: { label: 'Ready', color: 'bg-green-500/20 text-green-400' },
  [ExperienceType.AI_PERSONAL_ASSISTANT]: { label: 'Prototype', color: 'bg-orange-500/20 text-orange-400' },
  [ExperienceType.OPENCLAW_WHITELABEL_SERVICE]: { label: 'Beta', color: 'bg-teal-500/20 text-teal-400' },
  [ExperienceType.OPENCLAW_AUTOINSTALL]: { label: 'Beta', color: 'bg-orange-500/20 text-orange-400' },
};

export default function ExperiencesPage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [hasSaasMode, setHasSaasMode] = useState(false);
  const [enabledExperiences, setEnabledExperiences] = useState<EnabledExperience[]>([]);
  const [togglingExperience, setTogglingExperience] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isFreeForever, setIsFreeForever] = useState(false);
  const [entitlements, setEntitlements] = useState<Record<string, boolean>>({});
  const [showFreeForeverUpgradeModal, setShowFreeForeverUpgradeModal] = useState(false);
  const [freeForeverUpgradeData, setFreeForeverUpgradeData] = useState({ title: '', message: '', featureDescription: '' });
  const [partnerSubdomain, setPartnerSubdomain] = useState<string | null>(null);
  const [partnerCustomDomain, setPartnerCustomDomain] = useState<string | null>(null);
  const [infoExperience, setInfoExperience] = useState<ExperienceType | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }

    const storedName = localStorage.getItem('partner_name');
    if (storedName) setPartnerName(storedName);

    fetchExperiences(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchExperiences = async (token: string) => {
    try {
      const response = await fetch('/api/partner/experiences', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/partner/login');
          return;
        }
        // If API doesn't exist yet, show static catalog
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setCanCreate(data.canCreate ?? false);
        setHasSaasMode(data.hasSaasMode ?? false);
        setEnabledExperiences(data.experiences ?? []);
        setIsFreeForever(data.isFreeForever ?? false);
        setEntitlements(data.entitlements ?? {});
        setPartnerSubdomain(data.subdomain ?? null);
        setPartnerCustomDomain(data.customDomain ?? null);
      }
    } catch (error) {
      // suppress — treat as static catalog if API unavailable
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  /**
   * Check if this partner can enable a specific experience.
   * - Enterprise / manual-SaaS partners: always yes (canCreate = true, !isFreeForever)
   * - Free-forever partners with entitlement: yes
   * - Free-forever partners WITHOUT entitlement: show FreeForeverUpgradeModal
   * - Non-enterprise, non-free-forever: show standard UpgradeModal
   */
  const handleEnableExperience = (experienceType: ExperienceType) => {
    if (!canCreate) {
      if (isFreeForever) {
        const hasEntitlement = !!entitlements[experienceType];
        if (!hasEntitlement) {
          setFreeForeverUpgradeData({
            title: 'Invite-Only Experience',
            message: 'One-Click Experiences are currently invite-only for Free Forever partners. Book a quick call with our team to get early access.',
            featureDescription: `Launch the ${experienceType.replace(/_/g, ' ')} experience from your own branded portal.`,
          });
          setShowFreeForeverUpgradeModal(true);
          return;
        }
        // Has entitlement — fall through to the actual toggle
      } else {
        setShowUpgradeModal(true);
        return;
      }
    }
    handleToggleExperience(experienceType);
  };

  const handleToggleExperience = async (experienceType: ExperienceType) => {
    const token = localStorage.getItem('partner_token');
    if (!token) return;

    setTogglingExperience(experienceType);
    try {
      const existing = enabledExperiences.find(e => e.experienceType === experienceType);
      if (existing) {
        // Toggle enabled/disabled
        await fetch(`/api/partner/experiences/${existing.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ enabled: !existing.enabled }),
        });
      } else {
        // Create new experience
        await fetch('/api/partner/experiences', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ experienceType }),
        });
      }
      // Refresh
      await fetchExperiences(token);
    } catch {
      // Silently ignore — UI will stay in previous state
    } finally {
      setTogglingExperience(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        </div>
      </PartnerLayout>
    );
  }

  const allExperiences = getAllExperiences();
  const availableExperiences = allExperiences.filter(
    e => e.status === ExperienceStatus.AVAILABLE || e.status === ExperienceStatus.BETA
  );
  const comingSoonExperiences = allExperiences.filter(e => e.status === ExperienceStatus.COMING_SOON);

  const getEnabledState = (type: ExperienceType) => {
    return enabledExperiences.find(e => e.experienceType === type);
  };

  const getIconComponent = (iconName: string) => {
    return ICON_MAP[iconName] || FiZap;
  };

  // Elevator-pitch blurbs shown in the info overlay — who it's for + what agency gets
  const EXPERIENCE_INFO: Partial<Record<ExperienceType, { audience: string; agencyBenefit: string; highlights: string[] }>> = {
    [ExperienceType.AI_RECEPTIONIST]: {
      audience: 'Local businesses that miss calls and lose customers — restaurants, clinics, salons, law firms.',
      agencyBenefit: 'Recurring monthly retainer per client. Zero maintenance once deployed.',
      highlights: ['Handles inbound calls 24/7', 'Books appointments automatically', 'Routes to the right staff', 'Speaks in the client\'s language'],
    },
    [ExperienceType.AI_PERSONAL_ASSISTANT]: {
      audience: 'Busy founders, coaches, consultants, and executives who live in WhatsApp.',
      agencyBenefit: 'High perceived value — clients feel they have a dedicated EA. Easy upsell to the full AI Org.',
      highlights: ['Lives natively in WhatsApp', 'Manages calendar & tasks', 'Answers questions from their knowledge base', 'Connects Gmail, Notion, and more'],
    },
    [ExperienceType.OPENCLAW_WHITELABEL_SERVICE]: {
      audience: 'Established businesses ready to build a complete AI-powered operation — marketing, sales, support & ops.',
      agencyBenefit: 'Your highest-ticket productized offer. You build the full AI Org under your brand — OpenClaw does the heavy lifting.',
      highlights: ['Full AI team: marketing, sales, support, ops', 'Custom-branded under your agency', 'Premium discovery-to-deployment workflow', 'Upsell from Setup Service conversations'],
    },
    [ExperienceType.OPENCLAW_AUTOINSTALL]: {
      audience: 'Tech-savvy individuals and small teams who want a personal AI wired into their daily apps immediately.',
      agencyBenefit: 'Low-touch, high-volume offer. One click to install — customers self-serve. Great for lead generation and community upsells.',
      highlights: ['Auto-connects Gmail, Calendar, Notion', 'Telegram as the AI interface', 'No technical knowledge required', 'Fast activation — under 5 minutes'],
    },
    [ExperienceType.OPENCLAW_SETUP_SERVICE]: {
      audience: 'Prospects who need hand-holding — they want OpenClaw but aren\'t sure how to configure it themselves.',
      agencyBenefit: 'Paid consulting call booked directly from your landing page. A natural gateway into the full Whitelabel Service.',
      highlights: ['Prospects self-book your calendar', 'Guided setup call — you stay in control', 'Capture lead info before the call', 'Natural upsell to Experience 1 (AI Org)'],
    },
  };

  return (
    <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
      {/* Upgrade Modal for non-enterprise, non-free-forever users */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="One-Click Experiences"
        message="Launch productized AI solutions for your customers in minutes. Upgrade to Enterprise to unlock One-Click Experiences."
        upgradeButtonText="Upgrade to Enterprise"
      />

      {/* Free Forever Upgrade Modal — invite-only gate */}
      <FreeForeverUpgradeModal
        isOpen={showFreeForeverUpgradeModal}
        onClose={() => setShowFreeForeverUpgradeModal(false)}
        title={freeForeverUpgradeData.title}
        message={freeForeverUpgradeData.message}
        featureDescription={freeForeverUpgradeData.featureDescription}
      />

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FiZap className="w-8 h-8 text-yellow-400" />
          <h1 className="text-3xl font-bold">One-Click Experiences</h1>
          <span className="px-2.5 py-1 text-xs font-semibold bg-blue-500/20 text-blue-400 rounded-full">Beta</span>
        </div>
        <p className="text-gray-400 text-lg">
          Launch productized AI solutions for your customers. Each experience comes with its own landing page, onboarding flow, and agent deployment.
        </p>
      </div>

      {/* Available Experiences */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FiCheck className="text-green-400" />
          Available Experiences
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableExperiences.map((config) => {
            const enabled = getEnabledState(config.type);
            const IconComponent = getIconComponent(config.icon);
            const isToggling = togglingExperience === config.type;
            const statusLabel = EXPERIENCE_STATUS_LABELS[config.type as ExperienceType];
            // AI Receptionist is active if partner has SaaS mode enabled (it IS the SaaS mode)
            const isReceptionistActive = config.type === ExperienceType.AI_RECEPTIONIST && hasSaasMode;
            const isActive = enabled?.enabled || isReceptionistActive;

            return (
              <NeonContainer key={config.type} className="h-full p-6 relative group hover:scale-[1.02] transition-all duration-200">
                <div className="flex flex-col h-full">
                  {/* Status badges + info button - top right */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {statusLabel && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabel.color}`}>
                        {statusLabel.label}
                      </span>
                    )}
                    {isActive && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                        <FiCheck className="w-3 h-3" />
                        Active
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setInfoExperience(config.type); }}
                      title="What is this service?"
                      className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <FiInfo className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-start gap-4 mb-4 min-h-[4.5rem]">
                    <div
                      className="p-3 rounded-xl flex-shrink-0"
                      style={{ backgroundColor: `${config.color}20`, color: config.color }}
                    >
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{config.name}</h3>
                      <p className="text-sm text-gray-400">{config.shortDescription}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-300 text-sm mb-4 line-clamp-3 min-h-[3.75rem]">
                    {config.longDescription}
                  </p>

                  {/* Meta info */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span className="capitalize">{config.category}</span>
                    <span>•</span>
                    <span>{config.totalOnboardingSteps} onboarding steps</span>
                    {config.defaultAlias && (
                      <>
                        <span>•</span>
                        <span className="font-mono">{config.defaultAlias}</span>
                      </>
                    )}
                    {!config.defaultAlias && (
                      <>
                        <span>•</span>
                        <span className="text-blue-400">Root domain</span>
                      </>
                    )}
                  </div>

                  {/* Stats - always reserve space */}
                  <div className="flex items-center gap-6 text-sm mb-4 p-3 bg-gray-800/50 rounded-lg min-h-[3rem]">
                    {enabled ? (
                      <>
                        <div>
                          <span className="text-gray-400">Prospects:</span>{' '}
                          <span className="font-semibold">{enabled.totalProspects}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Customers:</span>{' '}
                          <span className="font-semibold">{enabled.totalCustomers}</span>
                        </div>
                      </>
                    ) : isReceptionistActive ? (
                      <span className="text-gray-400 text-xs">Managed via SaaS Portal settings</span>
                    ) : (
                      <span className="text-gray-500 text-xs">Enable to view stats</span>
                    )}
                  </div>

                  {/* Actions - pushed to bottom */}
                  <div className="flex items-center gap-3 mt-auto">
                    {(() => {
                      // Determine whether this partner can enable this specific experience
                      const hasEntitlement = !!entitlements[config.type];
                      const partnerCanEnable = canCreate || (isFreeForever && hasEntitlement);

                      if (partnerCanEnable) {
                        return (
                          <button
                            onClick={() => handleToggleExperience(config.type)}
                            disabled={isToggling}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              enabled?.enabled
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                : 'bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white'
                            } ${isToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isToggling ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current" />
                            ) : enabled?.enabled ? (
                              <FiToggleRight className="w-4 h-4" />
                            ) : (
                              <FiToggleLeft className="w-4 h-4" />
                            )}
                            {enabled?.enabled ? 'Disable' : 'Enable'}
                          </button>
                        );
                      }

                      // Not entitled — show appropriate upgrade CTA
                      return (
                        <button
                          onClick={() => handleEnableExperience(config.type)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            isFreeForever
                              ? 'bg-teal-600/20 hover:bg-teal-600/30 text-teal-400 hover:text-teal-300'
                              : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 hover:text-purple-300'
                          }`}
                        >
                          <FiLock className="w-4 h-4" />
                          {isFreeForever ? 'Request Access' : 'Upgrade to Enable'}
                        </button>
                      );
                    })()}

                    {(enabled?.enabled || isReceptionistActive) && (
                      <>
                        <button
                          onClick={() => router.push(`/partner/experiences/${config.type.toLowerCase()}/settings`)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
                          title="Settings"
                        >
                          <FiSettings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            // Open the experience landing page on the partner's domain
                            const alias = enabled?.alias || config.defaultAlias;
                            if (alias) {
                              let baseUrl = '';
                              if (partnerCustomDomain) {
                                baseUrl = `https://${partnerCustomDomain}`;
                              } else if (partnerSubdomain) {
                                const isLocalDev = window.location.hostname.includes('localhost') || window.location.hostname.includes('.lvh.me');
                                if (isLocalDev) {
                                  const port = window.location.port ? `:${window.location.port}` : '';
                                  baseUrl = `http://${partnerSubdomain}.lvh.me${port}`;
                                } else {
                                  baseUrl = `https://${partnerSubdomain}.knotie-ai.pro`;
                                }
                              }
                              const fullUrl = baseUrl ? `${baseUrl}${alias}` : alias;
                              window.open(fullUrl, '_blank');
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
                          title="View Landing Page"
                        >
                          <FiExternalLink className="w-4 h-4" />
                        </button>
                        {config.type === ExperienceType.OPENCLAW_SETUP_SERVICE &&
                          process.env.NEXT_PUBLIC_OPENCLAW_SETUP_GUIDE_URL && (
                          <button
                            onClick={() => window.open(process.env.NEXT_PUBLIC_OPENCLAW_SETUP_GUIDE_URL, '_blank')}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 transition-all"
                            title="Setup Guide — reference this during the prospect's call"
                          >
                            <FiBookOpen className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </NeonContainer>
            );
          })}
        </div>
      </div>

      {/* Coming Soon Experiences */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FiClock className="text-yellow-400" />
          Coming Soon
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {comingSoonExperiences.map((config) => {
            const IconComponent = getIconComponent(config.icon);

            return (
              <NeonContainer key={config.type} className="h-full p-6 opacity-60 relative">
                <div className="flex flex-col h-full">
                  {/* Coming Soon badge + info button */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">
                      <FiClock className="w-3 h-3" />
                      Coming Soon
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setInfoExperience(config.type); }}
                      title="What is this service?"
                      className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <FiInfo className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-start gap-4 mb-4 min-h-[4.5rem]">
                    <div
                      className="p-3 rounded-xl flex-shrink-0"
                      style={{ backgroundColor: `${config.color}20`, color: config.color }}
                    >
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{config.name}</h3>
                      <p className="text-sm text-gray-400">{config.shortDescription}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-400 text-sm mb-4 line-clamp-3 min-h-[3.75rem]">
                    {config.longDescription}
                  </p>

                  {/* Meta info */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span className="capitalize">{config.category}</span>
                    <span>•</span>
                    <span>{config.totalOnboardingSteps} onboarding steps</span>
                  </div>

                  {/* Disabled button - pushed to bottom */}
                  <div className="mt-auto">
                    <button
                      disabled
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-700/30 text-gray-500 cursor-not-allowed"
                    >
                      <FiLock className="w-4 h-4" />
                      Coming Soon
                    </button>
                  </div>
                </div>
              </NeonContainer>
            );
          })}
        </div>
      </div>

      {/* ── Experience Info Modal ── */}
      {infoExperience && (() => {
        const cfg = getAllExperiences().find(e => e.type === infoExperience);
        const pitch = EXPERIENCE_INFO[infoExperience];
        if (!cfg) return null;
        const InfoIcon = getIconComponent(cfg.icon);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setInfoExperience(null)}
          >
            <div
              className="relative w-full max-w-lg rounded-2xl border border-white/10 p-6 shadow-2xl"
              style={{ backgroundColor: '#0D0F1A' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setInfoExperience(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <FiX className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-4 mb-5">
                <div className="p-3 rounded-xl flex-shrink-0" style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}>
                  <InfoIcon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{cfg.name}</h3>
                  <p className="text-sm text-gray-400">{cfg.shortDescription}</p>
                </div>
              </div>

              {/* Full description */}
              <p className="text-gray-300 text-sm mb-5 leading-relaxed">{cfg.longDescription}</p>

              {pitch && (
                <>
                  {/* Audience */}
                  <div className="mb-4 p-3 rounded-lg border border-white/5 bg-white/[0.03]">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: cfg.color }}>Who is this for?</p>
                    <p className="text-sm text-gray-300">{pitch.audience}</p>
                  </div>

                  {/* Agency benefit */}
                  <div className="mb-4 p-3 rounded-lg border border-white/5 bg-white/[0.03]">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: cfg.color }}>Agency benefit</p>
                    <p className="text-sm text-gray-300">{pitch.agencyBenefit}</p>
                  </div>

                  {/* Highlights */}
                  <ul className="space-y-1.5">
                    {pitch.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <FiCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: cfg.color }} />
                        {h}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Meta footer */}
              <div className="flex items-center gap-4 mt-5 pt-4 border-t border-white/10 text-xs text-gray-500">
                <span className="capitalize">{cfg.category}</span>
                <span>•</span>
                <span>{cfg.totalOnboardingSteps} onboarding steps</span>
                {cfg.defaultAlias && <><span>•</span><span className="font-mono">{cfg.defaultAlias}</span></>}
              </div>
            </div>
          </div>
        );
      })()}
    </PartnerLayout>
  );
}

