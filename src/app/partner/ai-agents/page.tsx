'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiExternalLink, FiInfo, FiX } from 'react-icons/fi';
import clsx from 'clsx';
import NeonContainer from '@/components/NeonContainer';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';
import { Transition, Dialog } from '@headlessui/react';
import GHLIcon from '@/components/icons/GHLIcon';
import N8nTokenModal from '@/components/partner/N8nTokenModal';
import UpgradePromptModal from '@/components/partner/UpgradePromptModal';
import { UpgradePrompt } from '@/lib/services/clientTierValidationService';
import PremiumFeature from '@/components/ui/PremiumFeature';

interface AgentPlatform {
  id: string;
  name: string;
  description: string;
  icon: string | React.ComponentType<{ className?: string }>;
  route: string;
  infoLink: string;
  status: 'active' | 'coming_soon';
  type: 'voice' | 'custom' | 'chat';
}

const agentPlatforms: AgentPlatform[] = [
  {
    id: 'knotie-workflows',
    name: 'Knotie AI Pro Workflows',
    description: 'Create and manage business workflows powered by Knova AI agents. Build automated processes for lead generation, customer service, and more.',
    icon: '🔄',
    route: '/partner/ai-agents/workflows',
    infoLink: 'https://knotie-ai.pro/workflows',
    status: 'coming_soon',
    type: 'custom'
  },
  {
    id: 'knova-hosted',
    name: 'Knova AI (Hosted) Agents',
    description: 'Create and manage sophisticated AI agents hosted on our platform. Features voice, video, avatar capabilities with advanced configuration options.',
    icon: '🎭',
    route: '/partner/ai-agents/knova',
    infoLink: 'https://knotie-ai.pro/knova',
    status: 'active',
    type: 'custom'
  },
  {
    id: 'knova-byoa',
    name: 'Knova AI (BYOA) Agents',
    description: 'Bring Your Own Agent - Connect your self-hosted Knova AI agents or agents from the Knova AI portal to create powerful workflows.',
    icon: '🤖',
    route: '/partner/ai-agents/knova-byoa',
    infoLink: 'https://knova-ai.com',
    status: 'coming_soon',
    type: 'custom'
  }
];

const voiceAgentPlatforms: AgentPlatform[] = [
  {
    id: 'vapi',
    name: 'VAPI AI',
    description: 'Create and manage voice AI agents for automated customer interactions. Perfect for handling customer service calls, appointments, and more.',
    icon: '🎙️',
    route: '/partner/ai-agents/vapi',
    infoLink: 'https://vapi.ai/?ref=knotie',
    status: 'active',
    type: 'voice'
  },
  {
    id: 'ultravox',
    name: 'Ultravox AI',
    description: 'Advanced voice AI platform with sentiment analysis and dynamic conversation flows. Ideal for customer retention and support automation.',
    icon: '🤖',
    route: '/partner/ai-agents/ultravox',
    infoLink: 'https://ultravox.ai/?ref=knotie',
    status: 'active',
    type: 'voice'
  },
  {
    id: 'retell',
    name: 'Retell AI',
    description: 'Create natural-sounding voice agents with multilingual support. Features easy-to-use templates and handles both single and multi-turn conversations.',
    icon: '🗣️',
    route: '/partner/ai-agents/retell',
    infoLink: 'https://www.retellai.com/?ref=knotie',
    status: 'active',
    type: 'voice'
  },
  {
    id: 'ghl',
    name: 'Go High Level Voice AI',
    description: 'Integrate your existing GHL Voice AI agents with webhook-based analytics. Perfect for agencies already using Go High Level CRM and automation.',
    icon: GHLIcon,
    route: '/partner/ai-agents/ghl',
    infoLink: 'https://www.gohighlevel.com/?ref=knotie',
    status: 'active',
    type: 'voice'
  },
  {
    id: 'n8n-chat',
    name: 'N8N Chat Agents',
    description: 'Create intelligent chat agents powered by N8N workflows. Perfect for customer support, lead qualification, and automated conversations with full analytics.',
    icon: '💬',
    route: '/partner/ai-agents/n8n-chat',
    infoLink: 'https://docs.knotie-ai.pro/n8n-chat-integration',
    status: 'active',
    type: 'chat'
  },
  {
    id: 'retell-chat',
    name: 'Retell Chat Agents',
    description: 'Import and manage Retell Chat agents with SMS support, dynamic variables, and integrated analytics. Perfect for web chat and outbound SMS conversations.',
    icon: '💬',
    route: '/partner/ai-agents/retell-chat',
    infoLink: 'https://docs.retellai.com/chat-agent/overview',
    status: 'active',
    type: 'chat'
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs Voice AI',
    description: 'Premium voice synthesis and conversational AI platform. Create lifelike AI voices for engaging and expressive automated interactions.',
    icon: '🎭',
    route: '/partner/ai-agents/elevenlabs',
    infoLink: 'https://elevenlabs.io/conversational-ai?ref=knotie',
    status: 'active',
    type: 'voice'
  },
  {
    id: 'byo-agent',
    name: 'BYO Agent (LiveKit / Pipecat)',
    description: 'Bring Your Own Agent — connect your self-hosted voice AI agents built with LiveKit Agents or Pipecat. Full control over your infrastructure with Knotie tools and analytics.',
    icon: '🔧',
    route: '/partner/ai-agents/byo-agent',
    infoLink: 'https://docs.knotie-ai.pro/byo-agent',
    status: 'active',
    type: 'voice'
  }
];

