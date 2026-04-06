'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  FiVideo,
  FiFileText,
  FiGlobe,
  FiMonitor,
  FiArrowRight
} from 'react-icons/fi';
import PartnerSidebar from '@/components/partner/PartnerSidebar';
import NeonContainer from '@/components/NeonContainer';

export default function MarketingPage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = React.useState('');

  React.useEffect(() => {
    // Get partner name from localStorage
    const storedName = localStorage.getItem('partner_name');
    if (storedName) {
      setPartnerName(storedName);
    }

    // Check if token exists
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
    }
  }, [router]);

  const handleLogout = () => {
    // Clear partner data from localStorage
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    // Redirect to login page
    router.push('/partner/login');
  };

  const marketingOptions = [
    {
      icon: FiVideo,
      title: 'Marketing Videos',
      description: 'Access ready-to-use videos to showcase voice AI capabilities to your prospects',
      href: '/partner/marketing/videos',
      color: 'blue'
    },
    {
      icon: FiFileText,
      title: 'Marketing Posts',
      description: 'Social media and blog content templates to promote your voice AI solutions',
      href: '/partner/marketing/posts',
      color: 'teal'
    },
    {
      icon: FiGlobe,
      title: 'Voice-Enabled Website',
      description: 'Get a demo website that showcases voice AI capabilities for your customers',
      href: '/partner/marketing/website',
      color: 'purple'
    },
    {
      icon: FiMonitor,
      title: 'Demo for Customers',
      description: 'Interactive demos to help you showcase voice AI to potential clients',
      href: '/partner/marketing/demo',
      color: 'pink'
    }
  ];

  // UI-only temporary restriction: show only Customer Demo on this page.
  // Other marketing options remain defined above for future enablement.
  const visibleMarketingOptions = marketingOptions.filter(
    (option) => option.href === '/partner/marketing/demo'
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      <PartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
      
      <main className="flex-1 pl-64 transition-all duration-300">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Marketing Resources</h1>
            <p className="text-gray-400 mt-2">Tools and resources to help you market your voice AI agency business</p>
          </div>

          {/* Marketing Options Grid */}
          <div className="grid grid-cols-1 gap-6 mb-8 max-w-3xl">
            {visibleMarketingOptions.map((option, index) => {
              const gradientFrom = option.color === 'blue' ? 'from-blue-500/20' : 
                                   option.color === 'teal' ? 'from-teal-500/20' : 
                                   option.color === 'purple' ? 'from-purple-500/20' : 'from-pink-500/20';
              
              const gradientTo = option.color === 'blue' ? 'to-blue-600/10' : 
                                option.color === 'teal' ? 'to-teal-600/10' : 
                                option.color === 'purple' ? 'to-purple-600/10' : 'to-pink-600/10';
              
              const iconBg = option.color === 'blue' ? 'bg-blue-500/20' : 
                            option.color === 'teal' ? 'bg-teal-500/20' : 
                            option.color === 'purple' ? 'bg-purple-500/20' : 'bg-pink-500/20';
              
              const iconColor = option.color === 'blue' ? 'text-blue-400' : 
                              option.color === 'teal' ? 'text-teal-400' : 
                              option.color === 'purple' ? 'text-purple-400' : 'text-pink-400';
              
              const buttonBg = option.color === 'blue' ? 'bg-blue-500/20 hover:bg-blue-500/30' : 
                              option.color === 'teal' ? 'bg-teal-500/20 hover:bg-teal-500/30' : 
                              option.color === 'purple' ? 'bg-purple-500/20 hover:bg-purple-500/30' : 'bg-pink-500/20 hover:bg-pink-500/30';
              
              const buttonText = option.color === 'blue' ? 'text-blue-400' : 
                                option.color === 'teal' ? 'text-teal-400' : 
                                option.color === 'purple' ? 'text-purple-400' : 'text-pink-400';

              return (
                <NeonContainer key={index} className={`p-6 bg-gradient-to-br ${gradientFrom} ${gradientTo} hover:shadow-lg hover:shadow-${option.color}-500/10 transition-all duration-300 transform hover:scale-[1.02]`}>
                  <div className="flex flex-col h-full">
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`p-3 rounded-lg ${iconBg}`}>
                        <option.icon className={`w-6 h-6 ${iconColor}`} />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">{option.title}</h3>
                        <p className="text-gray-400 mt-1">{option.description}</p>
                      </div>
                    </div>
                    <div className="mt-auto pt-4">
                      <button 
                        onClick={() => router.push(option.href)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg ${buttonBg} ${buttonText} transition-colors`}
                      >
                        <span>Explore</span>
                        <FiArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </NeonContainer>
              );
            })}
          </div>

          {/* Marketing Overview */}
          <NeonContainer className="mb-8">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Marketing Your Voice AI Agency</h2>
            </div>
            <div className="p-6">
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-6 border border-blue-500/20">
                <h3 className="text-2xl font-bold text-white mb-4">Launch Your Voice AI Agency Business</h3>
                <p className="text-gray-300 mb-6">
                  As a voice AI agency owner, effectively marketing your services is crucial for attracting and converting clients. 
                  Our marketing resources are designed to help you showcase the power of voice AI technology and communicate its 
                  benefits to potential customers.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-2">Key Selling Points</h4>
                    <ul className="space-y-2 text-gray-300">
                      <li>• 24/7 availability without additional staffing costs</li>
                      <li>• Custom markup pricing for increased profit margins</li>
                      <li>• Multi-platform integration with existing systems</li>
                      <li>• Data-driven insights for continuous improvement</li>
                    </ul>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-2">Target Industries</h4>
                    <ul className="space-y-2 text-gray-300">
                      <li>• Professional services (legal, accounting, consulting)</li>
                      <li>• Healthcare and medical practices</li>
                      <li>• Real estate and property management</li>
                      <li>• E-commerce and retail businesses</li>
                      <li>• Hospitality and travel services</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </NeonContainer>
        </div>
      </main>
    </div>
  );
}
