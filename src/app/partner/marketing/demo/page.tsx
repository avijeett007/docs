'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiChevronLeft,
  FiHeadphones,
  FiHome,
  FiShoppingCart,
  FiUser,
  FiCalendar,
  FiHeart,
  FiPlay,
  FiArrowRight,
  FiSettings,
  FiAlertCircle,
  // Unused imports removed
} from 'react-icons/fi';
import PartnerSidebar from '@/components/partner/PartnerSidebar';
import NeonContainer from '@/components/NeonContainer';
import DemoDeploymentModal from '@/components/partner/DemoDeploymentModal';
import WebCallModal from '@/components/partner/WebCallModal';

interface DemoDeployment {
  id: string;
  status: string;
  deployedAgentId: string | null;
  lastDeployedAt: string | null;
  lastTestedAt: string | null;
  customBusinessName: string | null;
  customCharacterName: string | null;
}

interface DemoItem {
  id: string;
  name: string;
  industry: string;
  description: string;
  useCases: string[];
  benefits: string[];
  iconName: string;
  color: string;
  demoType: string;
  isOutbound: boolean;
  isActive: boolean;
  deployment: DemoDeployment | null;
}

// Modal component for API key requirement
const ApiKeyModal = ({ isOpen, onClose, onSettings }: { isOpen: boolean, onClose: () => void, onSettings: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-500/20 rounded-full">
            <FiAlertCircle className="w-6 h-6 text-amber-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">Retell API Key Required</h3>
        </div>

        <p className="text-gray-300 mb-6">
          To deploy and test voice AI demos, you need to add your Retell API key in the settings.
          Don't have a Retell account yet? Sign up to get $10 in free credits.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <a
            href="https://dashboard.retellai.com/?ref=avijit"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-center"
          >
            Sign Up for Retell
          </a>
          <button
            onClick={onSettings}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <FiSettings className="w-4 h-4" />
            <span>Go to Settings</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default function DemoPage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIndustry, setSelectedIndustry] = useState('All');
  const [demos, setDemos] = useState<DemoItem[]>([]);
  const [hasRetellApiKey, setHasRetellApiKey] = useState(false);

  // Demo deployment state
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);
  const [showWebCallModal, setShowWebCallModal] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState<DemoItem | null>(null);
  const [testingDemoId, setTestingDemoId] = useState<string | null>(null);

  // Fetch partner info and demos
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get token from localStorage
        const token = localStorage.getItem('partner_token');
        if (!token) {
          router.push('/partner/login');
          return;
        }

        // Fetch partner info
        const partnerResponse = await fetch('/api/partner/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!partnerResponse.ok) {
          if (partnerResponse.status === 401) {
            localStorage.removeItem('partner_token');
            router.push('/partner/login');
            return;
          }
          throw new Error('Failed to fetch partner info');
        }
        const partnerData = await partnerResponse.json();
        console.log('Partner data:', partnerData);
        setPartnerName(partnerData.name);
        setHasRetellApiKey(!!partnerData.retellApiKey);
        console.log('Has Retell API key:', !!partnerData.retellApiKey);

        // Fetch demos
        const demosResponse = await fetch('/api/partner/demos', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!demosResponse.ok) {
          if (demosResponse.status === 401) {
            localStorage.removeItem('partner_token');
            router.push('/partner/login');
            return;
          }
          throw new Error('Failed to fetch demos');
        }
        const demosData = await demosResponse.json();
        setDemos(demosData.demos);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLogout = () => {
    // Clear partner data from localStorage
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    // Redirect to login page
    router.push('/partner/login');
  };

  const industries = ['All', ...Array.from(new Set(demos.map(demo => demo.industry)))];

  const filteredDemos = demos.filter(demo => {
    return selectedIndustry === 'All' || demo.industry === selectedIndustry;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      <PartnerSidebar partnerName={partnerName} onLogout={handleLogout} />

      <main className="flex-1 pl-64 transition-all duration-300">
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <button
                onClick={() => router.push('/partner/marketing')}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
              >
                <FiChevronLeft className="w-4 h-4" />
                <span>Back to Marketing</span>
              </button>
              <h1 className="text-3xl font-bold">Demo for Customers</h1>
              <p className="text-gray-400 mt-2">Interactive demos to help you showcase voice AI to potential clients</p>
            </div>
          </div>

          {/* Retell API Key Banner */}
          <div className="mb-8 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-full">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Deploy AI Voice Demos with Your Retell API Key</h3>
              <p className="text-gray-300">These healthcare-focused demos showcase how voice AI can transform patient communication. Deploy them to your Retell account with a single click and use them in your client presentations.</p>
            </div>
            {!hasRetellApiKey && (
              <a
                href="https://retellai.com"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Get Retell API Key
              </a>
            )}
          </div>

          {/* Industry Filter */}
          <div className="mb-8 flex flex-wrap gap-2">
            {industries.map(industry => (
              <button
                key={industry}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedIndustry === industry
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => setSelectedIndustry(industry)}
              >
                {industry}
              </button>
            ))}
          </div>

          {/* Demo Grid */}
          <NeonContainer className="mb-8">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Available Demos</h2>
              <p className="text-sm text-gray-400 mt-1">Deploy these demos to your Retell account and use them in your sales presentations</p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredDemos.map(demo => {
                // Determine icon component based on iconName
                let IconComponent;
                switch (demo.iconName) {
                  case 'FiUser':
                    IconComponent = FiUser;
                    break;
                  case 'FiCalendar':
                    IconComponent = FiCalendar;
                    break;
                  case 'FiHeart':
                    IconComponent = FiHeart;
                    break;
                  case 'FiHeadphones':
                    IconComponent = FiHeadphones;
                    break;
                  case 'FiHome':
                    IconComponent = FiHome;
                    break;
                  case 'FiShoppingCart':
                    IconComponent = FiShoppingCart;
                    break;
                  default:
                    IconComponent = FiUser;
                }

                // Determine colors based on demo.color
                let gradientFrom, gradientTo, iconBg, iconColor, buttonBg;
                switch (demo.color) {
                  case 'blue':
                    gradientFrom = 'from-blue-900/30';
                    gradientTo = 'to-blue-800/10';
                    iconBg = 'bg-blue-500/20';
                    iconColor = 'text-blue-400';
                    buttonBg = 'bg-blue-500 hover:bg-blue-600';
                    break;
                  case 'red':
                    gradientFrom = 'from-red-900/30';
                    gradientTo = 'to-red-800/10';
                    iconBg = 'bg-red-500/20';
                    iconColor = 'text-red-400';
                    buttonBg = 'bg-red-500 hover:bg-red-600';
                    break;
                  case 'green':
                    gradientFrom = 'from-green-900/30';
                    gradientTo = 'to-green-800/10';
                    iconBg = 'bg-green-500/20';
                    iconColor = 'text-green-400';
                    buttonBg = 'bg-green-500 hover:bg-green-600';
                    break;
                  case 'purple':
                    gradientFrom = 'from-purple-900/30';
                    gradientTo = 'to-purple-800/10';
                    iconBg = 'bg-purple-500/20';
                    iconColor = 'text-purple-400';
                    buttonBg = 'bg-purple-500 hover:bg-purple-600';
                    break;
                  case 'teal':
                    gradientFrom = 'from-teal-900/30';
                    gradientTo = 'to-teal-800/10';
                    iconBg = 'bg-teal-500/20';
                    iconColor = 'text-teal-400';
                    buttonBg = 'bg-teal-500 hover:bg-teal-600';
                    break;
                  default:
                    gradientFrom = 'from-gray-900/30';
                    gradientTo = 'to-gray-800/10';
                    iconBg = 'bg-gray-500/20';
                    iconColor = 'text-gray-400';
                    buttonBg = 'bg-gray-500 hover:bg-gray-600';
                }

                // Demo is ready if isActive is true

                return (
                  <NeonContainer
                    key={demo.id}
                    className={`p-6 bg-gradient-to-br ${gradientFrom} ${gradientTo} hover:shadow-lg hover:shadow-${demo.color}-500/10 transition-all duration-300 transform hover:scale-[1.02]`}
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex items-start gap-4 mb-4">
                        <div className={`p-3 rounded-lg ${iconBg}`}>
                          <IconComponent className={`w-6 h-6 ${iconColor}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-semibold text-white">{demo.name}</h3>
                            <span className="text-xs px-2 py-0.5 bg-gray-800 rounded-full text-gray-300">{demo.industry}</span>
                          </div>
                          <p className="text-gray-400 mt-1">{demo.description}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Use Cases</h4>
                          <ul className="space-y-1">
                            {demo.useCases.slice(0, 3).map((useCase, index) => (
                              <li key={index} className="text-xs text-gray-400 flex items-start gap-2">
                                <span className="text-xs mt-0.5">•</span>
                                <span>{useCase}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Benefits</h4>
                          <ul className="space-y-1">
                            {demo.benefits.slice(0, 3).map((benefit, index) => (
                              <li key={index} className="text-xs text-gray-400 flex items-start gap-2">
                                <span className="text-xs mt-0.5">•</span>
                                <span>{benefit}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-auto pt-4 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <FiPlay className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-400">
                            {demo.isActive ? 'Multilingual AI Demo' : 'Coming soon'}
                          </span>
                        </div>
                        {demo.isActive ? (
                          <button
                            onClick={() => {
                              console.log('Try Demo clicked, hasRetellApiKey:', hasRetellApiKey);
                              if (hasRetellApiKey) {
                                // Show deployment modal
                                setSelectedDemo(demo);
                                setShowDeploymentModal(true);
                              } else {
                                // Show API key required modal
                                setShowApiKeyModal(true);
                              }
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${buttonBg} ${iconColor} transition-colors hover:opacity-80`}
                          >
                            <span>Try Demo</span>
                            <FiArrowRight className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            disabled
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${buttonBg} ${iconColor} transition-colors opacity-50 cursor-not-allowed`}
                          >
                            <span>Try Demo</span>
                            <FiArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </NeonContainer>
                );
              })}
            </div>
          </NeonContainer>

          {/* Demo Request Section */}
          <NeonContainer className="mb-8">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Request a Custom Demo</h2>
            </div>
            <div className="p-6">
              <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-lg p-6 border border-pink-500/20">
                <h3 className="text-xl font-bold text-white mb-4">Need a Tailored Demo for Your Clients?</h3>
                <p className="text-gray-300 mb-6">
                  We can create a customized demo specifically for your target industry or use case. Our team will work with you to develop
                  a compelling demonstration that showcases the exact capabilities your clients need to see.
                </p>
                <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Custom Demo Options:</h4>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-xs">•</span>
                      <span>Industry-specific vocabulary and scenarios</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-xs">•</span>
                      <span>Integration with your existing systems</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-xs">•</span>
                      <span>Custom voice and personality options</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-xs">•</span>
                      <span>Branded experience with your company's look and feel</span>
                    </li>
                  </ul>
                </div>
                <button className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600 transition-colors">
                  Request Custom Demo
                </button>
              </div>
            </div>
          </NeonContainer>
        </div>
      </main>

      {/* Modals */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSettings={() => router.push('/partner/settings')}
      />
      <DemoDeploymentModal
        isOpen={showDeploymentModal}
        onClose={() => setShowDeploymentModal(false)}
        demo={selectedDemo}
        onTest={(demoId) => {
          setTestingDemoId(demoId);
          setShowWebCallModal(true);
          setShowDeploymentModal(false);
        }}
      />
      {selectedDemo && testingDemoId && (
        <WebCallModal
          isOpen={showWebCallModal}
          onClose={() => setShowWebCallModal(false)}
          demoId={testingDemoId}
          demoName={selectedDemo.name}
        />
      )}
    </div>
  );
}