export default function AIAgentsPage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('');
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [comingSoonPlatform, setComingSoonPlatform] = useState<AgentPlatform | null>(null);
  const [showN8nTokenModal, setShowN8nTokenModal] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePrompt | null>(null);
  const [isFreeTier, setIsFreeTier] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

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

    // Check subscription status
    const checkSubscriptionStatus = async () => {
      try {
        const response = await fetch('/api/partner/subscription', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setIsFreeTier(data.data?.partner?.subscriptionStatus !== 'ACTIVE');
        }
      } catch (error) {
        console.error('Error checking subscription status:', error);
      } finally {
        setIsCheckingSubscription(false);
      }
    };

    checkSubscriptionStatus();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  const handlePlatformClick = async (platform: AgentPlatform) => {
    if (platform.status === 'coming_soon') {
      // Show coming soon modal for all coming soon features
      setComingSoonPlatform(platform);
      setShowComingSoonModal(true);
      return;
    }

    if (platform.status === 'active') {
      // Navigate directly to platform - tier validation handled on individual agent pages
      router.push(platform.route);
    }
  };

  const openInfoLink = (e: React.MouseEvent, link: string) => {
    e.stopPropagation();
    window.open(link, '_blank');
  };

  const renderPlatformGrid = (platforms: AgentPlatform[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {platforms.map((platform) => (
        <div key={platform.id} onClick={() => handlePlatformClick(platform)}>
          <NeonContainer 
            className={clsx(
              "p-6 h-[320px] flex flex-col transition-transform duration-200 cursor-pointer hover:scale-[1.02]",
              platform.status === 'coming_soon' && "opacity-75"
            )}
          >
            <div className="flex flex-col flex-1">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    {typeof platform.icon === 'string' ? (
                      <span className="text-2xl">{platform.icon}</span>
                    ) : (
                      <platform.icon className="w-6 h-6 text-blue-400" />
                    )}
                    <h3 className="text-xl font-semibold">{platform.name}</h3>
                    {/* Add premium indicator for all platforms except Retell */}
                    {platform.id !== 'retell' && (
                      <PremiumFeature iconSize="sm">
                        <></>
                      </PremiumFeature>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-gray-400 line-clamp-3">{platform.description}</p>
                </div>
                <button
                  onClick={(e) => openInfoLink(e, platform.infoLink)}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors group"
                  title="Learn more"
                >
                  <FiInfo className="w-5 h-5 text-gray-400 group-hover:text-blue-400" />
                </button>
              </div>

              <div className="mt-auto flex items-center justify-between">
                <div className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-medium',
                  platform.status === 'active' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-yellow-500/20 text-amber-400'
                )}>
                  {platform.status === 'active' ? 'Active' : 'Coming Soon'}
                </div>
                {platform.status === 'active' && (
                  <div className="flex items-center gap-1 text-blue-400 text-sm">
                    <span>Get Started</span>
                    <FiExternalLink className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>
          </NeonContainer>
        </div>
      ))}
    </div>
  );

  return (
    <UserGuideProvider>
      <div className="min-h-screen bg-gray-900 text-white flex">
        <GuidedPartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
      
      <main className="flex-1 pl-64 min-h-screen relative">
        <div className="p-8">
          <div className="max-w-7xl mx-auto space-y-12">
            {/* Free Tier Limitation Notice */}
            {isFreeTier && !isCheckingSubscription && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-amber-400 text-xl">⚠️</span>
                  <div>
                    <h3 className="text-amber-400 font-semibold">Free Tier Limitation</h3>
                    <p className="text-sm text-gray-300 mt-1">
                      Free tier users can import up to <strong>2 agents</strong> only.
                      <span className="text-blue-400 ml-1">Upgrade to a paid plan</span> to unlock unlimited agent imports and premium features.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold">AI Workflow Systems</h1>
                <p className="mt-2 text-gray-400">Create and manage AI-powered business workflows and bring your own agents to the platform.</p>
              </div>
              {renderPlatformGrid(agentPlatforms)}
            </div>

            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold">Voice AI Agents</h1>
                <p className="mt-2 text-gray-400">Select a voice AI platform to create and manage your conversational agents.</p>
              </div>
              {renderPlatformGrid(voiceAgentPlatforms)}
            </div>

            {/* N8N Automation Section */}
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold">N8N Automation</h1>
                <p className="mt-2 text-gray-400">Create tokens for N8N automation workflows. Connect 100+ tools with a single node.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div
                  onClick={() => setShowN8nTokenModal(true)}
                  className="cursor-pointer"
                >
                  <NeonContainer className="h-full">
                    <div className="p-6 h-full flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-3xl">🔗</div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 text-xs font-medium bg-green-500/20 text-green-400 rounded-full">
                            Active
                          </span>
                        </div>
                      </div>

                      <h3 className="text-xl font-semibold text-white mb-2">
                        N8N Token Manager
                      </h3>

                      <p className="text-gray-400 text-sm mb-4 flex-grow">
                        Create and manage authentication tokens for N8N workflows. Enable your customers' integrated tools in your automation workflows.
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="text-blue-400 text-sm font-medium">
                          Manage Tokens →
                        </span>
                      </div>
                    </div>
                  </NeonContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Coming Soon Modal */}
      <Transition appear show={showComingSoonModal} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {
          setShowComingSoonModal(false);
          setComingSoonPlatform(null);
        }}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={React.Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-900 border border-blue-400/20 p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-white">
                      <div className="flex items-center gap-2">
                        {typeof comingSoonPlatform?.icon === 'string' ? (
                          <span className="text-xl">{comingSoonPlatform.icon}</span>
                        ) : comingSoonPlatform?.icon ? (
                          <comingSoonPlatform.icon className="w-6 h-6 text-blue-400" />
                        ) : null}
                        <span>{comingSoonPlatform?.name}</span>
                      </div>
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        setShowComingSoonModal(false);
                        setComingSoonPlatform(null);
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mt-2">
                    {comingSoonPlatform?.id === 'knova-byoa' ? (
                      <>
                        <p className="text-sm text-gray-300 mb-4">
                          Knova AI (BYOA) - Bring Your Own Agent is coming soon as an open source project!
                        </p>

                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
                          <h4 className="text-blue-400 font-medium mb-2">What's Coming:</h4>
                          <ul className="text-sm text-gray-300 space-y-1">
                            <li>• Connect your self-hosted Knova AI agents</li>
                            <li>• Import agents from the Knova AI portal</li>
                            <li>• Create workflows with your own agents</li>
                            <li>• Full open source flexibility</li>
                          </ul>
                        </div>

                        <p className="text-xs text-gray-400">
                          This feature will be available once Knova Agent reaches production readiness and becomes open source.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-300 mb-4">
                          {comingSoonPlatform?.name} is currently under development and will be available soon!
                        </p>

                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                          <h4 className="text-yellow-400 font-medium mb-2">Coming Soon:</h4>
                          <p className="text-sm text-gray-300">
                            {comingSoonPlatform?.description}
                          </p>
                        </div>

                        <p className="text-xs text-gray-400">
                          We're working hard to bring you this feature. Stay tuned for updates!
                        </p>
                      </>
                    )}
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                      onClick={() => {
                        setShowComingSoonModal(false);
                        setComingSoonPlatform(null);
                      }}
                    >
                      Got it!
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* N8N Token Modal */}
      <N8nTokenModal
        isOpen={showN8nTokenModal}
        onClose={() => setShowN8nTokenModal(false)}
      />

      {/* Upgrade Prompt Modal */}
      {upgradePrompt && (
        <UpgradePromptModal
          isOpen={upgradePrompt.show}
          onClose={() => setUpgradePrompt(null)}
          currentTier={upgradePrompt.currentTier}
          suggestedTier={upgradePrompt.suggestedTier}
          feature={upgradePrompt.feature}
          title={upgradePrompt.title}
          message={upgradePrompt.message}
        />
      )}
      </div>
    </UserGuideProvider>
  );
}
