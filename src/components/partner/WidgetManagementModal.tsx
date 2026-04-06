'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiPlus, FiEye, FiCopy, FiTrash2, FiEdit2, FiBarChart, FiGlobe, FiPlay } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { Menu } from '@headlessui/react';
import { FiMoreVertical } from 'react-icons/fi';
import clsx from 'clsx';
import WidgetTestModal from './WidgetTestModal';
import WidgetCreationModal from './WidgetCreationModal';

interface Widget {
  id: string;
  name: string;
  widgetType: string;
  agentType: string;
  isActive: boolean;
  totalViews: number;
  totalInteractions: number;
  allowedDomains: string[];
  widgetToken: string;
  createdAt: string;
  lastUsedAt?: string;
}

interface WidgetManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  agentType: string;
  onCreateWidget: () => void;
  onEditWidget?: (widgetId: string) => void;
}

const WidgetManagementModal: React.FC<WidgetManagementModalProps> = ({
  isOpen,
  onClose,
  agentId,
  agentName,
  agentType,
  onCreateWidget,
  onEditWidget
}) => {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testModalState, setTestModalState] = useState<{
    isOpen: boolean;
    widgetId?: string;
    widgetName?: string;
    widgetConfig?: any;
  }>({
    isOpen: false
  });
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
  const [showEmbedCode, setShowEmbedCode] = useState(false);
  const [editModalState, setEditModalState] = useState<{
    isOpen: boolean;
    widgetId?: string;
  }>({
    isOpen: false
  });

  useEffect(() => {
    if (isOpen) {
      fetchWidgets();
    }
  }, [isOpen, agentId]);

  const fetchWidgets = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/agents/${agentId}/widgets`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWidgets(data.widgets || []);
      } else {
        throw new Error('Failed to fetch widgets');
      }
    } catch (error) {
      toast.error('Failed to load widgets');
      console.error('Error fetching widgets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWidget = async (widgetId: string) => {
    if (!confirm('Are you sure you want to delete this widget? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/widgets/${widgetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('Widget deleted successfully');
        fetchWidgets();
      } else {
        throw new Error('Failed to delete widget');
      }
    } catch (error) {
      toast.error('Failed to delete widget');
      console.error('Error deleting widget:', error);
    }
  };

  const handleToggleWidget = async (widgetId: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/widgets/${widgetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        toast.success(`Widget ${!isActive ? 'activated' : 'deactivated'} successfully`);
        fetchWidgets();
      } else {
        throw new Error('Failed to update widget');
      }
    } catch (error) {
      toast.error('Failed to update widget');
      console.error('Error updating widget:', error);
    }
  };

  const handleTestWidget = async (widgetId: string, widgetName: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      // Get widget configuration for testing
      const response = await fetch(`/api/partner/widgets/${widgetId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          toast.error('Authentication failed. Please log in again.');
          return;
        }

        throw new Error(errorData.message || 'Failed to get widget test configuration');
      }

      const testData = await response.json();

      // Open test modal with widget configuration
      setTestModalState({
        isOpen: true,
        widgetId,
        widgetName,
        widgetConfig: testData.config
      });

      toast.success('Widget test configuration ready!');
    } catch (error) {
      console.error('Error preparing widget test:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to prepare widget test');
    }
  };

  const copyEmbedCode = (widget: Widget) => {
    const embedCode = `<script src="${window.location.origin}/api/public/widget-loader.js"></script>
<div id="knotie-widget" data-token="${widget.widgetToken}"></div>`;
    
    navigator.clipboard.writeText(embedCode);
    toast.success('Embed code copied to clipboard!');
  };

  const getWidgetTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      siri: 'Siri Style',
      orb: '3D Orb',
      floaty: 'Floating Button',
      minimal: 'Minimal'
    };
    return types[type] || type;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <Dialog.Title className="text-xl font-semibold text-white">
                Widget Management
              </Dialog.Title>
              <p className="text-sm text-gray-400 mt-1">
                Agent: {agentName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="p-6">
            {/* Header with Create Button */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-medium text-white">Widgets</h3>
                <p className="text-sm text-gray-400">
                  Manage embeddable widgets for this agent
                </p>
              </div>
              <button
                onClick={onCreateWidget}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <FiPlus className="w-4 h-4" />
                Create Widget
              </button>
            </div>

            {/* Widgets List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : widgets.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiGlobe className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No widgets yet</h3>
                <p className="text-gray-400 mb-4">
                  Create your first embeddable widget to get started
                </p>
                <button
                  onClick={onCreateWidget}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Create Widget
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {widgets.map((widget) => (
                  <div
                    key={widget.id}
                    className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-white font-medium">{widget.name}</h4>
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300">
                            {getWidgetTypeLabel(widget.widgetType)}
                          </span>
                          <div className={clsx(
                            'text-xs px-2 py-1 rounded-full',
                            widget.isActive 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          )}>
                            {widget.isActive ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6 text-sm text-gray-400">
                          <div className="flex items-center gap-1">
                            <FiEye className="w-4 h-4" />
                            {widget.totalViews.toLocaleString()} views
                          </div>
                          <div className="flex items-center gap-1">
                            <FiBarChart className="w-4 h-4" />
                            {widget.totalInteractions.toLocaleString()} interactions
                          </div>
                          <div>
                            Created {formatDate(widget.createdAt)}
                          </div>
                          {widget.lastUsedAt && (
                            <div>
                              Last used {formatDate(widget.lastUsedAt)}
                            </div>
                          )}
                        </div>

                        {widget.allowedDomains.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-400 mb-1">Allowed domains:</div>
                            <div className="flex flex-wrap gap-1">
                              {widget.allowedDomains.slice(0, 3).map((domain, index) => (
                                <span
                                  key={index}
                                  className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded"
                                >
                                  {domain}
                                </span>
                              ))}
                              {widget.allowedDomains.length > 3 && (
                                <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">
                                  +{widget.allowedDomains.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyEmbedCode(widget)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          title="Copy embed code"
                        >
                          <FiCopy className="w-4 h-4" />
                        </button>

                        <Menu as="div" className="relative">
                          <Menu.Button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                            <FiMoreVertical className="w-4 h-4" />
                          </Menu.Button>
                          <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-gray-900 border border-gray-700 rounded-lg shadow-xl ring-1 ring-white ring-opacity-10 focus:outline-none z-50">
                            <div className="p-1">
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={() => handleTestWidget(widget.id, widget.name)}
                                    className={clsx(
                                      'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md text-gray-200 hover:text-white transition-colors',
                                      active ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
                                    )}
                                  >
                                    <FiPlay className="w-4 h-4" />
                                    <span>Test Widget</span>
                                  </button>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={() => setEditModalState({ isOpen: true, widgetId: widget.id })}
                                    className={clsx(
                                      'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md text-gray-200 hover:text-white transition-colors',
                                      active ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
                                    )}
                                  >
                                    <FiEdit2 className="w-4 h-4" />
                                    <span>Edit Widget</span>
                                  </button>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={() => handleToggleWidget(widget.id, widget.isActive)}
                                    className={clsx(
                                      'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md text-gray-200 hover:text-white transition-colors',
                                      active ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
                                    )}
                                  >
                                    <FiEye className="w-4 h-4" />
                                    <span>{widget.isActive ? 'Deactivate' : 'Activate'}</span>
                                  </button>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={() => copyEmbedCode(widget)}
                                    className={clsx(
                                      'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md text-gray-200 hover:text-white transition-colors',
                                      active ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
                                    )}
                                  >
                                    <FiCopy className="w-4 h-4" />
                                    <span>Copy Embed Code</span>
                                  </button>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={() => handleDeleteWidget(widget.id)}
                                    className={clsx(
                                      'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md text-red-400 hover:text-red-300 transition-colors',
                                      active ? 'bg-red-600 text-white' : 'hover:bg-red-600/20'
                                    )}
                                  >
                                    <FiTrash2 className="w-4 h-4" />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </Menu.Item>
                            </div>
                          </Menu.Items>
                        </Menu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Dialog.Panel>
      </div>

      {/* Widget Test Modal */}
      {testModalState.isOpen && testModalState.widgetConfig && (
        <WidgetTestModal
          isOpen={testModalState.isOpen}
          onClose={() => setTestModalState({ isOpen: false })}
          widgetId={testModalState.widgetId || ''}
          widgetName={testModalState.widgetName || 'Widget'}
          widgetConfig={testModalState.widgetConfig}
        />
      )}

      {/* Widget Edit Modal */}
      {editModalState.isOpen && (
        <WidgetCreationModal
          isOpen={editModalState.isOpen}
          onClose={() => setEditModalState({ isOpen: false })}
          agentId={agentId}
          agentType={agentType as any}
          agentName={agentName}
          editMode={true}
          widgetId={editModalState.widgetId}
          onWidgetUpdated={() => {
            setEditModalState({ isOpen: false });
            fetchWidgets(); // Refresh the widget list
          }}
        />
      )}
    </Dialog>
  );
};

export default WidgetManagementModal;
