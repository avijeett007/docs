'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FiChevronLeft,
  FiCopy, 
  FiDownload, 
  FiFilter,
  FiSearch,
  FiX,
  FiTwitter,
  FiLinkedin,
  FiFacebook,
  FiInstagram,
  FiEdit
} from 'react-icons/fi';
import PartnerSidebar from '@/components/partner/PartnerSidebar';
import NeonContainer from '@/components/NeonContainer';

interface PostItem {
  id: string;
  title: string;
  content: string;
  platform: string;
  category: string;
  imageUrl?: string;
}

export default function MarketingPostsPage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPlatform, setSelectedPlatform] = useState('All');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customizedPost, setCustomizedPost] = useState<PostItem | null>(null);
  const [customContent, setCustomContent] = useState('');

  // Sample post data
  const posts: PostItem[] = [
    {
      id: '1',
      title: 'Customer Service Transformation',
      content: 'Transform your customer service with voice AI! Our clients are seeing 70% reduction in response times and 24/7 availability without adding staff. #VoiceAI #CustomerService',
      platform: 'Twitter',
      category: 'Customer Service',
      imageUrl: 'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2673&q=80'
    },
    {
      id: '2',
      title: 'Voice AI ROI',
      content: 'How Voice AI is delivering 300% ROI for our clients:\n\n✅ 24/7 customer support\n✅ Instant response to inquiries\n✅ Qualified leads while you sleep\n✅ Seamless scheduling and follow-ups\n\nReady to transform your business operations? Let\'s talk about implementing voice AI for your specific needs.',
      platform: 'LinkedIn',
      category: 'ROI',
      imageUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2670&q=80'
    },
    {
      id: '3',
      title: 'Healthcare Appointment Scheduling',
      content: 'Our healthcare clients are revolutionizing patient scheduling with voice AI. Patients love the convenience of booking appointments 24/7, and staff love the reduced administrative burden. #HealthTech #VoiceAI',
      platform: 'Twitter',
      category: 'Healthcare',
      imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2670&q=80'
    },
    {
      id: '4',
      title: 'Real Estate Lead Generation',
      content: 'Voice AI is changing how real estate professionals generate and qualify leads. Our voice agents engage with potential buyers 24/7, qualify their interest, and schedule viewings - all while you focus on closing deals!',
      platform: 'Facebook',
      category: 'Real Estate',
      imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2673&q=80'
    },
    {
      id: '5',
      title: 'Voice AI Implementation Success',
      content: 'Excited to share another successful voice AI implementation! Our client saw a 45% increase in qualified leads and 60% reduction in response time in just the first month. The future of business communication is here. #VoiceAI #BusinessInnovation',
      platform: 'LinkedIn',
      category: 'Case Study',
      imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2574&q=80'
    },
    {
      id: '6',
      title: 'Voice AI for E-commerce',
      content: 'Transform your e-commerce business with voice AI! Provide instant customer support, process returns, and even upsell products - all through natural conversation. Our clients are seeing 30% increase in customer satisfaction and 25% boost in repeat purchases.',
      platform: 'Instagram',
      category: 'E-commerce',
      imageUrl: 'https://images.unsplash.com/photo-1573164574511-73c773193279?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2669&q=80'
    },
    {
      id: '7',
      title: 'Voice AI Blog Introduction',
      content: '# Transforming Business Communication with Voice AI\n\nIn today\'s fast-paced business environment, staying ahead means adopting technologies that not only streamline operations but also enhance customer experience. Voice AI represents one of the most significant advancements in business communication technology, offering unprecedented opportunities for automation, personalization, and scalability.\n\n## What is Voice AI?\n\nVoice AI combines artificial intelligence with natural language processing to create systems capable of understanding and responding to human speech in a natural, conversational manner. Unlike traditional IVR systems that follow rigid scripts, modern voice AI can:\n\n- Understand context and intent\n- Learn from interactions to improve over time\n- Handle complex, multi-turn conversations\n- Adapt to different accents and speech patterns\n- Seamlessly transfer to human agents when necessary\n\n## Business Applications of Voice AI\n\nThe versatility of voice AI makes it valuable across numerous business functions:\n\n### Customer Service\n\nProvide 24/7 support, instantly answer common questions, and route complex issues to the right department, all while maintaining a consistent brand voice.\n\n### Sales and Lead Generation\n\nQualify leads, schedule appointments, and follow up with prospects automatically, ensuring no opportunity falls through the cracks.\n\n### Appointment Scheduling\n\nEliminate phone tag and reduce no-shows with AI-powered scheduling that integrates with your existing calendar systems.\n\n## The ROI of Voice AI\n\nImplementing voice AI delivers measurable returns:\n\n- Reduced operational costs through automation of routine tasks\n- Increased revenue through improved lead conversion and customer retention\n- Enhanced customer satisfaction through immediate, consistent service\n- Valuable business insights from conversation analytics\n\n## Getting Started with Voice AI\n\nThe key to successful voice AI implementation lies in strategic planning and choosing the right partner. Look for solutions that offer:\n\n- Customization to your specific business needs\n- Integration with your existing systems\n- Analytics and reporting capabilities\n- Ongoing optimization and support\n\nAs voice AI technology continues to evolve, businesses that adopt early will gain significant competitive advantages in efficiency, customer experience, and market positioning.',
      platform: 'Blog',
      category: 'Introduction',
      imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2670&q=80'
    },
  ];

  useEffect(() => {
    // Get partner name from localStorage
    const storedName = localStorage.getItem('partner_name');
    if (storedName) {
      setPartnerName(storedName);
    }

    // Check if token exists
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }

    // Simulate loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  const handleLogout = () => {
    // Clear partner data from localStorage
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    // Redirect to login page
    router.push('/partner/login');
  };

  const categories = ['All', ...Array.from(new Set(posts.map(post => post.category)))];
  const platforms = ['All', ...Array.from(new Set(posts.map(post => post.platform)))];

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         post.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
    const matchesPlatform = selectedPlatform === 'All' || post.platform === selectedPlatform;
    return matchesSearch && matchesCategory && matchesPlatform;
  });

  const handleCopyContent = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCustomize = (post: PostItem) => {
    setCustomizedPost(post);
    setCustomContent(post.content);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'Twitter':
        return <FiTwitter className="text-blue-400" />;
      case 'LinkedIn':
        return <FiLinkedin className="text-blue-600" />;
      case 'Facebook':
        return <FiFacebook className="text-blue-500" />;
      case 'Instagram':
        return <FiInstagram className="text-pink-500" />;
      case 'Blog':
        return <FiEdit className="text-purple-400" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-teal-500"></div>
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
              <h1 className="text-3xl font-bold">Marketing Posts</h1>
              <p className="text-gray-400 mt-2">Social media and blog content templates to promote your voice AI solutions</p>
            </div>
          </div>

          {/* Coming Soon Banner */}
          <div className="mb-8 bg-gradient-to-r from-teal-500/20 to-blue-500/20 border border-teal-500/30 rounded-lg p-4 flex items-center gap-4">
            <div className="p-3 bg-teal-500/20 rounded-full">
              <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white">Coming Soon</h3>
              <p className="text-gray-300">This feature is currently in development. The content below is a preview of what will be available soon.</p>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="mb-8 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-md leading-5 bg-gray-800 text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                placeholder="Search posts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setSearchTerm('')}
                >
                  <FiX className="h-5 w-5 text-gray-400 hover:text-white" />
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiFilter className="h-5 w-5 text-gray-400" />
              </div>
              <select
                className="block w-full pl-10 pr-10 py-2 border border-gray-700 rounded-md leading-5 bg-gray-800 text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <select
                className="block w-full px-4 py-2 border border-gray-700 rounded-md leading-5 bg-gray-800 text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
              >
                {platforms.map((platform) => (
                  <option key={platform} value={platform}>{platform}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Posts Grid */}
          {filteredPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {filteredPosts.map((post) => {
                const isBlog = post.platform === 'Blog';
                return (
                  <NeonContainer 
                    key={post.id} 
                    className={`overflow-hidden hover:shadow-lg hover:shadow-teal-500/10 transition-all duration-300 border border-gray-700 ${isBlog ? 'col-span-1 md:col-span-2' : ''}`}
                  >
                    <div className="p-4 bg-gray-800/50 border-b border-gray-700 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-gray-700 rounded-full">
                          {getPlatformIcon(post.platform)}
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{post.title}</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{post.platform}</span>
                            <span className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-300">{post.category}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleCopyContent(post.id, post.content)}
                          className="p-2 text-gray-400 hover:text-teal-400 hover:bg-gray-700 rounded-full transition-colors"
                          title="Copy content"
                        >
                          {copiedId === post.id ? (
                            <span className="text-xs bg-teal-500 text-white px-2 py-1 rounded">Copied!</span>
                          ) : (
                            <FiCopy className="w-4 h-4" />
                          )}
                        </button>
                        <button 
                          onClick={() => handleCustomize(post)}
                          className="p-2 text-gray-400 hover:text-teal-400 hover:bg-gray-700 rounded-full transition-colors"
                          title="Customize content"
                        >
                          <FiEdit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-4 flex flex-col md:flex-row gap-4">
                      {post.imageUrl && (
                        <div className={`${isBlog ? 'w-full md:w-1/3' : 'w-full md:w-1/4'} flex-shrink-0`}>
                          <img 
                            src={post.imageUrl} 
                            alt={post.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className={`${isBlog ? 'prose prose-invert max-w-none' : 'whitespace-pre-line text-gray-300'}`}>
                          {isBlog ? (
                            <div dangerouslySetInnerHTML={{ __html: post.content.replace(/\n## /g, '<h2>').replace(/\n### /g, '<h3>').replace(/\n/g, '<br>').replace(/^# (.*)$/gm, '<h1>$1</h1>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/- /g, '• ') }} />
                          ) : (
                            post.content
                          )}
                        </div>
                      </div>
                    </div>
                  </NeonContainer>
                );
              })}
            </div>
          ) : (
            <NeonContainer className="p-8 text-center">
              <p className="text-gray-400">No posts found matching your search criteria.</p>
            </NeonContainer>
          )}

          {/* Content Creation Tips */}
          <NeonContainer className="mb-8">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Content Creation Tips</h2>
            </div>
            <div className="p-6">
              <div className="bg-gradient-to-r from-teal-500/10 to-blue-500/10 rounded-lg p-6 border border-teal-500/20">
                <h3 className="text-xl font-bold text-white mb-4">Maximizing Your Social Media Presence</h3>
                <p className="text-gray-300 mb-6">
                  Effective social media marketing for your voice AI agency requires consistency, engagement, and strategic content. 
                  Here are some best practices to get the most out of these post templates:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-2">Platform-Specific Strategies</h4>
                    <ul className="space-y-2 text-gray-300">
                      <li>u2022 <strong>LinkedIn:</strong> Focus on ROI, case studies, and professional insights</li>
                      <li>u2022 <strong>Twitter:</strong> Use hashtags and concise messaging highlighting key benefits</li>
                      <li>u2022 <strong>Facebook:</strong> Share success stories and engage with comments</li>
                      <li>u2022 <strong>Instagram:</strong> Use high-quality visuals and focus on the transformative aspects</li>
                    </ul>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-2">Content Customization</h4>
                    <ul className="space-y-2 text-gray-300">
                      <li>u2022 Add your agency name and branding</li>
                      <li>u2022 Insert specific industry examples relevant to your target market</li>
                      <li>u2022 Include your own client success metrics when available</li>
                      <li>u2022 Adapt the tone to match your agency's voice and personality</li>
                      <li>u2022 Add a clear call-to-action that directs to your specific offerings</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </NeonContainer>
        </div>
      </main>

      {/* Customization Modal */}
      {customizedPost && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg overflow-hidden w-full max-w-4xl">
            <div className="p-4 bg-gray-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gray-700 rounded-full">
                  {getPlatformIcon(customizedPost.platform)}
                </div>
                <h3 className="text-lg font-semibold text-white">Customize {customizedPost.title}</h3>
              </div>
              <button 
                onClick={() => setCustomizedPost(null)}
                className="p-1 hover:bg-gray-700 rounded-full"
              >
                <FiX className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            <div className="p-4">
              <textarea
                className="w-full h-64 p-4 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
              />
              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-400">
                  <p>Customize this content for your specific audience and offerings.</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCustomizedPost(null)}
                    className="px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(customContent);
                      setCustomizedPost(null);
                      // Show a toast or notification here
                      alert('Customized content copied to clipboard!');
                    }}
                    className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors flex items-center gap-2"
                  >
                    <FiCopy className="w-4 h-4" />
                    <span>Copy Customized Content</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
