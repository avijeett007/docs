'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiArrowLeft, 
  FiPlus, 
  FiEdit, 
  FiTrash2, 
  FiCheck, 
  FiX, 
  FiServer,
  FiAlertCircle,
  FiSettings
} from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';
import N8nInstanceModal from '@/components/partner/N8nInstanceModal';

interface N8nInstance {
  id: string;
  name: string;
  baseUrl: string;
  description: string | null;
  isActive: boolean;
  connectionStatus: string;
  connectionError: string | null;
  n8nVersion: string | null;
  lastConnectionTest: string | null;
  createdAt: string;
  updatedAt: string;
}

const N8nInstancesPage = () => {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('Partner');
  const [instances, setInstances] = useState<N8nInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInstance, setEditingInstance] = useState<N8nInstance | null>(null);

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

  // Fetch N8N instances
  const fetchInstances = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/n8n-instances', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setInstances(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch N8N instances:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    window.location.href = '/partner/login';
  };

  const handleEdit = (instance: N8nInstance) => {
    setEditingInstance(instance);
    setShowModal(true);
  };

  const handleDelete = async (instanceId: string) => {
    if (!confirm('Are you sure you want to delete this N8N instance configuration?')) {
      return;
    }

    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch(`/api/partner/n8n-instances/${instanceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchInstances(); // Refresh list
      } else {
        alert('Failed to delete instance');
      }
    } catch (error) {
      console.error('Failed to delete instance:', error);
      alert('Failed to delete instance');
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingInstance(null);
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    setEditingInstance(null);
    fetchInstances(); // Refresh list
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-400 bg-green-900/20';
      case 'error': return 'text-red-400 bg-red-900/20';
      case 'unknown': return 'text-gray-400 bg-gray-900/20';
      default: return 'text-yellow-400 bg-yellow-900/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <FiCheck className="w-4 h-4" />;
      case 'error': return <FiX className="w-4 h-4" />;
      default: return <FiAlertCircle className="w-4 h-4" />;
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                  >
                    <FiArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h1 className="text-3xl font-bold text-white">N8N Instances</h1>
                    <p className="text-gray-400 text-lg">
                      Manage your N8N instance configurations for workflow deployment
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                >
                  <FiPlus className="w-4 h-4" />
                  Add Instance
                </button>
              </div>
            </div>

            {/* Instances List */}
            {instances.length === 0 ? (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
                <FiServer className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No N8N Instances</h3>
                <p className="text-gray-400 mb-6">
                  Add your first N8N instance to start deploying workflows
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2 mx-auto"
                >
                  <FiPlus className="w-4 h-4" />
                  Add N8N Instance
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {instances.map((instance) => (
                  <div key={instance.id} className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <FiServer className="w-6 h-6 text-blue-400" />
                        <div>
                          <h3 className="text-lg font-semibold text-white">{instance.name}</h3>
                          <p className="text-sm text-gray-400">{instance.baseUrl}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(instance)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <FiEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(instance.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {instance.description && (
                      <p className="text-gray-400 text-sm mb-4">{instance.description}</p>
                    )}

                    {/* Status */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(instance.connectionStatus)}`}>
                        {getStatusIcon(instance.connectionStatus)}
                        {instance.connectionStatus}
                      </span>
                      {instance.n8nVersion && (
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                          v{instance.n8nVersion}
                        </span>
                      )}
                    </div>

                    {/* Connection Error */}
                    {instance.connectionError && (
                      <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 mb-4">
                        <p className="text-red-400 text-sm">{instance.connectionError}</p>
                      </div>
                    )}

                    {/* Last Test */}
                    {instance.lastConnectionTest && (
                      <p className="text-xs text-gray-500">
                        Last tested: {new Date(instance.lastConnectionTest).toLocaleString()}
                      </p>
                    )}

                    {/* Active Status */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                      <span className="text-sm text-gray-400">
                        {instance.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <div className={`w-2 h-2 rounded-full ${instance.isActive ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Instance Modal */}
        {showModal && (
          <N8nInstanceModal
            instance={editingInstance}
            onClose={handleModalClose}
            onSuccess={handleModalSuccess}
          />
        )}
      </div>
    </UserGuideProvider>
  );
};

export default N8nInstancesPage;
