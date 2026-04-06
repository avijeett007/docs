'use client';

import React, { useState, useEffect } from 'react';
import { FiSave, FiDownload, FiUpload, FiCopy, FiClock, FiDatabase, FiTrash2, FiRotateCcw } from 'react-icons/fi';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { WorkflowData } from '@/types/workflow';
import { WorkflowDataManager, WorkflowVersion, WorkflowBackup } from '@/lib/workflow/workflowDataManager';
import { toast } from 'react-hot-toast';

interface WorkflowDataPanelProps {
  workflow: WorkflowData;
  isOpen: boolean;
  onClose: () => void;
  onWorkflowUpdate: (workflow: WorkflowData) => void;
}

export default function WorkflowDataPanel({
  workflow,
  isOpen,
  onClose,
  onWorkflowUpdate
}: WorkflowDataPanelProps) {
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [backups, setBackups] = useState<WorkflowBackup[]>([]);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (isOpen && workflow.id) {
      loadData();
    }
  }, [isOpen, workflow.id]);

  const loadData = () => {
    if (!workflow.id) return;
    
    setVersions(WorkflowDataManager.getVersions(workflow.id));
    setBackups(WorkflowDataManager.getBackups(workflow.id));
    setStorageStats(WorkflowDataManager.getStorageStats());
  };

  const handleSave = () => {
    const result = WorkflowDataManager.saveWorkflow(workflow);
    if (result.success) {
      toast.success('Workflow saved successfully');
      loadData();
    } else {
      toast.error(`Save failed: ${result.error}`);
    }
  };

  const handleExport = (includeMetadata: boolean = true) => {
    if (!workflow.id) return;
    
    const exported = WorkflowDataManager.exportWorkflow(workflow.id, includeMetadata);
    if (exported) {
      const blob = new Blob([exported], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflow.name.replace(/\s+/g, '-').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Workflow exported successfully');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          const result = WorkflowDataManager.importWorkflow(content, {
            generateNewIds: true,
            validateBeforeImport: true
          });
          
          if (result.success && result.workflowId) {
            const importedWorkflow = WorkflowDataManager.getWorkflow(result.workflowId);
            if (importedWorkflow) {
              onWorkflowUpdate(importedWorkflow);
              toast.success('Workflow imported successfully');
              loadData();
            }
          } else {
            toast.error(`Import failed: ${result.error}`);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleDuplicate = () => {
    if (!workflow.id) return;
    
    const duplicated = WorkflowDataManager.duplicateWorkflow(workflow.id);
    if (duplicated) {
      onWorkflowUpdate(duplicated);
      toast.success('Workflow duplicated successfully');
      loadData();
    }
  };

  const handleCreateVersion = () => {
    const changelog = prompt('Enter changelog for this version:');
    if (changelog && workflow.id) {
      const version = WorkflowDataManager.createVersion(workflow.id, changelog);
      if (version) {
        toast.success('Version created successfully');
        loadData();
      }
    }
  };

  const handleRestoreVersion = (versionId: string) => {
    if (!workflow.id) return;
    
    if (confirm('Are you sure you want to restore this version? Current changes will be lost.')) {
      const success = WorkflowDataManager.restoreVersion(workflow.id, versionId);
      if (success) {
        const restoredWorkflow = WorkflowDataManager.getWorkflow(workflow.id);
        if (restoredWorkflow) {
          onWorkflowUpdate(restoredWorkflow);
          toast.success('Version restored successfully');
          loadData();
        }
      } else {
        toast.error('Failed to restore version');
      }
    }
  };

  const handleCreateBackup = () => {
    const description = prompt('Enter backup description (optional):');
    const backup = WorkflowDataManager.createManualBackup(workflow, description || undefined);
    toast.success('Backup created successfully');
    loadData();
  };

  const handleRestoreBackup = (backupId: string) => {
    if (!workflow.id) return;
    
    if (confirm('Are you sure you want to restore this backup? Current changes will be lost.')) {
      const success = WorkflowDataManager.restoreBackup(workflow.id, backupId);
      if (success) {
        const restoredWorkflow = WorkflowDataManager.getWorkflow(workflow.id);
        if (restoredWorkflow) {
          onWorkflowUpdate(restoredWorkflow);
          toast.success('Backup restored successfully');
          loadData();
        }
      } else {
        toast.error('Failed to restore backup');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Transition appear show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-gray-900 border border-blue-400/20 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                  <div>
                    <Dialog.Title as="h3" className="text-xl font-medium text-white">
                      Workflow Data Management
                    </Dialog.Title>
                    <p className="text-sm text-gray-400 mt-1">
                      {workflow.name} - Manage versions, backups, and data
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="p-6 border-b border-gray-700">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
                    >
                      <FiSave className="w-4 h-4" />
                      Save Workflow
                    </button>
                    <button
                      onClick={() => handleExport(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors"
                    >
                      <FiDownload className="w-4 h-4" />
                      Export
                    </button>
                    <button
                      onClick={handleImport}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors"
                    >
                      <FiUpload className="w-4 h-4" />
                      Import
                    </button>
                    <button
                      onClick={handleDuplicate}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-white transition-colors"
                    >
                      <FiCopy className="w-4 h-4" />
                      Duplicate
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
                  <Tab.List className="flex border-b border-gray-700">
                    {[
                      { name: 'Versions', icon: FiClock },
                      { name: 'Backups', icon: FiDatabase },
                      { name: 'Storage', icon: FiDatabase }
                    ].map((tab, index) => {
                      const IconComponent = tab.icon;
                      return (
                        <Tab
                          key={tab.name}
                          className={({ selected }) =>
                            `flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                              selected
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-gray-300'
                            }`
                          }
                        >
                          <IconComponent className="w-4 h-4" />
                          {tab.name}
                        </Tab>
                      );
                    })}
                  </Tab.List>

                  <Tab.Panels className="h-96 overflow-y-auto">
                    {/* Versions Tab */}
                    <Tab.Panel className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-medium text-white">Workflow Versions</h4>
                        <button
                          onClick={handleCreateVersion}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-colors"
                        >
                          Create Version
                        </button>
                      </div>

                      <div className="space-y-3">
                        {versions.length === 0 ? (
                          <div className="text-center py-8 text-gray-400">
                            <FiClock className="w-8 h-8 mx-auto mb-2" />
                            <p>No versions created yet</p>
                          </div>
                        ) : (
                          versions.map((version) => (
                            <div key={version.id} className="bg-gray-800 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-lg font-medium text-white">
                                    v{version.version}
                                  </span>
                                  {version.isActive && (
                                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleRestoreVersion(version.id)}
                                  className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm transition-colors"
                                >
                                  <FiRotateCcw className="w-3 h-3" />
                                  Restore
                                </button>
                              </div>
                              <p className="text-sm text-gray-300 mb-2">{version.changelog}</p>
                              <div className="text-xs text-gray-500">
                                Created {formatDate(version.createdAt)} by {version.createdBy}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Tab.Panel>

                    {/* Backups Tab */}
                    <Tab.Panel className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-medium text-white">Workflow Backups</h4>
                        <button
                          onClick={handleCreateBackup}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-colors"
                        >
                          Create Backup
                        </button>
                      </div>

                      <div className="space-y-3">
                        {backups.length === 0 ? (
                          <div className="text-center py-8 text-gray-400">
                            <FiDatabase className="w-8 h-8 mx-auto mb-2" />
                            <p>No backups created yet</p>
                          </div>
                        ) : (
                          backups.map((backup) => (
                            <div key={backup.id} className="bg-gray-800 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    backup.type === 'manual'
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : 'bg-gray-500/20 text-gray-400'
                                  }`}>
                                    {backup.type}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleRestoreBackup(backup.id)}
                                  className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm transition-colors"
                                >
                                  <FiRotateCcw className="w-3 h-3" />
                                  Restore
                                </button>
                              </div>
                              {backup.description && (
                                <p className="text-sm text-gray-300 mb-2">{backup.description}</p>
                              )}
                              <div className="text-xs text-gray-500">
                                Created {formatDate(backup.createdAt)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Tab.Panel>

                    {/* Storage Tab */}
                    <Tab.Panel className="p-6">
                      <h4 className="text-lg font-medium text-white mb-4">Storage Statistics</h4>
                      
                      {storageStats && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="text-2xl font-bold text-white">{storageStats.totalWorkflows}</div>
                            <div className="text-sm text-gray-400">Total Workflows</div>
                          </div>
                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="text-2xl font-bold text-white">{storageStats.totalVersions}</div>
                            <div className="text-sm text-gray-400">Total Versions</div>
                          </div>
                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="text-2xl font-bold text-white">{storageStats.totalBackups}</div>
                            <div className="text-sm text-gray-400">Total Backups</div>
                          </div>
                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="text-2xl font-bold text-white">{formatFileSize(storageStats.storageSize)}</div>
                            <div className="text-sm text-gray-400">Storage Used</div>
                          </div>
                        </div>
                      )}
                    </Tab.Panel>
                  </Tab.Panels>
                </Tab.Group>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
