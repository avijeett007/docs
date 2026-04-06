'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  Users,
  Bot,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Globe,
  Settings,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Download,
  PhoneCall,
  Zap,
} from 'lucide-react';
import { ExperienceType } from '@/types/experience';
import { getAllExperiences } from '@/lib/experiences/experienceTypes';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

interface PartnerDetails {
  id: string;
  businessName: string;
  email: string;
  contactName: string;
  phoneNumber: string;
  logo?: string;
  createdAt: string;
  updatedAt: string;
  subdomain?: string;
  customDomain?: string;
  manualSaasModeEnabled?: boolean;
  manualBYOAModeEnabled?: boolean;
  portalMode?: string;
  subscription: {
    planId: string;
    billingInterval: string;
    status: string;
    marketingTier: string;
    approvalStatus: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripeAccountId?: string;
    stripeChargesEnabled: boolean;
    stripeOnboardingCompleted: boolean;
  };
  credits: {
    balance: number;
    fractionalCredits: number;
    monthlyAllocation: number;
    lastAllocationDate?: string;
    lowThreshold?: number;
    telephonyBalance: number;
    recentTransactions: Array<{
      id: string;
      amount: number;
      type: string;
      description: string;
      createdAt: string;
    }>;
  };
  trial: {
    hasStarted: boolean;
    startedAt?: string;
    endedAt?: string;
  };
  onboarding: {
    progress: {
      step1_customizePod: boolean;
      step2_onboardCustomer: boolean;
      step3_importAgent: boolean;
      step4_reviewAnalytics: boolean;
      step5_completeWhitelabel: boolean;
      step6_setupPayments: boolean;
      completedSteps: number;
      totalSteps: number;
      isComplete: boolean;
      progressPercentage: number;
    } | null;
    walkthroughStartedAt?: string;
    walkthroughCompletedAt?: string;
    currentStep?: number;
    skipped: boolean;
    hasSeenWelcomeVideo: boolean;
  };
  configuration: {
    useCustomSmtp: boolean;
    smtpHost?: string;
    useSESDomain: boolean;
    sesDomainStatus?: string;
  };
  access: {
    canCreateCustomers: boolean;
    canCreateAgents: boolean;
  };
  experienceEntitlements: Record<string, boolean>;
  stats: {
    totalCustomers: number;
    activeCustomers: number;
    totalAgents: number;
    agentsByProvider: {
      retell: number;
      vapi: number;
      ultravox: number;
      elevenlabs: number;
      ghl: number;
      knova: number;
      n8nChat: number;
    };
    teamMembers: number;
  };
  recentCustomers: Array<{
    id: string;
    email: string;
    name: string;
    createdAt: string;
    lastLogin?: string;
    status: string;
  }>;
  waitlistHistory: {
    wasOnWaitlist: boolean;
    waitlistId?: string;
    waitlistName?: string;
    waitlistPosition?: number;
    waitlistStatus?: string;
    waitlistSource?: string;
    referralCode?: string;
    referralCount?: number;
    waitlistJoinedAt?: string;
    waitlistUpdatedAt?: string;
  };
  phoneActivations?: PhoneActivation[];
}

interface PhoneActivation {
  id: string;
  country: string;
  businessName: string;
  businessType?: string;
  businessAddress: any;
  businessRegistrationNumber?: string;
  businessRegistrationAuthority?: string;
  businessWebsite?: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  documents: any[];
  twilioSubaccountSid?: string;
  twilioAddressSid?: string;
  twilioEndUserSid?: string;
  twilioSupportingDocSids?: string[];
  regulatoryBundleSid?: string;
  regulatoryBundleStatus: string;
  regulatoryBundleType?: string;
  rejectionReason?: string;
  status: string;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const ACTIVATION_STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'active', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'more_info_needed', label: 'More Info Needed' },
  { value: 'resubmission_needed', label: 'Resubmission Needed' },
];

