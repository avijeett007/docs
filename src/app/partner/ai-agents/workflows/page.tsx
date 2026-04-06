'use client';

import React, { useState, useEffect } from 'react';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';
import { useRouter } from 'next/navigation';
import { FiPlus, FiMoreVertical, FiEdit2, FiTrash2, FiSettings, FiPlay, FiPause, FiDownload, FiUpload, FiCopy, FiExternalLink } from 'react-icons/fi';
import clsx from 'clsx';
import NeonContainer from '@/components/NeonContainer';
import PartnerSidebar from '@/components/partner/PartnerSidebar';
import { Menu, Transition, Dialog } from '@headlessui/react';
import { toast, Toaster } from 'react-hot-toast';
import { BrowserStorageManager } from '@/lib/workflow/browserStorage';

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'draft';
  template: string;
  nodeCount: number;
  lastModified: string;
  webhookUrl?: string;
  testWebhookUrl?: string;
  createdAt: string;
}

export default function WorkflowsPage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customers, setCustomers] = useState<any[]>([]);

  // Free Forever Upgrade Modal state
  const [showFreeForeverUpgrade, setShowFreeForeverUpgrade] = useState(false);
  const [freeForeverUpgradeData, setFreeForeverUpgradeData] = useState({
    title: '',
    message: '',
    featureDescription: '',
  });
  const [pendingAction, setPendingAction] = useState<'create' | null>(null);

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

    // Load workflows and customers
    loadWorkflows();
    loadCustomers();
  }, [router]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call when backend is ready
      // For now, load from browser storage or show empty state
      const partnerId = localStorage.getItem('partner_id') || 'demo_partner';
      const storedWorkflows = BrowserStorageManager.getWorkflowsByPartner(partnerId);

      // Convert stored workflows to the expected format
      const formattedWorkflows: Workflow[] = storedWorkflows.map(stored => ({
        id: stored.workflow_uuid,
        name: stored.name || 'Untitled Workflow',
        description: stored.description || 'No description',
        status: 'draft' as const,
        template: 'Custom',
        nodeCount: stored.nodes?.length || 0,
        lastModified: stored.updatedAt || stored.createdAt || new Date().toISOString(),
        createdAt: stored.createdAt || new Date().toISOString()
      }));

      setWorkflows(formattedWorkflows);
    } catch (err) {
      setError('Failed to load workflows');
      console.error('Error loading workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/customers', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data.data || data.customers || []);
      }
    } catch (err) {
      console.error('Error loading customers:', err);
      // Use mock data if API fails
      setCustomers([
        { id: 'customer1', firstName: 'John', lastName: 'Doe', companyName: 'Acme Corp', email: 'john@acme.com' },
        { id: 'customer2', firstName: 'Jane', lastName: 'Smith', companyName: 'TechStart Inc', email: 'jane@techstart.com' }
      ]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  // Proceed with pending action when "Maybe Later" is clicked
  const proceedWithPendingAction = () => {
    if (pendingAction === 'create') {
      setShowCreateModal(true);
    }
    setPendingAction(null);
  };

  const handleCreateWorkflow = async () => {
    try {
      // Check if user is on free forever plan first
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();

      if (shouldShowFreeForeverUpgrade) {
        // Show free forever upgrade modal for premium Workflows
        const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('workflows');
        setFreeForeverUpgradeData(upgradeMessage);
        setPendingAction('create');
        setShowFreeForeverUpgrade(true);
        return;
      }

      // Proceed with workflow creation
      setShowCreateModal(true);
    } catch (error) {
      console.error('Error checking Workflow access:', error);
      // Fallback: allow workflow creation if check fails
      setShowCreateModal(true);
    }
  };

  const handleCreateTemplate = () => {
    setShowTemplateModal(true);
  };

  const handleWorkflowAction = async (action: string, workflowId: string) => {
    const partnerId = localStorage.getItem('partner_id') || 'demo_partner';

    switch (action) {
      case 'edit':
        // Navigate to the V2 designer with the workflow ID
        router.push(`/partner/ai-agents/workflows/v2?workflow=${workflowId}`);
        break;
      case 'duplicate':
        try {
          const originalWorkflow = BrowserStorageManager.getWorkflowByUuid(workflowId, partnerId);
          if (originalWorkflow) {
            const { workflow_uuid, partner_id, customer_id, created_at, updated_at, ...workflowData } = originalWorkflow;
            const duplicatedWorkflow = {
              ...workflowData,
              name: `${originalWorkflow.name} (Copy)`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            BrowserStorageManager.saveWorkflow(duplicatedWorkflow, partnerId, originalWorkflow.customer_id);
            await loadWorkflows(); // Refresh the list
            toast.success('Workflow duplicated successfully');
          } else {
            toast.error('Workflow not found');
          }
        } catch (error) {
          console.error('Error duplicating workflow:', error);
          toast.error('Failed to duplicate workflow');
        }
        break;
      case 'delete':
        if (confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
          try {
            BrowserStorageManager.deleteWorkflow(workflowId, partnerId);
            await loadWorkflows(); // Refresh the list
            toast.success('Workflow deleted successfully');
          } catch (error) {
            console.error('Error deleting workflow:', error);
            toast.error('Failed to delete workflow');
          }
        }
        break;
      case 'toggle':
        try {
          const workflow = workflows.find(w => w.id === workflowId);
          if (workflow) {
            const newStatus = workflow.status === 'active' ? 'inactive' : 'active';
            // Update the workflow status in storage
            const success = BrowserStorageManager.updateWorkflow(workflowId, partnerId, {
              status: newStatus
            });
            if (success) {
              await loadWorkflows(); // Refresh the list
              toast.success(`Workflow ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
            } else {
              toast.error('Workflow not found or access denied');
            }
          }
        } catch (error) {
          console.error('Error toggling workflow status:', error);
          toast.error('Failed to update workflow status');
        }
        break;
      default:
        break;
    }
  };

  const copyWebhookUrl = (url: string, type: 'test' | 'production') => {
    navigator.clipboard.writeText(url);
    toast.success(`${type === 'test' ? 'Test' : 'Production'} webhook URL copied to clipboard`);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400';
      case 'inactive':
        return 'bg-gray-500/20 text-gray-400';
      case 'draft':
        return 'bg-yellow-500/20 text-amber-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      <Toaster position="top-right" />
      <PartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
      
      <main className="flex-1 pl-64 min-h-screen relative">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold">Knotie AI Pro Workflows</h1>
                <p className="mt-2 text-gray-400">Create and manage AI-powered business workflows</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleCreateTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-600"
                >
                  <FiSettings className="w-5 h-5" />
                  <span>Create Template</span>
                  <span className="text-xs bg-yellow-500/20 text-amber-400 px-2 py-1 rounded">Coming Soon</span>
                </button>
                <div className="flex gap-3">


                  <button
                    onClick={handleCreateWorkflow}
                    className="relative flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors overflow-hidden"
                  >
                    <FiPlus className="w-5 h-5" />
                    <span>Create Workflow</span>

                    {/* Preview Badge */}
                    <div className="absolute -top-1 -right-1">
                      <div className="relative">
                        <div className="bg-gradient-to-r from-blue-400 to-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">
                          PREVIEW
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full animate-pulse opacity-75"></div>
                      </div>
                    </div>

                    {/* Sparkle Effect */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1 right-8 w-1 h-1 bg-blue-300 rounded-full animate-ping"></div>
                      <div className="absolute top-3 right-12 w-0.5 h-0.5 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                      <div className="absolute bottom-2 right-10 w-0.5 h-0.5 bg-blue-300 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* New Designer Announcement */}
            <div className="mb-8 bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-500/30 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-2xl">⚡</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-white">🎨 Professional Workflow Designer Preview</h3>
                    <div className="bg-gradient-to-r from-blue-400 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      PREVIEW
                    </div>
                  </div>
                  <p className="text-gray-300 mb-3">
                    Experience our new professional workflow designer with industry-standard node-based interface.
                    Try the design palette and give us feedback while we complete the full functionality.
                  </p>
                  <div className="flex flex-wrap gap-2 text-sm mb-4">
                    <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full">🎨 Design Palette</span>
                    <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full">🎯 Smooth Drag & Drop</span>
                    <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full">💬 Feedback Welcome</span>
                    <span className="bg-yellow-500/20 text-amber-300 px-3 py-1 rounded-full">🚀 Modern Architecture</span>
                  </div>
                  <button
                    onClick={handleCreateWorkflow}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-2 rounded-lg transition-all transform hover:scale-105"
                  >
                    Try Design Palette →
                  </button>
                </div>
              </div>
            </div>

            {/* Upcoming Feature Notice */}
            <div className="mb-8 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <FiSettings className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-white">🚀 Upcoming Feature</h3>
                    <div className="bg-gradient-to-r from-blue-400 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      IN DEVELOPMENT
                    </div>
                  </div>
                  <p className="text-gray-300 mb-3">
                    We're still working on completing the full workflow functionality. You can try out our design palette above to explore the interface and give us your feedback on the user experience.
                  </p>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full">🎨 Design Palette Available</span>
                    <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full">💬 Feedback Welcome</span>
                    <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full">🔧 In Active Development</span>
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
                <p className="text-lg text-red-400">{error}</p>
              </div>
            ) : loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : workflows.length === 0 ? (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 text-center">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiSettings className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No workflows yet</h3>
                  <p className="text-gray-400 mb-6">Create your first AI workflow to automate your business processes</p>
                  <button
                    onClick={handleCreateWorkflow}
                    className="relative inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors overflow-hidden"
                  >
                    <FiPlus className="w-5 h-5" />
                    <span>Create Your First Workflow</span>

                    {/* Alpha Badge */}
                    <div className="absolute -top-1 -right-1">
                      <div className="relative">
                        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">
                          ALPHA
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-pulse opacity-75"></div>
                      </div>
                    </div>

                    {/* Sparkle Effect */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1 right-8 w-1 h-1 bg-yellow-300 rounded-full animate-ping"></div>
                      <div className="absolute top-3 right-12 w-0.5 h-0.5 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                      <div className="absolute bottom-2 right-10 w-0.5 h-0.5 bg-orange-300 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workflows.map((workflow) => (
                  <NeonContainer key={workflow.id} className="p-6 h-[400px] flex flex-col">
                    <div className="flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 mr-4">
                          <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
                            {workflow.name}
                          </h3>
                          <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                            {workflow.description}
                          </p>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={clsx(
                              'px-2 py-1 rounded-full text-xs font-medium',
                              getStatusColor(workflow.status)
                            )}>
                              {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {workflow.nodeCount} nodes
                            </span>
                          </div>
                        </div>
                        
                        <Menu as="div" className="relative">
                          <Menu.Button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                            <FiMoreVertical className="w-5 h-5" />
                          </Menu.Button>
                          <Transition
                            as={React.Fragment}
                            enter="transition ease-out duration-100"
                            enterFrom="transform opacity-0 scale-95"
                            enterTo="transform opacity-100 scale-100"
                            leave="transition ease-in duration-75"
                            leaveFrom="transform opacity-100 scale-100"
                            leaveTo="transform opacity-0 scale-95"
                          >
                            <Menu.Items className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-10">
                              <div className="py-1">
                                <Menu.Item>
                                  {({ active }) => (
                                    <button
                                      onClick={() => handleWorkflowAction('edit', workflow.id)}
                                      className={clsx(
                                        'flex items-center gap-2 w-full px-4 py-2 text-sm text-left',
                                        active ? 'bg-gray-700 text-white' : 'text-gray-300'
                                      )}
                                    >
                                      <FiEdit2 className="w-4 h-4" />
                                      Edit Workflow
                                    </button>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <button
                                      onClick={() => handleWorkflowAction('duplicate', workflow.id)}
                                      className={clsx(
                                        'flex items-center gap-2 w-full px-4 py-2 text-sm text-left',
                                        active ? 'bg-gray-700 text-white' : 'text-gray-300'
                                      )}
                                    >
                                      <FiCopy className="w-4 h-4" />
                                      Duplicate
                                    </button>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <button
                                      onClick={() => handleWorkflowAction('toggle', workflow.id)}
                                      className={clsx(
                                        'flex items-center gap-2 w-full px-4 py-2 text-sm text-left',
                                        active ? 'bg-gray-700 text-white' : 'text-gray-300'
                                      )}
                                    >
                                      {workflow.status === 'active' ? (
                                        <>
                                          <FiPause className="w-4 h-4" />
                                          Deactivate
                                        </>
                                      ) : (
                                        <>
                                          <FiPlay className="w-4 h-4" />
                                          Activate
                                        </>
                                      )}
                                    </button>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <button
                                      onClick={() => handleWorkflowAction('delete', workflow.id)}
                                      className={clsx(
                                        'flex items-center gap-2 w-full px-4 py-2 text-sm text-left',
                                        active ? 'bg-red-600 text-white' : 'text-red-400'
                                      )}
                                    >
                                      <FiTrash2 className="w-4 h-4" />
                                      Delete
                                    </button>
                                  )}
                                </Menu.Item>
                              </div>
                            </Menu.Items>
                          </Transition>
                        </Menu>
                      </div>

                      <div className="mt-auto space-y-3">
                        <div className="text-xs text-gray-500">
                          <div>Template: {workflow.template}</div>
                          <div>Modified: {formatDate(workflow.lastModified)}</div>
                        </div>
                        
                        {workflow.webhookUrl && (
                          <div className="space-y-2">
                            <div className="text-xs text-gray-400">Webhook URLs:</div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => copyWebhookUrl(workflow.testWebhookUrl!, 'test')}
                                className="flex-1 px-2 py-1 bg-yellow-500/10 text-amber-400 rounded text-xs hover:bg-yellow-500/20 transition-colors"
                              >
                                Test
                              </button>
                              <button
                                onClick={() => copyWebhookUrl(workflow.webhookUrl!, 'production')}
                                className="flex-1 px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs hover:bg-green-500/20 transition-colors"
                              >
                                Prod
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </NeonContainer>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Workflow Modal */}
      <Transition appear show={showCreateModal} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowCreateModal(false)}>
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
                <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-gray-900 border border-blue-400/20 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-xl font-medium leading-6 text-white mb-6">
                    Create New Workflow
                  </Dialog.Title>

                  {/* Customer Selection Section */}
                  <div className="mb-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <h4 className="text-lg font-medium text-white mb-3">Select Customer</h4>
                    <p className="text-sm text-gray-400 mb-4">Choose the customer this workflow will be created for</p>
                    <select
                      value={selectedCustomer}
                      onChange={(e) => setSelectedCustomer(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      required
                    >
                      <option value="">Select a customer...</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.companyName || `${customer.firstName} ${customer.lastName}`} ({customer.email})
                        </option>
                      ))}
                    </select>
                    {!selectedCustomer && (
                      <p className="text-sm text-amber-400 mt-2">⚠️ Please select a customer to continue</p>
                    )}
                  </div>

                  {/* Template Selection Section */}
                  <div className={`transition-opacity duration-300 ${!selectedCustomer ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h4 className="text-lg font-medium text-white mb-4">Choose Template</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div
                        onClick={() => {
                          if (!selectedCustomer) return;
                          setShowCreateModal(false);
                          router.push(`/partner/ai-agents/workflows/v2?template=blank&customer=${selectedCustomer}`);
                        }}
                        className={`p-6 bg-gray-800/50 border border-gray-700 rounded-lg transition-all hover:scale-[1.02] ${
                          selectedCustomer ? 'hover:border-blue-500/50 cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      >
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                          <FiPlus className="w-8 h-8 text-gray-400" />
                        </div>
                        <h4 className="text-lg font-medium text-white mb-2">Blank Template</h4>
                        <p className="text-sm text-gray-400">Start from scratch with the new professional workflow designer</p>
                      </div>
                    </div>

                      <div
                        onClick={() => {
                          if (!selectedCustomer) return;
                          setShowCreateModal(false);
                          router.push(`/partner/ai-agents/workflows/new?template=facebook-leadgen-ghl&customer=${selectedCustomer}`);
                        }}
                        className={`p-6 bg-gray-800/50 border border-gray-700 rounded-lg transition-all hover:scale-[1.02] ${
                          selectedCustomer ? 'hover:border-blue-500/50 cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      >
                      <div className="text-center">
                        <div className="w-16 h-16 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                          <span className="text-2xl">📱</span>
                        </div>
                        <h4 className="text-lg font-medium text-white mb-2">Facebook Lead Gen (GHL)</h4>
                        <p className="text-sm text-gray-400">Automated lead generation with Facebook ads, GHL, and AI follow-up</p>
                      </div>
                    </div>

                      <div
                        onClick={() => {
                          if (!selectedCustomer) return;
                          setShowCreateModal(false);
                          router.push(`/partner/ai-agents/workflows/new?template=facebook-leadgen-n8n&customer=${selectedCustomer}`);
                        }}
                        className={`p-6 bg-gray-800/50 border border-gray-700 rounded-lg transition-all hover:scale-[1.02] ${
                          selectedCustomer ? 'hover:border-blue-500/50 cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      >
                      <div className="text-center">
                        <div className="w-16 h-16 bg-orange-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                          <span className="text-2xl">⚡</span>
                        </div>
                        <h4 className="text-lg font-medium text-white mb-2">Facebook Lead Gen (N8N)</h4>
                        <p className="text-sm text-gray-400">Automated lead generation with Facebook ads, N8N, and AI follow-up</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Create Template Modal */}
      <Transition appear show={showTemplateModal} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowTemplateModal(false)}>
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
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-white mb-4">
                    Create Workflow Template
                  </Dialog.Title>

                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                    <h4 className="text-amber-400 font-medium mb-2">Coming Soon!</h4>
                    <p className="text-sm text-gray-300">
                      Template creation functionality will be available soon. You'll be able to create reusable workflow templates that can be shared with other users.
                    </p>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      onClick={() => setShowTemplateModal(false)}
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

      {/* Free Forever Upgrade Modal */}
      <FreeForeverUpgradeModal
        isOpen={showFreeForeverUpgrade}
        onClose={() => setShowFreeForeverUpgrade(false)}
        onProceed={pendingAction ? proceedWithPendingAction : undefined}
        title={freeForeverUpgradeData.title}
        message={freeForeverUpgradeData.message}
        featureDescription={freeForeverUpgradeData.featureDescription}
      />
    </div>
  );
}
