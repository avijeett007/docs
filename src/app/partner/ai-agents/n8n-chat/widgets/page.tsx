'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiPlus, 
  FiEdit3, 
  FiTrash2, 
  FiEye, 
  FiCopy, 
  FiGlobe, 
  FiActivity,
  FiMessageCircle,
  FiUsers,
  FiSettings,
  FiArrowLeft
} from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import N8nChatWidgetModal from '@/components/partner/N8nChatWidgetModal';

interface N8nChatAgent {
  id: string;
  name: string;
  status: string;
  integrationMode: string;
}

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

interface N8nChatWidget {
  id: string;
  name: string;
  description?: string;
  agent_id: string;
  customer_id: string;
  widget_config: any;
  appearance: any;
  behavior: any;
  widget_token: string;
  allowed_domains: string[];
  is_active: boolean;
  total_sessions: number;
  total_messages: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
  widget_url: string;
  embed_code: string;
  agent?: N8nChatAgent;
  customer?: Customer;
  session_count?: number;
}

export default function N8nChatWidgetsPage() {
  const [widgets, setWidgets] = useState<N8nChatWidget[]>([]);
  const [agents, setAgents] = useState<N8nChatAgent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<N8nChatWidget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch widgets, agents, and customers in parallel
      const [widgetsRes, agentsRes, customersRes] = await Promise.all([
        fetch('/api/partner/n8n-chat-widgets'),
        fetch('/api/partner/n8n-chat-agents'),
        fetch('/api/partner/customers')
      ]);

      if (widgetsRes.ok) {
        const widgetsData = await widgetsRes.json();
        setWidgets(widgetsData.data || []);
      }

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData.data || []);
      }

      if (customersRes.ok) {
        const customersData = await customersRes.json();
        setCustomers(customersData.data || []);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWidget = () => {
    setSelectedWidget(null);
    setIsModalOpen(true);
  };

  const handleEditWidget = (widget: N8nChatWidget) => {
    setSelectedWidget(widget);
    setIsModalOpen(true);
  };

  const handleSaveWidget = async (widgetData: any) => {
    try {
      setIsSubmitting(true);
      
      const url = selectedWidget 
        ? `/api/partner/n8n-chat-widgets/${selectedWidget.id}`
        : '/api/partner/n8n-chat-widgets';
      
      const method = selectedWidget ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(widgetData),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(selectedWidget ? 'Widget updated successfully!' : 'Widget created successfully!');
        setIsModalOpen(false);
        fetchData(); // Refresh the list
      } else {
        toast.error(result.error || 'Failed to save widget');
      }

    } catch (error) {
      console.error('Error saving widget:', error);
      toast.error('Failed to save widget');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWidget = async (widget: N8nChatWidget) => {
    if (!confirm(`Are you sure you want to delete "${widget.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/partner/n8n-chat-widgets/${widget.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Widget deleted successfully!');
        fetchData(); // Refresh the list
      } else {
        const result = await response.json();
        toast.error(result.error || 'Failed to delete widget');
      }

    } catch (error) {
      console.error('Error deleting widget:', error);
      toast.error('Failed to delete widget');
    }
  };

  const copyWidgetUrl = (widget: N8nChatWidget) => {
    navigator.clipboard.writeText(widget.widget_url);
    toast.success('Widget URL copied to clipboard!');
  };

  const copyEmbedCode = (widget: N8nChatWidget) => {
    navigator.clipboard.writeText(widget.embed_code);
    toast.success('Embed code copied to clipboard!');
  };

  const getCustomerDisplayName = (customer: Customer) => {
    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    return customer.email;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading widgets...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/partner/ai-agents/n8n-chat"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <FiArrowLeft className="w-5 h-5" />
              Back to Agents
            </Link>
            <div>
              <h1 className="text-3xl font-bold">N8N Chat Widgets</h1>
              <p className="text-gray-400 mt-1">
                Create embeddable chat widgets for your N8N Chat agents
              </p>
            </div>
          </div>
          
          <button
            onClick={handleCreateWidget}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            Create Widget
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <FiSettings className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Widgets</p>
                <p className="text-2xl font-bold">{widgets.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <FiActivity className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Active Widgets</p>
                <p className="text-2xl font-bold">
                  {widgets.filter(w => w.is_active).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <FiUsers className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Sessions</p>
                <p className="text-2xl font-bold">
                  {widgets.reduce((sum, w) => sum + w.total_sessions, 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <FiMessageCircle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Messages</p>
                <p className="text-2xl font-bold">
                  {widgets.reduce((sum, w) => sum + w.total_messages, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Widgets List */}
        {widgets.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <FiSettings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No widgets created yet</h3>
            <p className="text-gray-400 mb-6">
              Create your first embeddable chat widget to start engaging with your website visitors.
            </p>
            <button
              onClick={handleCreateWidget}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Create Your First Widget
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {widgets.map((widget) => (
              <div key={widget.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                {/* Widget Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">{widget.name}</h3>
                    {widget.description && (
                      <p className="text-sm text-gray-400 mb-2">{widget.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        widget.is_active 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {widget.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {widget.allowed_domains.length > 0 && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                          Domain Restricted
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Widget Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Agent:</span>
                    <span className="text-white">{widget.agent?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Customer:</span>
                    <span className="text-white">
                      {widget.customer ? getCustomerDisplayName(widget.customer) : 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Sessions:</span>
                    <span className="text-white">{widget.total_sessions}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Messages:</span>
                    <span className="text-white">{widget.total_messages}</span>
                  </div>
                  {widget.last_used_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Last Used:</span>
                      <span className="text-white">{formatDate(widget.last_used_at)}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyWidgetUrl(widget)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                    title="Copy Widget URL"
                  >
                    <FiGlobe className="w-4 h-4" />
                    URL
                  </button>
                  
                  <button
                    onClick={() => copyEmbedCode(widget)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                    title="Copy Embed Code"
                  >
                    <FiCopy className="w-4 h-4" />
                    Embed
                  </button>
                  
                  <button
                    onClick={() => handleEditWidget(widget)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                    title="Edit Widget"
                  >
                    <FiEdit3 className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteWidget(widget)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                    title="Delete Widget"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Widget Modal */}
      <N8nChatWidgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveWidget}
        agents={agents}
        customers={customers}
        widget={selectedWidget}
        isLoading={isSubmitting}
      />

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(31, 41, 55, 0.95)',
            color: '#fff',
            border: '1px solid rgba(75, 85, 99, 0.3)',
          },
        }}
      />
    </div>
  );
}
