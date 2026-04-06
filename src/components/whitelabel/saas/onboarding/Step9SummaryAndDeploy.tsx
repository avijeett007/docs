'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiCheck, FiZap, FiMail, FiClock, FiDollarSign } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { saveProspectProgress } from '@/lib/prospectTracker';
import { navigateToPreviousOnboardingStep } from '@/lib/onboardingNavigation';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';

interface Step9SummaryAndDeployProps {}

export default function Step9SummaryAndDeploy({}: Step9SummaryAndDeployProps) {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);
  const [showPricing, setShowPricing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [customCreditPlans, setCustomCreditPlans] = useState<any[]>([]);
  const [loadingCreditPlans, setLoadingCreditPlans] = useState(false);

  // Language data loading
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [languageLoading, setLanguageLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');

  // Fetch partner branding
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const hostname = window.location.hostname;
        let subdomain = '';
        
        if (hostname.includes('.lvh.me')) {
          subdomain = hostname.split('.')[0];
        } else if (hostname.includes('.knotie-ai.pro')) {
          subdomain = hostname.split('.')[0];
        } else if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
          subdomain = hostname;
        }

        if (!subdomain) {
          throw new Error('Unable to determine partner from hostname');
        }

        const response = await fetch(`/api/whitelabel/branding/${subdomain}`);
        if (!response.ok) {
          throw new Error('Failed to fetch partner branding');
        }

        const data = await response.json();
        setBranding(data);

        // Check if pricing should be shown (when partner has configured pricing)
        if (data.pricingModel && (data.pricingModel === 'subscription' || data.pricingModel === 'payasyougo')) {
          setShowPricing(true);

          // Fetch subscription plans if using subscription model
          if (data.pricingModel === 'subscription') {
            await fetchSubscriptionPlans(subdomain);
          }

          // Fetch custom credit plans if using pay-as-you-go model
          if (data.pricingModel === 'payasyougo') {
            await fetchCustomCreditPlans(subdomain);
          }
        }
      } catch (err) {
        console.error('Error fetching branding:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBranding();
  }, []);

  // Load language data
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const { languageData: data, selectedLanguage: detectedLanguage } = await loadLanguageDataWithLocale();
        setLanguageData(data);
        setSelectedLanguage(detectedLanguage);
      } catch (error) {
        console.error('Error loading language data:', error);
      } finally {
        setLanguageLoading(false);
      }
    };

    loadLanguage();
  }, []);

  // Helper function to get translated text
  const getTranslation = (path: string, customText?: string, skipBrandNameReplacement?: boolean) => {
    if (!languageData) return customText || path;
    // If skipBrandNameReplacement is true, don't pass brandName to avoid automatic replacement
    // This is useful when we want to manually replace {brandName} with a different value (like characterName)
    const brandNameToUse = skipBrandNameReplacement ? undefined : branding?.businessName;
    return getTranslatedText(languageData, path, customText, brandNameToUse);
  };

  // Helper function to derive a friendly agent name from business name
  // Using useMemo to make it reactive to branding changes
  const agentName = useMemo(() => {
    // If characterName is set in branding, use it
    if (branding?.characterName) {
      return branding.characterName;
    }

    // Otherwise, derive from business name by removing common suffixes
    const businessName = localStorage.getItem('onboarding_businessName') || branding?.businessName || 'AI Receptionist';

    // Common business suffixes to remove
    const suffixes = [
      'Limited', 'Ltd', 'Ltd.', 'LLC', 'L.L.C.', 'Inc', 'Inc.', 'Incorporated',
      'Corp', 'Corp.', 'Corporation', 'Company', 'Co', 'Co.', 'LLP', 'L.L.P.',
      'PLC', 'P.L.C.', 'Pty', 'Pty.', 'GmbH', 'AG', 'SA', 'S.A.', 'SRL', 'S.R.L.'
    ];

    // Remove suffixes (case-insensitive)
    let derivedName = businessName.trim();
    for (const suffix of suffixes) {
      const regex = new RegExp(`\\s+${suffix}$`, 'i');
      derivedName = derivedName.replace(regex, '');
    }

    // If the result is empty or too short, use the original business name
    if (derivedName.length < 2) {
      return businessName;
    }

    return derivedName.trim();
  }, [branding]); // Re-compute when branding changes

  // Fetch subscription plans for pricing display
  const fetchSubscriptionPlans = async (subdomain: string) => {
    try {
      const response = await fetch(`/api/whitelabel/subscription-plans/${subdomain}`);
      if (response.ok) {
        const plans = await response.json();
        setSubscriptionPlans(plans.filter((plan: any) => plan.showOnLandingPage));
      }
    } catch (err) {
      console.error('Error fetching subscription plans:', err);
    }
  };

  // Fetch custom credit plans for pay-as-you-go pricing
  const fetchCustomCreditPlans = async (subdomain: string) => {
    setLoadingCreditPlans(true);
    try {
      const response = await fetch(`/api/whitelabel/customer-credit-plans/${subdomain}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.length > 0) {
          setCustomCreditPlans(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching custom credit plans:', err);
    } finally {
      setLoadingCreditPlans(false);
    }
  };



  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentStatus('deploying');

    try {
      // Get prospect data from localStorage (collect all individual pieces)
      const prospectId = localStorage.getItem('onboarding_prospectId');
      const customerId = localStorage.getItem('onboarding_customerId');
      const firstName = localStorage.getItem('onboarding_firstName');
      const lastName = localStorage.getItem('onboarding_lastName');
      const email = localStorage.getItem('onboarding_email');
      const phone = localStorage.getItem('onboarding_phone');
      const businessName = localStorage.getItem('onboarding_businessName');

      // Validate required data
      if (!prospectId || !customerId || !firstName || !lastName || !email || !businessName || !branding?.id) {
        throw new Error('Required onboarding data not found. Please complete all previous steps.');
      }

      // Check if payment is required (pay-first flow)
      if (selectedPlan && branding.pricingModel === 'subscription') {
        // Find the selected plan to check trial settings
        const plan = subscriptionPlans.find(p => p.id === selectedPlan);
        
        if (plan) {
          // Determine if we need to redirect to payment
          const hasTrialPeriod = plan.trialPeriodDays && plan.trialPeriodDays > 0;
          const requiresCardForTrial = plan.requireCardForTrial || false;
          const needsPayment = !hasTrialPeriod || requiresCardForTrial;

          if (needsPayment) {
            // Redirect to Stripe Checkout for payment/card capture
            console.log('Redirecting to payment checkout...');
            
            const checkoutResponse = await fetch('/api/whitelabel/create-onboarding-checkout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                planId: selectedPlan,
                prospectId,
                customerId,
                partnerId: branding.id
              })
            });

            if (!checkoutResponse.ok) {
              const errorData = await checkoutResponse.json();
              throw new Error(errorData.error || 'Failed to create checkout session');
            }

            const { url } = await checkoutResponse.json();
            
            // Redirect to Stripe Checkout
            window.location.href = url;
            return; // Exit early - payment success page will handle completion
          }
        }
      }

      // If we reach here, no payment required - proceed with normal flow
      // Determine billing model based on partner configuration and user selection
      let billingModel = 'free_trial'; // Default
      let selectedPricingPlanId = selectedPlan;

      if (branding.pricingModel === 'subscription' && subscriptionPlans.length > 0) {
        if (selectedPlan) {
          billingModel = 'subscription';
          selectedPricingPlanId = selectedPlan;
        } else {
          // No plan selected, default to free trial
          billingModel = 'free_trial';
        }
      } else if (branding.pricingModel === 'payasyougo') {
        billingModel = 'pay_as_you_go';
      } else {
        // No pricing model configured or free tier
        billingModel = 'free_trial';
      }

      const data = {
        prospectId,
        partnerId: branding.id,
        firstName,
        lastName,
        email,
        phone,
        businessName,
        billingModel,
        selectedPricingPlan: selectedPricingPlanId
      };

      // Save billing preferences to prospect database
      await saveProspectProgress(9, {
        selectedPricingPlan: selectedPricingPlanId || undefined,
        billingModel: billingModel,
        deploymentSettings: {
          billingModel,
          selectedPricingPlan: selectedPricingPlanId || undefined,
          deployedAt: new Date().toISOString()
        }
      });

      // Save onboarding details (customer already created in Step 3)
      const response = await fetch('/api/whitelabel/save-onboarding-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save onboarding details');
      }

      const responseData = await response.json();

      // Send deployment notification email to partner
      try {
        const notificationResponse = await fetch('/api/whitelabel/deployment-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerId: responseData.customerId || localStorage.getItem('onboarding_customerId'),
            customerEmail: email,
            customerName: `${firstName} ${lastName}`.trim(),
            businessName: businessName,
            partnerId: branding?.id
          })
        });

        if (!notificationResponse.ok) {
          console.error('Failed to send deployment notification:', await notificationResponse.text());
        } else {
          console.log('Deployment notification sent successfully');
        }
      } catch (notificationError) {
        console.error('Error sending deployment notification:', notificationError);
      }

      // Enable AI Credits and add free credits automatically
      try {
        // Get the prospect token from localStorage (set during onboarding)
        const prospectToken = localStorage.getItem('onboarding_prospectToken');

        const aiCreditsResponse = await fetch('/api/whitelabel/enable-ai-credits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(prospectToken && { 'Authorization': `Bearer ${prospectToken}` })
          },
          body: JSON.stringify({
            freeAiCredits: branding?.freeAiCredits || 50
          })
        });

        if (!aiCreditsResponse.ok) {
          console.error('Failed to enable AI credits:', await aiCreditsResponse.text());
        } else {
          const aiCreditsData = await aiCreditsResponse.json();
          console.log('AI Credits enabled successfully:', aiCreditsData);
        }
      } catch (aiCreditsError) {
        console.error('Error enabling AI credits:', aiCreditsError);
      }

      // Simulate deployment process
      await new Promise(resolve => setTimeout(resolve, 3000));

      setDeploymentStatus('success');

      // Clear all onboarding data from localStorage
      localStorage.removeItem('onboarding_prospectId');
      localStorage.removeItem('onboarding_firstName');
      localStorage.removeItem('onboarding_lastName');
      localStorage.removeItem('onboarding_email');
      localStorage.removeItem('onboarding_phone');
      localStorage.removeItem('onboarding_businessName');
      localStorage.removeItem('onboarding_website');
      localStorage.removeItem('onboarding_hasNoWebsite');
      localStorage.removeItem('onboarding_websiteAnalysis');
      localStorage.removeItem('onboarding_serviceCategories');
      localStorage.removeItem('onboarding_customServices');
      localStorage.removeItem('onboarding_knowledgeBaseFiles');
      localStorage.removeItem('onboarding_knowledgeBaseUrls');
      localStorage.removeItem('onboarding_greeting');
      localStorage.removeItem('onboarding_voiceType');
      localStorage.removeItem('onboarding_selectedVoiceId');
      localStorage.removeItem('onboarding_collectName');
      localStorage.removeItem('onboarding_collectEmail');
      localStorage.removeItem('onboarding_collectPhone');
      localStorage.removeItem('onboarding_collectCompany');
      localStorage.removeItem('onboarding_customFields');
      localStorage.removeItem('onboarding_communicationSettings');

    } catch (error) {
      console.error('Error deploying agent:', error);
      setDeploymentStatus('error');
    } finally {
      setIsDeploying(false);
    }
  };

  if (loading || languageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white sticky top-0 z-20 border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            {branding?.logo && (
              <img
                src={branding.logo}
                alt={`${branding.businessName} Logo`}
                className="h-10 w-auto object-contain"
              />
            )}
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {getTranslation('saas.onboarding.step9.stepIndicator')}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full">
          <div className="h-1.5 bg-gray-100">
            <div
              className="h-1.5 rounded-r-full transition-all duration-500 ease-out"
              style={{
                width: '100%', // 9/9 steps
                background: `linear-gradient(90deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {deploymentStatus === 'idle' && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-10"
            >
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
                {getTranslation('saas.onboarding.step9.title')}
              </h1>
              <p className="text-lg text-gray-600 max-w-lg mx-auto leading-relaxed">
                {getTranslation('saas.onboarding.step9.subtitle')}
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-8 mb-8">
              {/* Summary Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-white rounded-3xl shadow-2xl shadow-blue-900/5 p-8 border border-white/50"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  {getTranslation('saas.onboarding.step9.configSummaryTitle')}
                </h3>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <FiCheck className="text-green-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-gray-900">{getTranslation('saas.onboarding.step9.businessInfoTitle')}</h4>
                      <p className="text-sm text-gray-600">{getTranslation('saas.onboarding.step9.businessInfoDesc')}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <FiCheck className="text-green-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-gray-900">{getTranslation('saas.onboarding.step9.contactDetailsTitle')}</h4>
                      <p className="text-sm text-gray-600">{getTranslation('saas.onboarding.step9.contactDetailsDesc')}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <FiCheck className="text-green-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-gray-900">{getTranslation('saas.onboarding.step9.serviceCategoriesTitle')}</h4>
                      <p className="text-sm text-gray-600">{getTranslation('saas.onboarding.step9.serviceCategoriesDesc')}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <FiCheck className="text-green-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-gray-900">{getTranslation('saas.onboarding.step9.knowledgeBaseTitle')}</h4>
                      <p className="text-sm text-gray-600">{getTranslation('saas.onboarding.step9.knowledgeBaseDesc')}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <FiCheck className="text-green-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-gray-900">{getTranslation('saas.onboarding.step9.personalizedGreetingTitle')}</h4>
                      <p className="text-sm text-gray-600">{getTranslation('saas.onboarding.step9.personalizedGreetingDesc')}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <FiCheck className="text-green-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-gray-900">{getTranslation('saas.onboarding.step9.infoCollectionTitle')}</h4>
                      <p className="text-sm text-gray-600">{getTranslation('saas.onboarding.step9.infoCollectionDesc')}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <FiCheck className="text-green-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-gray-900">{getTranslation('saas.onboarding.step9.commSettingsTitle')}</h4>
                      <p className="text-sm text-gray-600">{getTranslation('saas.onboarding.step9.commSettingsDesc')}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* What Happens Next */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="bg-white rounded-2xl shadow-xl p-8"
              >
                <h3 className="text-xl font-semibold text-gray-900 mb-6">{getTranslation('saas.onboarding.step9.whatHappensNextTitle')}</h3>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-blue-600 text-sm font-semibold">1</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{getTranslation('saas.onboarding.step9.phoneNumberTitle')}</h4>
                      <p className="text-sm text-gray-600">{getTranslation('saas.onboarding.step9.phoneNumberDesc')}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-blue-600 text-sm font-semibold">2</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{getTranslation('saas.onboarding.step9.aiTrainingTitle')}</h4>
                      <p className="text-sm text-gray-600">{getTranslation('saas.onboarding.step9.aiTrainingDesc')}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-blue-600 text-sm font-semibold">3</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{getTranslation('saas.onboarding.step9.systemIntegrationTitle')}</h4>
                      <p className="text-sm text-gray-600">{getTranslation('saas.onboarding.step9.systemIntegrationDesc')}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <FiCheck className="text-green-600 text-sm" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{getTranslation('saas.onboarding.step9.goLiveTitle')}</h4>
                      <p className="text-sm text-gray-600">{getTranslation('saas.onboarding.step9.goLiveDesc')}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Pricing Information Section - Show pricing info but no payment processing */}
            {showPricing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="mb-8"
              >
                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">{getTranslation('saas.onboarding.step9.pricingPlanTitle')}</h3>
                    <p className="text-gray-600">{getTranslation('saas.onboarding.step9.pricingPlanSubtitle')}</p>
                  </div>

                  {/* FREE Credits Banner - Show for both pricing models */}
                  {branding?.freeAiCredits && branding.freeAiCredits > 0 && (
                    <div className="max-w-md mx-auto mb-8">
                      <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-xl p-6 text-center text-white">
                        <FiZap className="text-4xl mx-auto mb-3" />
                        <h4 className="text-xl font-bold mb-2">{getTranslation('saas.onboarding.step9.freeCreditsTitle')}</h4>
                        <div className="text-3xl font-bold mb-2">
                          {getTranslation('saas.onboarding.step9.freeCreditsAmount').replace('{amount}', branding.freeAiCredits.toString())}
                        </div>
                        <p className="text-sm opacity-90">
                          {getTranslation('saas.onboarding.step9.freeCreditsDesc')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Subscription Plans */}
                  {branding?.pricingModel === 'subscription' && subscriptionPlans.length > 0 && (
                    <div className="max-w-4xl mx-auto">
                      {/* Primary subscription info */}
                      <div className="text-center mb-8">
                        <div className="mb-6">
                          <h4 className="text-xl font-semibold text-gray-900 mb-3">
                            {getTranslation('saas.onboarding.step9.getStartedTitle').replace('{amount}', (branding?.freeAiCredits || 50).toString())}
                          </h4>
                          <p className="text-gray-600">
                            {getTranslation('saas.onboarding.step9.getStartedDesc')}
                          </p>
                        </div>

                        <div className="mb-6">
                          <h5 className="text-lg font-medium text-gray-700 mb-4">
                            Or choose from the subscription packages below:
                          </h5>
                        </div>
                      </div>

                      {/* Subscription Plans Grid */}
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {subscriptionPlans.map((plan) => (
                        <div
                          key={plan.id}
                          className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-300 ${
                            selectedPlan === plan.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedPlan(plan.id)}
                        >
                          <div className="text-center">
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">{plan.name}</h4>
                            <div className="mb-4">
                              <span className="text-3xl font-bold text-gray-900">
                                ${(plan.amount / 100).toFixed(2)}
                              </span>
                              <span className="text-gray-600">/{plan.interval}</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">{plan.description}</p>

                            {plan.features && (
                              <ul className="text-sm text-gray-600 space-y-1">
                                {(() => {
                                  let featureList: string[] = [];

                                  // Case 1: Already an array (Prisma auto-deserializes Json type)
                                  if (Array.isArray(plan.features)) {
                                    featureList = plan.features.filter(Boolean);
                                  }
                                  // Case 2: String that needs parsing
                                  else if (typeof plan.features === 'string') {
                                    try {
                                      // Try to parse as JSON array
                                      const parsed = JSON.parse(plan.features);
                                      if (Array.isArray(parsed)) {
                                        featureList = parsed.filter(Boolean);
                                      } else {
                                        // Single JSON string value
                                        featureList = [plan.features];
                                      }
                                    } catch (error) {
                                      // Not valid JSON, try comma-separated
                                      const commaSeparated = plan.features.split(',').map((f: string) => f.trim()).filter(Boolean);
                                      if (commaSeparated.length > 0) {
                                        featureList = commaSeparated;
                                      } else {
                                        // Use as single feature
                                        featureList = [plan.features];
                                      }
                                    }
                                  }

                                  // Render features if we have any
                                  if (featureList.length > 0) {
                                    return featureList.map((feature: string, index: number) => (
                                      <li key={index} className="flex items-center">
                                        <FiCheck className="text-green-500 mr-2 flex-shrink-0" />
                                        {feature}
                                      </li>
                                    ));
                                  }

                                  // Fallback only if no features could be extracted
                                  return (
                                    <li className="flex items-center">
                                      <FiCheck className="text-green-500 mr-2 flex-shrink-0" />
                                      All features included
                                    </li>
                                  );
                                })()}
                              </ul>
                            )}
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                  )}

                  {/* Free Credits Offer - When no subscription plans are available */}
                  {branding?.pricingModel === 'subscription' && subscriptionPlans.length === 0 && (
                    <div className="max-w-2xl mx-auto text-center">
                      <div className="border-2 border-green-200 rounded-xl p-8 bg-green-50">
                        <div className="text-green-600 mb-4">
                          <FiZap className="text-4xl mx-auto mb-2" />
                          <h4 className="text-lg font-semibold">
                            {branding.freeTrialEnabled
                              ? getTranslation('saas.onboarding.step9.getStartedForFree')
                              : getTranslation('saas.onboarding.step9.getStartedNow')
                            }
                          </h4>
                        </div>
                        <p className="text-green-700 mb-6">
                          {branding.freeTrialEnabled
                            ? getTranslation('saas.onboarding.step9.startWithFreeCredits').replace('{amount}', (branding.freeAiCredits || 50).toString())
                            : getTranslation('saas.onboarding.step9.beginJourneyWithCredits').replace('{amount}', (branding.freeAiCredits || 50).toString())
                          }
                        </p>

                        {/* Free Credits Display */}
                        <div className="bg-white rounded-lg p-6 border border-green-200">
                          <div className="mb-4">
                            <span className="text-3xl font-bold text-green-600">
                              {branding.freeAiCredits || 50}
                            </span>
                            <span className="text-gray-600"> {getTranslation('saas.onboarding.step9.freeAiCreditsLabel')}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-4">
                            {getTranslation('saas.onboarding.step9.creditExplanation')}
                          </p>

                          <div className="bg-green-50 rounded-lg p-4 mb-4">
                            <h6 className="font-medium text-green-800 mb-2">{getTranslation('saas.onboarding.step9.whatYouCanDoTitle')}</h6>
                            <ul className="text-sm text-green-700 space-y-1">
                              <li>• {getTranslation('saas.onboarding.step9.testVoiceConversations')}</li>
                              <li>• {getTranslation('saas.onboarding.step9.experienceFullFunctionality')}</li>
                              <li>• {getTranslation('saas.onboarding.step9.noPaymentRequired')}</li>
                              <li>• {getTranslation('saas.onboarding.step9.upgradeAnytime')}</li>
                            </ul>
                          </div>

                          <p className="text-sm text-gray-600 italic">
                            {getTranslation('saas.onboarding.step9.completeSetupToClaim')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pay-as-you-go Option */}
                  {branding?.pricingModel === 'payasyougo' && (
                    <div className="max-w-4xl mx-auto">
                      {/* Primary pay-as-you-go info */}
                      <div className="text-center mb-8">
                        <div className="mb-6">
                          <FiDollarSign className="text-4xl text-blue-500 mx-auto mb-4" />
                          <h4 className="text-xl font-semibold text-gray-900 mb-3">Pay-as-you-go Pricing</h4>
                          <div className="mb-4">
                            <span className="text-3xl font-bold text-gray-900">
                              ${typeof branding.payAsYouGoRate === 'number' ? branding.payAsYouGoRate.toFixed(2) : '0.10'}
                            </span>
                            <span className="text-gray-600"> per AI credit</span>
                          </div>
                          <p className="text-gray-600 mb-4">
                            1 AI Credit = 1 Minute of conversation. Only pay for what you use.
                          </p>
                        </div>

                        <div className="mb-6">
                          <h5 className="text-lg font-medium text-gray-700 mb-4">
                            Alternatively, you can choose from the Pay as you go packages below:
                          </h5>
                        </div>
                      </div>

                      {loadingCreditPlans ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                          <p className="text-gray-600 mt-2">Loading credit plans...</p>
                        </div>
                      ) : customCreditPlans.length > 0 ? (
                        // Show custom credit plans when available
                        <div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {customCreditPlans.map((plan) => (
                              <div
                                key={plan.id}
                                className={`relative border-2 rounded-xl p-6 text-center transition-all duration-200 hover:shadow-lg ${
                                  plan.isPopular
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 bg-white hover:border-blue-300'
                                }`}
                              >
                                {plan.isPopular && (
                                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                                      POPULAR
                                    </span>
                                  </div>
                                )}

                                <h5 className="text-lg font-semibold text-gray-900 mb-2">{plan.name}</h5>
                                <div className="mb-4">
                                  <span className="text-3xl font-bold text-gray-900">
                                    ${(plan.priceCents / 100).toFixed(2)}
                                  </span>
                                </div>
                                <div className="mb-4">
                                  <span className="text-lg font-medium text-blue-600">
                                    {plan.credits.toLocaleString()} Credits
                                  </span>
                                </div>
                                {plan.description && (
                                  <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                                )}
                                <div className="text-sm text-gray-500">
                                  ${((plan.priceCents / 100) / plan.credits).toFixed(3)} per credit
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        // Fallback to calculated packages when no custom plans
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          {[100, 500, 1000].map((credits) => {
                            const rate = typeof branding.payAsYouGoRate === 'number' ? branding.payAsYouGoRate : 0.10;
                            const cost = (credits * rate).toFixed(2);
                            return (
                              <div
                                key={credits}
                                className="border-2 border-gray-200 rounded-xl p-6 text-center bg-white hover:border-blue-300 transition-all duration-200"
                              >
                                <h5 className="text-lg font-semibold text-gray-900 mb-2">
                                  {credits === 100 ? 'Starter' : credits === 500 ? 'Popular' : 'Pro'} Package
                                </h5>
                                <div className="mb-4">
                                  <span className="text-3xl font-bold text-gray-900">
                                    ${cost}
                                  </span>
                                </div>
                                <div className="mb-4">
                                  <span className="text-lg font-medium text-blue-600">
                                    {credits} Credits
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500">
                                  ${rate.toFixed(3)} per credit
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fixed Price Option */}
                  {branding?.pricingModel === 'fixedprice' && branding.fixedPrice && branding.fixedPrice > 0 && (() => {
                    const primaryColor = branding.primaryColor || '#3B82F6';
                    const secondaryColor = branding.secondaryColor || '#8B5CF6';
                    const currencySymbols: Record<string, string> = {
                      USD: '$', EUR: '€', GBP: '£', CAD: '$', AUD: '$', INR: '₹', JPY: '¥'
                    };
                    const currencySymbol = currencySymbols[branding.fixedPriceCurrency || 'USD'] || '$';
                    const periodText = branding.fixedPricePeriod === 'month' ? 'per month' :
                                      branding.fixedPricePeriod === 'year' ? 'per year' :
                                      'one-time payment';

                    return (
                      <div className="max-w-3xl mx-auto">
                        <div className="relative group">
                          {/* Glow effect */}
                          <div
                            className="absolute -inset-1 rounded-3xl opacity-30 blur-xl"
                            style={{
                              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                            }}
                          />

                          <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
                            {/* Premium Badge */}
                            <div
                              className="py-4 text-center text-white font-bold text-sm tracking-wide"
                              style={{
                                background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                              }}
                            >
                              <div className="flex items-center justify-center gap-2">
                                <FiZap className="text-yellow-300" />
                                {getTranslation('saas.onboarding.step9.pricingBadge', 'YOUR SELECTED PLAN')}
                              </div>
                            </div>

                            <div className="p-8 md:p-10">
                              {/* Price Display */}
                              <div className="text-center mb-8">
                                <div className="mb-6">
                                  <div className="flex items-baseline justify-center gap-2 mb-3">
                                    <span className="text-6xl md:text-7xl font-bold text-gray-900 tracking-tight">
                                      {currencySymbol}{branding.fixedPrice}
                                    </span>
                                    {branding.fixedPricePeriod !== 'one-time' && (
                                      <span className="text-2xl text-gray-500 font-medium">
                                        /{branding.fixedPricePeriod}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-gray-600 text-lg font-medium">
                                    {periodText}
                                  </p>
                                </div>
                              </div>

                              {/* Features List */}
                              {branding.fixedPriceFeatures && (
                                <div className="mb-8">
                                  <h4 className="text-xl font-bold text-gray-900 text-center mb-6">
                                    {getTranslation('saas.onboarding.step9.featuresTitle', 'What\'s Included')}
                                  </h4>
                                  <div className="grid md:grid-cols-2 gap-3">
                                    {branding.fixedPriceFeatures.split('\n').filter(f => f.trim()).map((feature, index) => (
                                      <div
                                        key={index}
                                        className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all duration-200"
                                      >
                                        <div
                                          className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center mt-0.5 shadow-sm"
                                          style={{
                                            background: `linear-gradient(135deg, ${primaryColor}20 0%, ${secondaryColor}20 100%)`,
                                            borderColor: primaryColor,
                                            borderWidth: '1px'
                                          }}
                                        >
                                          <FiCheck
                                            className="text-sm font-bold"
                                            style={{ color: primaryColor }}
                                          />
                                        </div>
                                        <span className="text-gray-700 font-medium leading-relaxed">
                                          {feature.trim()}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Free Trial Badge */}
                              {branding.freeTrialEnabled && branding.freeAiCredits && (
                                <div className="mb-6">
                                  <div
                                    className="relative overflow-hidden rounded-2xl p-[2px]"
                                    style={{
                                      background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                                    }}
                                  >
                                    <div className="relative bg-white rounded-2xl p-4">
                                      <div className="flex items-center justify-center gap-3">
                                        <div
                                          className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
                                          style={{ background: `${primaryColor}15` }}
                                        >
                                          <span className="text-2xl">🎉</span>
                                        </div>
                                        <p className="text-gray-900 font-bold">
                                          Start with <span style={{ color: primaryColor }}>{branding.freeAiCredits} free AI credits</span> to test!
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Selected Plan Information */}
                  {branding?.pricingModel === 'subscription' && selectedPlan && (
                    <div className="text-center mt-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-blue-800 font-medium">
                          ✓ Plan selected: {subscriptionPlans.find(p => p.id === selectedPlan)?.name}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Deploy Button - Always shown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="text-center"
            >
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => navigateToPreviousOnboardingStep()}
                  className="group sm:w-auto w-full py-4 px-8 rounded-xl font-medium border-2 border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
                >
                  <div className="flex items-center justify-center">
                    <FiArrowLeft className="mr-2 transition-transform duration-200 group-hover:-translate-x-1" />
                    Back
                  </div>
                </button>

                <button
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                  style={{
                    background: `linear-gradient(135deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
                  }}
                >
                  <FiZap className="mr-3 text-xl" />
                  {isDeploying
                    ? getTranslation('saas.onboarding.step9.deploying')
                    : getTranslation('saas.onboarding.step9.deploy', undefined, true).replace('{brandName}', agentName)
                  }
                </button>
              </div>
              <p className="text-gray-600 mt-4">
                {getTranslation('saas.onboarding.step9.deploymentTimeEstimate')}
              </p>
            </motion.div>
          </>
        )}

        {/* Deployment Status */}
        {deploymentStatus === 'deploying' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md mx-auto">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Deploying {branding?.businessName || 'Your AI'}...</h2>
              <div className="space-y-2 text-sm text-gray-600">
                <p>🔄 Purchasing phone number...</p>
                <p>🤖 Training AI with your business data...</p>
                <p>🔗 Setting up integrations...</p>
                <p>📞 Configuring call routing...</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Success Status */}
        {deploymentStatus === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md mx-auto">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiCheck className="text-green-600 text-3xl" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🎉 {branding?.businessName || 'Your AI'} is Ready!</h2>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 font-medium text-center">
                    Your AI assistant has been configured successfully!
                  </p>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center justify-center space-x-2">
                    <FiMail className="text-blue-500" />
                    <span>Setup instructions sent to your email</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <FiClock className="text-blue-500" />
                    <span>Ready to serve your customers 24/7</span>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                  <p className="text-amber-800 text-sm text-center">
                    <strong>Next Step:</strong> {
                      window.location.pathname.startsWith('/whitelabel/onboarding')
                        ? 'Return to your dashboard to complete payment setup and start using your AI assistant.'
                        : 'Login to your dashboard to see your phone number, complete payment setup, and start using your AI assistant.'
                    }
                  </p>
                </div>

                <button
                  onClick={() => {
                    const isLoggedInFlow = window.location.pathname.startsWith('/whitelabel/onboarding');
                    window.location.href = isLoggedInFlow ? '/whitelabel/dashboard' : '/whitelabel/login';
                  }}
                  className="w-full mt-6 py-3 px-6 rounded-lg font-semibold text-white transition-all duration-300 hover:shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
                  }}
                >
                  {window.location.pathname.startsWith('/whitelabel/onboarding') ? getTranslation('saas.onboarding.step9.goToDashboard') : getTranslation('saas.onboarding.step9.loginToDashboard')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
