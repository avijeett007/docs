'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FiPlay, 
  FiDownload, 
  FiExternalLink,
  FiFilter,
  FiSearch,
  FiX,
  FiChevronLeft
} from 'react-icons/fi';
import PartnerSidebar from '@/components/partner/PartnerSidebar';
import NeonContainer from '@/components/NeonContainer';

interface VideoItem {
  id: string;
  title: string;
  description: string;
  duration: string;
  thumbnail: string;
  category: string;
  downloadUrl: string;
}

export default function MarketingVideosPage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

  // Sample video data
  const videos: VideoItem[] = [
    {
      id: '1',
      title: 'Voice AI for Customer Service',
      description: 'Show how voice AI can transform customer service operations with 24/7 support.',
      duration: '2:45',
      thumbnail: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2574&q=80',
      category: 'Customer Service',
      downloadUrl: '#'
    },
    {
      id: '2',
      title: 'Sales Automation with Voice AI',
      description: 'Demonstrate how voice AI can qualify leads and book meetings automatically.',
      duration: '3:12',
      thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2670&q=80',
      category: 'Sales',
      downloadUrl: '#'
    },
    {
      id: '3',
      title: 'Voice AI ROI Case Study',
      description: 'Real-world examples of businesses saving costs and increasing revenue with voice AI.',
      duration: '4:30',
      thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2670&q=80',
      category: 'Case Study',
      downloadUrl: '#'
    },
    {
      id: '4',
      title: 'Voice AI for Healthcare',
      description: 'How medical practices can use voice AI for appointment scheduling and patient follow-ups.',
      duration: '3:45',
      thumbnail: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2670&q=80',
      category: 'Healthcare',
      downloadUrl: '#'
    },
    {
      id: '5',
      title: 'Real Estate Lead Generation with Voice AI',
      description: 'How real estate agents can use voice AI to qualify leads and schedule property viewings.',
      duration: '5:10',
      thumbnail: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2673&q=80',
      category: 'Real Estate',
      downloadUrl: '#'
    },
    {
      id: '6',
      title: 'Voice AI Implementation Guide',
      description: 'Step-by-step guide to implementing voice AI in your client\'s business.',
      duration: '6:20',
      thumbnail: 'https://images.unsplash.com/photo-1573164574511-73c773193279?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2669&q=80',
      category: 'Implementation',
      downloadUrl: '#'
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

  const categories = ['All', ...Array.from(new Set(videos.map(video => video.category)))];

  const filteredVideos = videos.filter(video => {
    const matchesSearch = video.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         video.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || video.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
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
              <h1 className="text-3xl font-bold">Marketing Videos</h1>
              <p className="text-gray-400 mt-2">Ready-to-use videos to showcase voice AI capabilities to your prospects</p>
            </div>
          </div>

          {/* Coming Soon Banner */}
          <div className="mb-8 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-full">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-md leading-5 bg-gray-800 text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search videos..."
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
                className="block w-full pl-10 pr-10 py-2 border border-gray-700 rounded-md leading-5 bg-gray-800 text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Video Grid */}
          {filteredVideos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {filteredVideos.map((video) => (
                <div 
                  key={video.id} 
                  className="bg-gray-800/50 rounded-lg overflow-hidden hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 transform hover:scale-[1.02] group border border-gray-700"
                >
                  <div 
                    className="relative aspect-video cursor-pointer"
                    onClick={() => setSelectedVideo(video)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-500/20 to-black/50 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-blue-500/30 backdrop-blur-sm flex items-center justify-center">
                        <FiPlay className="w-6 h-6 text-white ml-1" />
                      </div>
                    </div>
                    <img 
                      src={video.thumbnail} 
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">{video.title}</h3>
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">{video.category}</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">{video.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">{video.duration}</span>
                      <button 
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Download logic would go here
                          alert(`Downloading ${video.title}`);
                        }}
                      >
                        <FiDownload className="w-4 h-4" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <NeonContainer className="p-8 text-center">
              <p className="text-gray-400">No videos found matching your search criteria.</p>
            </NeonContainer>
          )}

          {/* External Resources */}
          <NeonContainer className="mb-8">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Additional Resources</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-300 mb-6">Looking for more marketing videos? Check out these resources:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a 
                  href="https://ghlstorystudio.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <FiExternalLink className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">GHL Story Studio</h3>
                    <p className="text-sm text-gray-400">Professional marketing videos for agencies</p>
                  </div>
                </a>
                <a 
                  href="#" 
                  className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <div className="p-3 bg-purple-500/20 rounded-lg">
                    <FiPlay className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">Custom Video Creation</h3>
                    <p className="text-sm text-gray-400">Request a custom marketing video for your agency</p>
                  </div>
                </a>
              </div>
            </div>
          </NeonContainer>
        </div>
      </main>

      {/* Video Preview Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg overflow-hidden w-full max-w-4xl">
            <div className="p-4 bg-gray-800 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">{selectedVideo.title}</h3>
              <button 
                onClick={() => setSelectedVideo(null)}
                className="p-1 hover:bg-gray-700 rounded-full"
              >
                <FiX className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            <div className="aspect-video bg-black relative">
              {/* This would be a video player in a real implementation */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-blue-500/30 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
                    <FiPlay className="w-8 h-8 text-white ml-1" />
                  </div>
                  <p className="text-gray-400">Video player would appear here</p>
                </div>
              </div>
              <img 
                src={selectedVideo.thumbnail} 
                alt={selectedVideo.title}
                className="w-full h-full object-cover opacity-50"
              />
            </div>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-sm text-gray-400">{selectedVideo.category}</span>
                  <span className="mx-2 text-gray-600">•</span>
                  <span className="text-sm text-gray-400">{selectedVideo.duration}</span>
                </div>
                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2">
                  <FiDownload className="w-4 h-4" />
                  <span>Download Video</span>
                </button>
              </div>
              <p className="text-gray-300">{selectedVideo.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
