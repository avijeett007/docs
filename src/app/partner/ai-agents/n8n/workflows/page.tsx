'use client';

import React, { useState, useEffect } from 'react';
import {
  FiArrowLeft,
  FiSearch,
  FiFilter,
  FiDownload,
  FiPlay,
  FiClock,
  FiTag,
  FiExternalLink,
  FiVideo,
  FiMoreVertical,
  FiInfo
} from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { Menu, Transition } from '@headlessui/react';
import clsx from 'clsx';
import NeonContainer from '@/components/NeonContainer';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';
import WorkflowDeploymentModal from '@/components/partner/WorkflowDeploymentModal';
import toast from 'react-hot-toast';

interface WorkflowProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: string;
  estimatedSetupTime: number;
  setupVideoUrl: string | null;
  setupVideoThumbnail: string | null;
  documentationUrl: string | null;
  blogArticleUrl: string | null;
  downloadCount: number;
  deploymentCount: number;
  createdAt: string;
}

const WorkflowProductsPage = () => {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('Partner');
  const [products, setProducts] = useState<WorkflowProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<WorkflowProduct | null>(null);

  // Fetch partner info
  useEffect(() => {
    const fetchPartnerInfo = async () => {
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) return;

        const response = await fetch('/api/partner/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setPartnerName(data.partner?.businessName || data.partner?.contactName || 'Partner');
        }
      } catch (error) {
        console.error('Failed to fetch partner info:', error);
      }
    };

    fetchPartnerInfo();
  }, []);

  // Fetch workflow products
  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/n8n-workflow-products', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch workflow products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    window.location.href = '/partner/login';
  };

  const handleDownload = async (product: WorkflowProduct) => {
    try {
      const token = localStorage.getItem('partner_token');

      // First get the workflow JSON
      const response = await fetch(`/api/partner/n8n-workflow-products/${product.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        toast.error('Failed to download workflow');
        return;
      }

      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to download workflow');
        return;
      }

      // Create and download the JSON file
      const workflowJson = data.data.workflowJson;
      const blob = new Blob([JSON.stringify(workflowJson, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${product.name.replace(/[^a-zA-Z0-9]/g, '_')}_workflow.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Track the download
      await fetch('/api/partner/n8n-workflow-products/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId: product.id })
      });

      // Refresh products to update download count
      fetchProducts();
      toast.success('Workflow downloaded successfully');
    } catch (error) {
      console.error('Failed to download workflow:', error);
      toast.error('Failed to download workflow');
    }
  };

  const handleDeploy = (product: WorkflowProduct) => {
    setSelectedProduct(product);
    setShowDeployModal(true);
  };

  const handleDeployModalClose = () => {
    setShowDeployModal(false);
    setSelectedProduct(null);
  };

  const handleDeploySuccess = () => {
    setShowDeployModal(false);
    setSelectedProduct(null);
    fetchProducts(); // Refresh to update deployment counts
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'all' || product.difficulty === selectedDifficulty;

    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  // Get unique categories and difficulties
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];
  const difficulties = ['all', ...Array.from(new Set(products.map(p => p.difficulty)))];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-400 bg-green-900/20';
      case 'intermediate': return 'text-yellow-400 bg-yellow-900/20';
      case 'advanced': return 'text-red-400 bg-red-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  if (loading) {
    return (
      <UserGuideProvider>
        <div className="min-h-screen bg-gray-900 text-white flex">
          <GuidedPartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
          <div className="flex-1 ml-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
          </div>
        </div>
      </UserGuideProvider>
    );
  }

  return (
    <UserGuideProvider>
      <div className="min-h-screen bg-gray-900 text-white flex">
        <GuidedPartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
        <div className="flex-1 ml-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => router.back()}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                  <FiArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-white">N8N Workflow Products</h1>
                  <p className="text-gray-400 text-lg">
                    Deploy pre-configured automation workflows to your customers
                  </p>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search workflows..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {difficulties.map(difficulty => (
                    <option key={difficulty} value={difficulty}>
                      {difficulty === 'all' ? 'All Levels' : difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
                <FiFilter className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Workflows Found</h3>
                <p className="text-gray-400">
                  {searchTerm || selectedCategory !== 'all' || selectedDifficulty !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'No workflow products are available yet'
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <NeonContainer key={product.id} className="p-6 h-[380px] flex flex-col">
                    <div className="flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 mr-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{product.name}</h3>
                            <div className="relative group">
                              <FiInfo className="w-5 h-5 cursor-help text-gray-400 hover:text-blue-400 transition-colors" />
                              <div className="absolute right-0 mt-2 w-72 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20">
                                <div className="text-sm space-y-3">
                                  <div>
                                    <div className="font-medium text-white mb-1">Category</div>
                                    <div className="text-gray-300 text-xs capitalize">{product.category}</div>
                                  </div>
                                  <div className="border-t border-gray-600 pt-2">
                                    <div className="font-medium text-white mb-1">Stats</div>
                                    <div className="text-xs text-gray-400">
                                      {product.downloadCount} downloads • {product.deploymentCount} deployments
                                    </div>
                                  </div>
                                  {product.estimatedSetupTime && (
                                    <div className="border-t border-gray-600 pt-2">
                                      <div className="font-medium text-white mb-1">Setup Time</div>
                                      <div className="text-xs text-gray-400">
                                        ~{product.estimatedSetupTime} minutes
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-400 mt-2 line-clamp-2">{product.description}</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className={clsx(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            product.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400' :
                            product.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          )}>
                            {product.difficulty}
                          </div>
                          <Menu as="div" className="relative">
                            <Menu.Button className="p-1 rounded-lg hover:bg-gray-800 transition-colors">
                              <FiMoreVertical className="w-5 h-5 text-gray-400" />
                            </Menu.Button>
                            <Transition
                              enter="transition duration-100 ease-out"
                              enterFrom="transform scale-95 opacity-0"
                              enterTo="transform scale-100 opacity-100"
                              leave="transition duration-75 ease-out"
                              leaveFrom="transform scale-100 opacity-100"
                              leaveTo="transform scale-95 opacity-0"
                            >
                              <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-gray-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                <div className="p-1">
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => handleDeploy(product)}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                          active ? 'bg-gray-700' : ''
                                        )}
                                      >
                                        <FiPlay className="w-4 h-4" />
                                        <span>Deploy Workflow</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => handleDownload(product)}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                          active ? 'bg-gray-700' : ''
                                        )}
                                      >
                                        <FiDownload className="w-4 h-4" />
                                        <span>Download JSON</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  {product.setupVideoUrl && (
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => window.open(product.setupVideoUrl!, '_blank')}
                                          className={clsx(
                                            'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                            active ? 'bg-gray-700' : ''
                                          )}
                                        >
                                          <FiVideo className="w-4 h-4" />
                                          <span>Setup Video</span>
                                        </button>
                                      )}
                                    </Menu.Item>
                                  )}
                                  {(product.documentationUrl || product.blogArticleUrl) && (
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => {
                                            const url = product.documentationUrl || product.blogArticleUrl;
                                            if (url) window.open(url, '_blank');
                                          }}
                                          className={clsx(
                                            'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                            active ? 'bg-gray-700' : ''
                                          )}
                                        >
                                          <FiExternalLink className="w-4 h-4" />
                                          <span>Documentation</span>
                                        </button>
                                      )}
                                    </Menu.Item>
                                  )}
                                </div>
                              </Menu.Items>
                            </Transition>
                          </Menu>
                        </div>
                      </div>

                      {/* Tags */}
                      {product.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {product.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full flex items-center gap-1"
                            >
                              <FiTag className="w-3 h-3" />
                              {tag}
                            </span>
                          ))}
                          {product.tags.length > 3 && (
                            <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full">
                              +{product.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Main Action Button */}
                      <div className="mt-auto pt-4">
                        <button
                          onClick={() => handleDeploy(product)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <FiPlay className="w-4 h-4" />
                          Deploy to N8N
                        </button>
                      </div>
                    </div>
                  </NeonContainer>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Deployment Modal */}
        {showDeployModal && selectedProduct && (
          <WorkflowDeploymentModal
            product={selectedProduct}
            onClose={handleDeployModalClose}
            onSuccess={handleDeploySuccess}
          />
        )}
      </div>
    </UserGuideProvider>
  );
};

export default WorkflowProductsPage;