export default function PartnerDetailsPage() {
  const { user } = useAdminAuth();
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const partnerId = params?.id as string;
  
  const [partner, setPartner] = useState<PartnerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingSaasMode, setUpdatingSaasMode] = useState(false);
  const [updatingBYOAMode, setUpdatingBYOAMode] = useState(false);
  const [updatingActivationId, setUpdatingActivationId] = useState<string | null>(null);
  const [updatingEntitlement, setUpdatingEntitlement] = useState<string | null>(null);

  useEffect(() => {
    const fetchPartnerDetails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/partners/${partnerId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch partner details');
        }
        const data = await response.json();
        if (data.success) {
          setPartner(data.data);
        } else {
          throw new Error(data.error || 'Failed to fetch partner details');
        }
      } catch (err: any) {
        console.error('Error fetching partner details:', err);
        setError(err.message || 'An error occurred while fetching partner details');
      } finally {
        setLoading(false);
      }
    };

    if (user && partnerId) {
      fetchPartnerDetails();
    }
  }, [user, partnerId]);

  const handleSaasModeToggle = async () => {
    if (!partner) return;

    const newValue = !partner.manualSaasModeEnabled;

    try {
      setUpdatingSaasMode(true);

      const response = await fetch(`/api/admin/partners/${partnerId}/saas-mode`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          manualSaasModeEnabled: newValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update SaaS mode (${response.status})`);
      }

      await response.json();

      // Update the partner in the local state
      setPartner(prev => prev ? {
        ...prev,
        manualSaasModeEnabled: newValue
      } : null);

      // Show success toast
      toast({
        title: "✅ SaaS Mode Updated",
        description: `Manual SaaS mode ${newValue ? 'enabled' : 'disabled'} for ${partner.businessName}`,
        className: "bg-green-900 border-green-700 text-green-100 shadow-lg",
      });

    } catch (error: any) {
      console.error('Error updating SaaS mode:', error);

      // Show error toast
      toast({
        title: "❌ Update Failed",
        description: error.message || 'Failed to update SaaS mode. Please try again.',
        className: "bg-red-900 border-red-700 text-red-100 shadow-lg",
      });
    } finally {
      setUpdatingSaasMode(false);
    }
  };

  const handleBYOAModeToggle = async () => {
    if (!partner) return;

    const newValue = !partner.manualBYOAModeEnabled;

    try {
      setUpdatingBYOAMode(true);

      const response = await fetch(`/api/admin/partners/${partnerId}/byoa-mode`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          manualBYOAModeEnabled: newValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update BYOA mode (${response.status})`);
      }

      await response.json();

      // Update the partner in the local state
      setPartner(prev => prev ? {
        ...prev,
        manualBYOAModeEnabled: newValue
      } : null);

      // Show success toast
      toast({
        title: "✅ BYOA Mode Updated",
        description: `Manual BYOA mode ${newValue ? 'enabled' : 'disabled'} for ${partner.businessName}`,
        className: "bg-green-900 border-green-700 text-green-100 shadow-lg",
      });

    } catch (error: any) {
      console.error('Error updating BYOA mode:', error);

      // Show error toast
      toast({
        title: "❌ Update Failed",
        description: error.message || 'Failed to update BYOA mode. Please try again.',
        className: "bg-red-900 border-red-700 text-red-100 shadow-lg",
      });
    } finally {
      setUpdatingBYOAMode(false);
    }
  };

  const handleEntitlementToggle = async (experienceType: ExperienceType, currentValue: boolean) => {
    if (!partner) return;
    const newValue = !currentValue;
    setUpdatingEntitlement(experienceType);
    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/experience-entitlements`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceType, enabled: newValue }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update entitlement (${response.status})`);
      }
      const result = await response.json();
      const updatedEntitlements = (result.partner?.experienceEntitlements ?? {}) as Record<string, boolean>;
      setPartner(prev => prev ? { ...prev, experienceEntitlements: updatedEntitlements } : null);
      toast({
        title: `✅ Entitlement ${newValue ? 'Granted' : 'Revoked'}`,
        description: `${experienceType.replace(/_/g, ' ')} ${newValue ? 'enabled' : 'disabled'} for ${partner.businessName}`,
        className: 'bg-green-900 border-green-700 text-green-100 shadow-lg',
      });
    } catch (error: any) {
      toast({
        title: '❌ Update Failed',
        description: error.message || 'Failed to update entitlement. Please try again.',
        className: 'bg-red-900 border-red-700 text-red-100 shadow-lg',
      });
    } finally {
      setUpdatingEntitlement(null);
    }
  };

  const handleActivationStatusUpdate = async (activationId: string, newStatus: string, rejectionReason?: string) => {
    try {
      setUpdatingActivationId(activationId);

      const response = await fetch(`/api/admin/partners/${partnerId}/phone-activations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activationId, status: newStatus, rejectionReason }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update activation status (${response.status})`);
      }

      const result = await response.json();

      // Update the partner state with the new activation status
      setPartner(prev => prev ? {
        ...prev,
        phoneActivations: prev.phoneActivations?.map(act =>
          act.id === activationId ? { ...act, ...result.data } : act
        )
      } : null);

      toast({
        title: "✅ Status Updated",
        description: `Activation status updated to ${newStatus}`,
        className: "bg-green-900 border-green-700 text-green-100 shadow-lg",
      });
    } catch (error: any) {
      console.error('Error updating activation status:', error);
      toast({
        title: "❌ Update Failed",
        description: error.message || 'Failed to update activation status. Please try again.',
        className: "bg-red-900 border-red-700 text-red-100 shadow-lg",
      });
    } finally {
      setUpdatingActivationId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'ACTIVE': { variant: 'default' as const, className: 'bg-green-500 text-white font-semibold border-green-600', label: 'Active' },
      'INACTIVE': { variant: 'secondary' as const, className: 'bg-gray-500 text-white font-semibold border-gray-600', label: 'Inactive' },
      'TRIAL_ENDED': { variant: 'destructive' as const, className: 'bg-red-500 text-white font-semibold border-red-600', label: 'Trial Ended' },
      'PENDING': { variant: 'secondary' as const, className: 'bg-yellow-500 text-white font-semibold border-yellow-600', label: 'Pending' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.INACTIVE;
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getPlanTierFromPlanId = (planId: string) => {
    // Map plan IDs to tier information
    const planMapping = {
      'price_1SPL9iPSne5Mmb5MKoyKmQLh': { tier: 'FREE_FOREVER', label: 'Free Forever' },
      'price_1SPT7hAWuW40e96R0EN6eJq0': { tier: 'FREE_FOREVER', label: 'Free Forever' },
      'price_1SPLANPSne5Mmb5MXoVgCENI': { tier: 'FREE_TRIAL', label: 'Free Trial' },
      'price_1SPLC9PSne5Mmb5MNhd8kw38': { tier: 'STARTER_TRIAL', label: 'Starter Trial' },
      'price_1RXRwEPSne5Mmb5MzPr5Yqj7': { tier: 'STARTER', label: 'Starter Monthly' },
      'price_1QzNnTFPMP5WxW7GnR1HI99Z': { tier: 'STARTER', label: 'Starter Yearly' },
      'price_1RXRx6PSne5Mmb5MTv5LHMdP': { tier: 'PROFESSIONAL', label: 'Professional Monthly' },
      'price_1QzNmGFPMP5WxW7GJenhyeTK': { tier: 'PROFESSIONAL', label: 'Professional Yearly' },
      'price_1QzTb5FPMP5WxW7GNsBa9Zbw': { tier: 'LIFETIME_PRO', label: 'Lifetime Pro' },
      'price_1SPLD9PSne5Mmb5MPjFF7hVB': { tier: 'STARTER_SPECIAL', label: 'Starter Special Monthly' },
      'price_1SPLHFPSne5Mmb5MHTV7Azpx': { tier: 'STARTER_SPECIAL', label: 'Starter Special Yearly' },
    };

    return planMapping[planId as keyof typeof planMapping] || { tier: 'UNKNOWN', label: planId || 'Unknown Plan' };
  };

  const getTierBadge = (planId: string) => {
    const planInfo = getPlanTierFromPlanId(planId);

    const tierConfig = {
      'FREE_FOREVER': { className: 'bg-blue-500 text-white font-semibold border-blue-600', label: planInfo.label },
      'FREE_TRIAL': { className: 'bg-yellow-500 text-white font-semibold border-yellow-600', label: planInfo.label },
      'STARTER_TRIAL': { className: 'bg-yellow-500 text-white font-semibold border-yellow-600', label: planInfo.label },
      'STARTER': { className: 'bg-green-500 text-white font-semibold border-green-600', label: planInfo.label },
      'STARTER_SPECIAL': { className: 'bg-purple-500 text-white font-semibold border-purple-600', label: planInfo.label },
      'PROFESSIONAL': { className: 'bg-emerald-500 text-white font-semibold border-emerald-600', label: planInfo.label },
      'LIFETIME_PRO': { className: 'bg-amber-500 text-white font-semibold border-amber-600', label: planInfo.label },
      'UNKNOWN': { className: 'bg-gray-500 text-white font-semibold border-gray-600', label: planInfo.label },
    };

    const config = tierConfig[planInfo.tier as keyof typeof tierConfig] || tierConfig.UNKNOWN;
    return (
      <Badge className={`${config.className} border`}>
        {config.label}
      </Badge>
    );
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin h-8 w-8 border-4 border-gray-300 rounded-full border-t-blue-600"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !partner) {
    return (
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error || 'Partner not found'}</AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />
      <div className="flex-1 overflow-auto bg-gray-900">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center space-x-3">
                {partner.logo ? (
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                    <Image 
                      src={partner.logo} 
                      alt={partner.businessName} 
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-semibold">
                    {partner.businessName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">{partner.businessName}</h1>
                  <p className="text-gray-300">{partner.email}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link href={`/mission-control/email?partner=${partner.id}`}>
                <Button>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
              </Link>
            </div>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-300">Status</p>
                    <div className="mt-1">
                      {getStatusBadge(partner.subscription.status)}
                    </div>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-300">Plan Tier</p>
                    <div className="mt-1">
                      {getTierBadge(partner.subscription.planId)}
                    </div>
                  </div>
                  <CreditCard className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-300">Customers</p>
                    <p className="text-2xl font-bold text-white">{partner.stats.totalCustomers}</p>
                    <p className="text-xs text-gray-400">{partner.stats.activeCustomers} active</p>
                  </div>
                  <Users className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-300">AI Agents</p>
                    <p className="text-2xl font-bold text-white">{partner.stats.totalAgents}</p>
                    <p className="text-xs text-gray-400">across all providers</p>
                  </div>
                  <Bot className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-300">SaaS Mode</p>
                    <div className="mt-1 flex items-center space-x-2">
                      <div className="relative">
                        <Switch
                          checked={partner.manualSaasModeEnabled || false}
                          onCheckedChange={handleSaasModeToggle}
                          disabled={updatingSaasMode}
                          className="data-[state=checked]:bg-green-600"
                        />
                        {updatingSaasMode && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="animate-spin h-4 w-4 border-2 border-gray-300 rounded-full border-t-blue-600"></div>
                          </div>
                        )}
                      </div>
                      <Badge
                        className={`${
                          partner.manualSaasModeEnabled
                            ? 'bg-green-500 text-white border-green-600'
                            : 'bg-gray-500 text-white border-gray-600'
                        } border font-semibold text-xs`}
                      >
                        {updatingSaasMode ? 'Updating...' : (partner.manualSaasModeEnabled ? 'Manual Override' : 'Tier-based')}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Portal: {partner.portalMode || 'BASIC'}
                    </p>
                  </div>
                  <Globe className="h-8 w-8 text-cyan-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-300">BYOA Mode</p>
                    <div className="mt-1 flex items-center space-x-2">
                      <div className="relative">
                        <Switch
                          checked={partner.manualBYOAModeEnabled || false}
                          onCheckedChange={handleBYOAModeToggle}
                          disabled={updatingBYOAMode}
                          className="data-[state=checked]:bg-emerald-600"
                        />
                        {updatingBYOAMode && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="animate-spin h-4 w-4 border-2 border-gray-300 rounded-full border-t-emerald-600"></div>
                          </div>
                        )}
                      </div>
                      <Badge
                        className={`${
                          partner.manualBYOAModeEnabled
                            ? 'bg-emerald-500 text-white border-emerald-600'
                            : 'bg-gray-500 text-white border-gray-600'
                        } border font-semibold text-xs`}
                      >
                        {updatingBYOAMode ? 'Updating...' : (partner.manualBYOAModeEnabled ? 'Manual Override' : 'Tier-based')}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Bring Your Own Agent (BYOA) access
                    </p>
                  </div>
                  <Bot className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Onboarding Progress */}
              {partner.onboarding.progress && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center text-white">
                      <TrendingUp className="h-5 w-5 mr-2" />
                      Onboarding Progress
                    </CardTitle>
                    <CardDescription className="text-gray-300">
                      6-step partner onboarding completion status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">
                          {partner.onboarding.progress.completedSteps} of {partner.onboarding.progress.totalSteps} steps completed
                        </span>
                        <span className="text-sm text-gray-300">
                          {partner.onboarding.progress.progressPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            partner.onboarding.progress.progressPercentage === 100
                              ? 'bg-green-500'
                              : partner.onboarding.progress.progressPercentage >= 50
                                ? 'bg-blue-500'
                                : 'bg-yellow-500'
                          }`}
                          style={{ width: `${partner.onboarding.progress.progressPercentage}%` }}
                        ></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className={`flex items-center p-2 rounded-md ${partner.onboarding.progress.step1_customizePod ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'}`}>
                          {partner.onboarding.progress.step1_customizePod ?
                            <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" /> :
                            <XCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0" />
                          }
                          <span className={`font-medium ${partner.onboarding.progress.step1_customizePod ? 'text-green-200' : 'text-red-200'}`}>
                            Customize Pod
                          </span>
                        </div>
                        <div className={`flex items-center p-2 rounded-md ${partner.onboarding.progress.step2_onboardCustomer ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'}`}>
                          {partner.onboarding.progress.step2_onboardCustomer ?
                            <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" /> :
                            <XCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0" />
                          }
                          <span className={`font-medium ${partner.onboarding.progress.step2_onboardCustomer ? 'text-green-200' : 'text-red-200'}`}>
                            Onboard Customer
                          </span>
                        </div>
                        <div className={`flex items-center p-2 rounded-md ${partner.onboarding.progress.step3_importAgent ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'}`}>
                          {partner.onboarding.progress.step3_importAgent ?
                            <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" /> :
                            <XCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0" />
                          }
                          <span className={`font-medium ${partner.onboarding.progress.step3_importAgent ? 'text-green-200' : 'text-red-200'}`}>
                            Import Agent
                          </span>
                        </div>
                        <div className={`flex items-center p-2 rounded-md ${partner.onboarding.progress.step4_reviewAnalytics ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'}`}>
                          {partner.onboarding.progress.step4_reviewAnalytics ?
                            <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" /> :
                            <XCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0" />
                          }
                          <span className={`font-medium ${partner.onboarding.progress.step4_reviewAnalytics ? 'text-green-200' : 'text-red-200'}`}>
                            Review Analytics
                          </span>
                        </div>
                        <div className={`flex items-center p-2 rounded-md ${partner.onboarding.progress.step5_completeWhitelabel ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'}`}>
                          {partner.onboarding.progress.step5_completeWhitelabel ?
                            <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" /> :
                            <XCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0" />
                          }
                          <span className={`font-medium ${partner.onboarding.progress.step5_completeWhitelabel ? 'text-green-200' : 'text-red-200'}`}>
                            Complete Whitelabel
                          </span>
                        </div>
                        <div className={`flex items-center p-2 rounded-md ${partner.onboarding.progress.step6_setupPayments ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'}`}>
                          {partner.onboarding.progress.step6_setupPayments ?
                            <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" /> :
                            <XCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0" />
                          }
                          <span className={`font-medium ${partner.onboarding.progress.step6_setupPayments ? 'text-green-200' : 'text-red-200'}`}>
                            Setup Payments
                          </span>
                        </div>
                      </div>
                      {partner.onboarding.progress.isComplete && partner.onboarding.walkthroughCompletedAt && (
                        <div className="mt-4 p-3 bg-green-900 border border-green-700 rounded-lg">
                          <p className="text-sm text-green-200">
                            ✅ Onboarding completed on {format(new Date(partner.onboarding.walkthroughCompletedAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Agent Breakdown */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Bot className="h-5 w-5 mr-2" />
                    AI Agents by Provider
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Distribution of agents across different AI providers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(partner.stats.agentsByProvider).map(([provider, count]) => (
                      <div key={provider} className="text-center p-3 bg-gray-700 rounded-lg border border-gray-600">
                        <p className="text-2xl font-bold text-white">{count}</p>
                        <p className="text-sm text-gray-300 capitalize">{provider}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Customers */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Users className="h-5 w-5 mr-2" />
                    Recent Customers
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Latest customer onboardings and activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {partner.recentCustomers.length > 0 ? (
                    <div className="space-y-3">
                      {partner.recentCustomers.map((customer) => (
                        <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg border border-gray-600">
                          <div>
                            <p className="font-medium text-white">{customer.name}</p>
                            <p className="text-sm text-gray-300">{customer.email}</p>
                            <p className="text-xs text-gray-400">
                              Joined {format(new Date(customer.createdAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge
                              variant={customer.status === 'active' ? 'default' : 'secondary'}
                              className={customer.status === 'active' ? 'bg-green-500 text-white font-semibold border-green-600' : 'bg-red-500 text-white font-semibold border-red-600'}
                            >
                              {customer.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                            {customer.lastLogin && (
                              <p className="text-xs text-gray-400 mt-1">
                                Last login: {format(new Date(customer.lastLogin), 'MMM d')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-4">No customers yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Phone Service Activations */}
              {partner.phoneActivations && partner.phoneActivations.length > 0 && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center text-white">
                      <PhoneCall className="h-5 w-5 mr-2" />
                      Phone Service Activations
                    </CardTitle>
                    <CardDescription className="text-gray-300">
                      Twilio regulatory bundle submissions and status
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {partner.phoneActivations.map((activation) => (
                      <div key={activation.id} className="p-4 bg-gray-700 rounded-lg border border-gray-600 space-y-3">
                        {/* Header: Business Name + Status */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{activation.businessName}</p>
                            <p className="text-sm text-gray-400">Country: {activation.country?.toUpperCase()}</p>
                          </div>
                          <Badge className={
                            activation.status === 'active' || activation.status === 'approved' ? 'bg-green-500 text-white border-green-600' :
                            activation.status === 'rejected' ? 'bg-red-500 text-white border-red-600' :
                            activation.status === 'more_info_needed' || activation.status === 'resubmission_needed' ? 'bg-yellow-500 text-white border-yellow-600' :
                            'bg-blue-500 text-white border-blue-600'
                          }>
                            {ACTIVATION_STATUS_OPTIONS.find(o => o.value === activation.status)?.label || activation.status}
                          </Badge>
                        </div>

                        {/* Twilio SIDs */}
                        <div className="grid grid-cols-1 gap-2 text-xs">
                          {activation.twilioSubaccountSid && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Subaccount SID:</span>
                              <span className="text-gray-200 font-mono">{activation.twilioSubaccountSid}</span>
                            </div>
                          )}
                          {activation.twilioAddressSid && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Address SID:</span>
                              <span className="text-gray-200 font-mono">{activation.twilioAddressSid}</span>
                            </div>
                          )}
                          {activation.twilioEndUserSid && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">End User SID:</span>
                              <span className="text-gray-200 font-mono">{activation.twilioEndUserSid}</span>
                            </div>
                          )}
                          {activation.regulatoryBundleSid && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Bundle SID:</span>
                              <span className="text-gray-200 font-mono">{activation.regulatoryBundleSid}</span>
                            </div>
                          )}
                          {activation.twilioSupportingDocSids && activation.twilioSupportingDocSids.length > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Supporting Doc SIDs:</span>
                              <span className="text-gray-200 font-mono text-right">{activation.twilioSupportingDocSids.join(', ')}</span>
                            </div>
                          )}
                        </div>

                        {/* Contact Info */}
                        <div className="text-xs text-gray-400 border-t border-gray-600 pt-2">
                          <p>Contact: {activation.contactFirstName} {activation.contactLastName} — {activation.contactEmail} — {activation.contactPhone}</p>
                          {activation.businessRegistrationNumber && <p>Reg #: {activation.businessRegistrationNumber}</p>}
                          {activation.businessRegistrationAuthority && <p>Authority: {activation.businessRegistrationAuthority}</p>}
                          {activation.businessWebsite && <p>Website: {activation.businessWebsite}</p>}
                        </div>

                        {/* Documents */}
                        {activation.documents && activation.documents.length > 0 && (
                          <div className="border-t border-gray-600 pt-2">
                            <p className="text-xs text-gray-400 mb-1">Uploaded Documents:</p>
                            <div className="space-y-1">
                              {activation.documents.map((doc: any, idx: number) => (
                                <button
                                  key={idx}
                                  onClick={async () => {
                                    try {
                                      const storagePath = doc.url || doc.path;
                                      if (!storagePath) return;
                                      const res = await fetch(`/api/admin/partners/${partnerId}/phone-activations/download?path=${encodeURIComponent(storagePath)}`);
                                      if (!res.ok) {
                                        const err = await res.json().catch(() => ({}));
                                        throw new Error(err.error || 'Download failed');
                                      }
                                      const data = await res.json();
                                      window.open(data.data.url, '_blank');
                                    } catch (err: any) {
                                      toast({
                                        title: "❌ Download Failed",
                                        description: err.message || 'Failed to download document',
                                        className: "bg-red-900 border-red-700 text-red-100 shadow-lg",
                                      });
                                    }
                                  }}
                                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                                >
                                  <Download className="h-3 w-3" />
                                  {doc.name || doc.type || `Document ${idx + 1}`}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Rejection Reason */}
                        {activation.rejectionReason && (
                          <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                            <p className="text-xs text-red-400"><strong>Rejection Reason:</strong> {activation.rejectionReason}</p>
                          </div>
                        )}

                        {/* Dates */}
                        <div className="text-xs text-gray-500 border-t border-gray-600 pt-2 flex gap-4">
                          <span>Created: {format(new Date(activation.createdAt), 'MMM d, yyyy HH:mm')}</span>
                          {activation.submittedAt && <span>Submitted: {format(new Date(activation.submittedAt), 'MMM d, yyyy HH:mm')}</span>}
                          {activation.approvedAt && <span>Approved: {format(new Date(activation.approvedAt), 'MMM d, yyyy HH:mm')}</span>}
                        </div>

                        {/* Status Update Control */}
                        <div className="border-t border-gray-600 pt-3">
                          <label className="text-xs text-gray-400 block mb-1">Update Status:</label>
                          <div className="flex items-center gap-2">
                            <select
                              className="flex-1 bg-gray-600 border border-gray-500 text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              defaultValue={activation.status}
                              onChange={(e) => handleActivationStatusUpdate(activation.id, e.target.value)}
                              disabled={updatingActivationId === activation.id}
                            >
                              {ACTIVATION_STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            {updatingActivationId === activation.id && (
                              <span className="text-xs text-blue-400 animate-pulse">Updating...</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Contact Information */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="text-sm text-gray-300">{partner.email}</span>
                  </div>
                  {partner.contactName && (
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="text-sm text-gray-300">{partner.contactName}</span>
                    </div>
                  )}
                  {partner.phoneNumber && (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="text-sm text-gray-300">{partner.phoneNumber}</span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="text-sm text-gray-300">Joined {format(new Date(partner.createdAt), 'MMM d, yyyy')}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Domain & Branding */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Globe className="h-5 w-5 mr-2" />
                    Domain & Branding
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {partner.subdomain && (
                    <div>
                      <p className="text-sm font-medium text-gray-300">Subdomain</p>
                      <p className="text-sm text-gray-200">{partner.subdomain}.knotie-ai.pro</p>
                    </div>
                  )}
                  {partner.customDomain && (
                    <div>
                      <p className="text-sm font-medium text-gray-300">Custom Domain</p>
                      <div className="flex items-center">
                        <p className="text-sm text-gray-200">{partner.customDomain}</p>
                        <ExternalLink className="h-3 w-3 ml-1 text-gray-400" />
                      </div>
                    </div>
                  )}
                  {!partner.subdomain && !partner.customDomain && (
                    <p className="text-sm text-gray-400">No domain configured</p>
                  )}
                </CardContent>
              </Card>

              {/* Credit Information */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Credit Balance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Knotie Credits</p>
                    <p className={`text-2xl font-bold ${
                      partner.credits.lowThreshold && partner.credits.balance < partner.credits.lowThreshold
                        ? 'text-red-600'
                        : partner.credits.balance === 0
                          ? 'text-orange-600'
                          : 'text-green-600'
                    }`}>
                      {partner.credits.balance.toLocaleString()}
                    </p>
                    {partner.credits.lowThreshold && partner.credits.balance < partner.credits.lowThreshold && (
                      <p className="text-xs text-red-500 mt-1">⚠️ Below threshold ({partner.credits.lowThreshold.toLocaleString()})</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-300">Telephony Credits</p>
                    <p className="text-lg font-semibold text-white">${(partner.credits.telephonyBalance / 100).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-300">Monthly Allocation</p>
                    <p className="text-sm text-gray-200">{partner.credits.monthlyAllocation.toLocaleString()} credits</p>
                  </div>
                  {partner.credits.lowThreshold && (
                    <div>
                      <p className="text-sm font-medium text-gray-300">Low Credit Threshold</p>
                      <p className="text-sm text-gray-200">{partner.credits.lowThreshold.toLocaleString()} credits</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Subscription Details */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <CreditCard className="h-5 w-5 mr-2" />
                    Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-300">Plan</p>
                    <p className="text-sm text-gray-200">{partner.subscription.planId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-300">Billing</p>
                    <p className="text-sm capitalize text-gray-200">{partner.subscription.billingInterval || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-300">Status</p>
                    {getStatusBadge(partner.subscription.status)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Approval</p>
                    <Badge
                      variant={partner.subscription.approvalStatus === 'APPROVED' ? 'default' : 'secondary'}
                      className={
                        partner.subscription.approvalStatus === 'APPROVED'
                          ? 'bg-green-500 text-white font-semibold border-green-600'
                          : partner.subscription.approvalStatus === 'PENDING'
                            ? 'bg-yellow-500 text-white font-semibold border-yellow-600'
                            : 'bg-red-500 text-white font-semibold border-red-600'
                      }
                    >
                      {partner.subscription.approvalStatus}
                    </Badge>
                  </div>
                  {partner.subscription.stripeCustomerId && (
                    <div>
                      <p className="text-sm font-medium text-gray-300">Stripe Customer</p>
                      <p className="text-xs font-mono text-gray-400">{partner.subscription.stripeCustomerId}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Configuration Status */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Settings className="h-5 w-5 mr-2" />
                    Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className={`flex items-center justify-between p-2 rounded-md ${partner.configuration.useCustomSmtp ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'}`}>
                    <span className={`text-sm font-medium ${partner.configuration.useCustomSmtp ? 'text-green-200' : 'text-red-200'}`}>
                      Custom SMTP
                    </span>
                    {partner.configuration.useCustomSmtp ?
                      <CheckCircle className="h-5 w-5 text-green-400" /> :
                      <XCircle className="h-5 w-5 text-red-400" />
                    }
                  </div>
                  <div className={`flex items-center justify-between p-2 rounded-md ${partner.configuration.useSESDomain ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'}`}>
                    <span className={`text-sm font-medium ${partner.configuration.useSESDomain ? 'text-green-200' : 'text-red-200'}`}>
                      SES Domain
                    </span>
                    {partner.configuration.useSESDomain ?
                      <CheckCircle className="h-5 w-5 text-green-400" /> :
                      <XCircle className="h-5 w-5 text-red-400" />
                    }
                  </div>
                  <div className={`flex items-center justify-between p-2 rounded-md ${partner.subscription.stripeAccountId ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'}`}>
                    <span className={`text-sm font-medium ${partner.subscription.stripeAccountId ? 'text-green-200' : 'text-red-200'}`}>
                      Stripe Connected
                    </span>
                    {partner.subscription.stripeAccountId ?
                      <CheckCircle className="h-5 w-5 text-green-400" /> :
                      <XCircle className="h-5 w-5 text-red-400" />
                    }
                  </div>
                  <div className={`flex items-center justify-between p-2 rounded-md ${partner.onboarding.hasSeenWelcomeVideo ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'}`}>
                    <span className={`text-sm font-medium ${partner.onboarding.hasSeenWelcomeVideo ? 'text-green-200' : 'text-red-200'}`}>
                      Welcome Video Seen
                    </span>
                    {partner.onboarding.hasSeenWelcomeVideo ?
                      <CheckCircle className="h-5 w-5 text-green-400" /> :
                      <XCircle className="h-5 w-5 text-red-400" />
                    }
                  </div>
                </CardContent>
              </Card>

              {/* Waitlist History */}
              {partner.waitlistHistory.wasOnWaitlist && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center text-white">
                      <Users className="h-5 w-5 mr-2" />
                      Waitlist History
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-300">Position</p>
                        <p className="text-sm text-gray-200">#{partner.waitlistHistory.waitlistPosition}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-300">Status</p>
                        <Badge
                          className={
                            partner.waitlistHistory.waitlistStatus === 'APPROVED'
                              ? 'bg-green-500 text-white font-semibold border-green-600'
                              : partner.waitlistHistory.waitlistStatus === 'PENDING'
                                ? 'bg-yellow-500 text-white font-semibold border-yellow-600'
                                : 'bg-gray-500 text-white font-semibold border-gray-600'
                          }
                        >
                          {partner.waitlistHistory.waitlistStatus}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-300">Source</p>
                        <p className="text-sm text-gray-200">{partner.waitlistHistory.waitlistSource || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-300">Referrals</p>
                        <p className="text-sm text-gray-200">{partner.waitlistHistory.referralCount || 0}</p>
                      </div>
                    </div>
                    {partner.waitlistHistory.waitlistJoinedAt && (
                      <div className="pt-2 border-t border-gray-700">
                        <p className="text-sm font-medium text-gray-300">Joined Waitlist</p>
                        <p className="text-sm text-gray-200">{format(new Date(partner.waitlistHistory.waitlistJoinedAt), 'MMM d, yyyy')}</p>
                      </div>
                    )}
                    {partner.waitlistHistory.referralCode && (
                      <div>
                        <p className="text-sm font-medium text-gray-300">Referral Code</p>
                        <p className="text-sm text-gray-200 font-mono">{partner.waitlistHistory.referralCode}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Managed Experiences — invite-only entitlement toggles */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Zap className="h-5 w-5 mr-2 text-yellow-400" />
                    Managed Experiences
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Grant or revoke invite-only access to One-Click Experiences for this partner.
                    Enterprise partners always have full access via their tier.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {getAllExperiences().map((config) => {
                    const expType = config.type as ExperienceType;
                    const isGranted = !!(partner.experienceEntitlements?.[expType]);
                    const isUpdating = updatingEntitlement === expType;
                    return (
                      <div
                        key={expType}
                        className="flex items-center justify-between p-3 bg-gray-700 rounded-lg border border-gray-600"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="text-sm font-medium text-white truncate">{config.name}</p>
                          <p className="text-xs text-gray-400 truncate">{config.shortDescription}</p>
                          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                            config.status === 'AVAILABLE' ? 'bg-green-500/20 text-green-400' :
                            config.status === 'BETA' ? 'bg-teal-500/20 text-teal-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {config.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isGranted && (
                            <span className="text-xs text-green-400 font-medium">Granted</span>
                          )}
                          <Switch
                            checked={isGranted}
                            onCheckedChange={() => handleEntitlementToggle(expType, isGranted)}
                            disabled={isUpdating}
                            className={isGranted ? 'data-[state=checked]:bg-green-600' : ''}
                          />
                          {isUpdating && (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Trial Information */}
              {partner.trial.hasStarted && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center text-white">
                      <Clock className="h-5 w-5 mr-2" />
                      Trial Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {partner.trial.startedAt && (
                      <div>
                        <p className="text-sm font-medium text-gray-300">Started</p>
                        <p className="text-sm text-gray-200">{format(new Date(partner.trial.startedAt), 'MMM d, yyyy')}</p>
                      </div>
                    )}
                    {partner.trial.endedAt && (
                      <div>
                        <p className="text-sm font-medium text-gray-300">Ended</p>
                        <p className="text-sm text-gray-200">{format(new Date(partner.trial.endedAt), 'MMM d, yyyy')}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
