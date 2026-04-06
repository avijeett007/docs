'use client';

import React, { useState, useRef, useCallback } from 'react';
import { FiX, FiSave, FiBook, FiVideo, FiPaperclip, FiGlobe, FiEye, FiExternalLink, FiDownload, FiMoreVertical, FiSettings } from 'react-icons/fi';
import { WorkflowNode } from '@/types/workflow';
import { Tab } from '@headlessui/react';
import KnovaAgentConfigModal from './KnovaAgentConfigModal';
import { toast } from 'react-hot-toast';

interface NodeConfigPanelProps {
  node: WorkflowNode;
  onNodeUpdate: (updates: Partial<WorkflowNode>) => void;
  onClose: () => void;
}

export default function NodeConfigPanel({ node, onNodeUpdate, onClose }: NodeConfigPanelProps) {
  const [localData, setLocalData] = useState(node.data);
  const [activeTab, setActiveTab] = useState(0);
  const [panelWidth, setPanelWidth] = useState(384); // Default 96 (24rem)
  const [isResizing, setIsResizing] = useState(false);
  const [showKnovaModal, setShowKnovaModal] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { name: 'Configuration', icon: FiSave },
    { name: 'Tutorials', icon: FiVideo },
    { name: 'Documentation', icon: FiBook },
    { name: 'Attachments', icon: FiPaperclip }
  ];

  const handleSave = () => {
    onNodeUpdate({ data: localData });
  };

  const handleNameChange = (newName: string) => {
    setLocalData(prev => ({
      ...prev,
      name: newName
    }));
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = window.innerWidth - e.clientX;
    setPanelWidth(Math.max(300, Math.min(800, newWidth)));
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const handleInputChange = (field: string, value: any) => {
    setLocalData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleConfigChange = (field: string, value: any) => {
    setLocalData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value
      }
    }));
  };

  const renderConfigurationTab = () => {
    switch (node.type) {
      case 'knova-agent':
        return (
          <div className="space-y-4">
            {/* Show configured agent information if available */}
            {localData.config.agentName ? (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <h4 className="text-green-400 font-medium mb-2 flex items-center gap-2">
                    ✅ Agent Configured
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Agent Name:</span>
                      <span className="text-white">{localData.config.agentName}</span>
                    </div>
                    {localData.config.communicationChannel && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Channel:</span>
                        <span className="text-white capitalize">{localData.config.communicationChannel}</span>
                      </div>
                    )}
                    {localData.config.agentType && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Type:</span>
                        <span className="text-white capitalize">{localData.config.agentType}</span>
                      </div>
                    )}
                    {localData.config.voice && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Voice:</span>
                        <span className="text-white capitalize">{localData.config.voice}</span>
                      </div>
                    )}
                    {localData.config.phoneNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Phone:</span>
                        <span className="text-white">{localData.config.phoneNumber}</span>
                      </div>
                    )}
                    {localData.config.businessInfo?.name && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Business:</span>
                        <span className="text-white">{localData.config.businessInfo.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick edit options */}
                <div className="space-y-3">
                  <h5 className="text-sm font-medium text-gray-300">Quick Edit</h5>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Agent Name</label>
                    <input
                      type="text"
                      value={localData.config.agentName || ''}
                      onChange={(e) => handleConfigChange('agentName', e.target.value)}
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {localData.config.businessInfo?.name && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Business Name</label>
                      <input
                        type="text"
                        value={localData.config.businessInfo.name || ''}
                        onChange={(e) => handleConfigChange('businessInfo', {
                          ...localData.config.businessInfo,
                          name: e.target.value
                        })}
                        className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Instructions</label>
                    <textarea
                      value={localData.config.instructions || ''}
                      onChange={(e) => handleConfigChange('instructions', e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Special instructions..."
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                  🤖
                </div>
                <h4 className="text-gray-300 font-medium mb-2">Agent Not Configured</h4>
                <p className="text-gray-500 text-sm mb-4">
                  Use the "Configure Agent" button above to set up this AI agent with all necessary settings.
                </p>
                <div className="text-xs text-gray-600">
                  Configuration includes: Agent type, voice, phone, business info, knowledge base, and integrations.
                </div>
              </div>
            )}
          </div>
        );

      case 'facebook':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                App ID
              </label>
              <input
                type="text"
                value={localData.config.appId || ''}
                onChange={(e) => handleConfigChange('appId', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter Facebook App ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Page ID
              </label>
              <input
                type="text"
                value={localData.config.pageId || ''}
                onChange={(e) => handleConfigChange('pageId', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter Facebook Page ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Lead Form Fields
              </label>
              <textarea
                value={localData.config.leadFields?.join('\n') || ''}
                onChange={(e) => handleConfigChange('leadFields', e.target.value.split('\n').filter(Boolean))}
                rows={4}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter field names (one per line)&#10;name&#10;email&#10;phone&#10;company"
              />
            </div>
          </div>
        );

      case 'webhook-trigger':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Webhook URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localData.config.webhookUrl || 'https://api.knotie-ai.pro/webhooks/workflow/123'}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none"
                />
                <button className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors">
                  Copy
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                HTTP Method
              </label>
              <select
                value={localData.config.method || 'POST'}
                onChange={(e) => handleConfigChange('method', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Configuration
              </label>
              <textarea
                value={JSON.stringify(localData.config, null, 2)}
                onChange={(e) => {
                  try {
                    const config = JSON.parse(e.target.value);
                    setLocalData(prev => ({ ...prev, config }));
                  } catch (error) {
                    // Invalid JSON, don't update
                  }
                }}
                rows={8}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                placeholder="Enter JSON configuration"
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className="bg-gray-800 border-l border-gray-700 flex flex-col h-full relative"
      style={{ width: panelWidth }}
    >
      {/* Resize Handle */}
      <div
        ref={resizeRef}
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 w-1 h-full cursor-col-resize bg-gray-600 hover:bg-blue-500 transition-colors z-10"
        style={{ marginLeft: '-2px' }}
      />
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{localData.name}</h2>
          <p className="text-sm text-gray-400">{node.type}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <FiX className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Basic Info */}
      <div className="p-4 border-b border-gray-700 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Name
          </label>
          <input
            type="text"
            value={localData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Mandatory Knova Agent Configuration */}
        {node.type === 'knova-agent' && (
          <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-red-400 flex items-center gap-2">
                  🤖 Agent Configuration
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">REQUIRED</span>
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  Configure agent type, voice, phone, products/services, knowledge base, and integrations
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">7 Tabs</span>
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Voice AI</span>
                  <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">Products</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowKnovaModal(true);
                  toast.success('🚀 Opening agent configuration!');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 rounded-lg text-white text-sm transition-all transform hover:scale-105 shadow-lg"
              >
                <FiSettings className="w-4 h-4" />
                Configure Agent
              </button>
            </div>
            <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
              <p className="text-xs text-amber-400">
                ⚠️ This configuration is mandatory for the agent to function properly. Please complete all required fields.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={localData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPublic"
            checked={localData.isPublic || false}
            onChange={(e) => handleInputChange('isPublic', e.target.checked)}
            className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="isPublic" className="text-sm text-gray-300 flex items-center gap-1">
            <FiGlobe className="w-4 h-4" />
            Share as public template
          </label>
        </div>
      </div>

      {/* Tabs */}
      <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
        <Tab.List className="flex border-b border-gray-700">
          {tabs.map((tab, index) => {
            const IconComponent = tab.icon;
            return (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  `flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
                    selected
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-gray-300'
                  }`
                }
              >
                <IconComponent className="w-3 h-3" />
                {tab.name}
              </Tab>
            );
          })}
        </Tab.List>

        <Tab.Panels className="flex-1 overflow-y-auto">
          <Tab.Panel className="p-4">
            {renderConfigurationTab()}
          </Tab.Panel>

          <Tab.Panel className="p-4">
            <TutorialsTab
              tutorials={localData.tutorials || []}
              onTutorialsChange={(tutorials) => handleInputChange('tutorials', tutorials)}
            />
          </Tab.Panel>

          <Tab.Panel className="p-4">
            <DocumentationTab
              documentation={localData.documentation || []}
              onDocumentationChange={(docs) => handleInputChange('documentation', docs)}
            />
          </Tab.Panel>

          <Tab.Panel className="p-4">
            <AttachmentsTab
              attachments={localData.attachments || []}
              onAttachmentsChange={(attachments) => handleInputChange('attachments', attachments)}
            />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
        >
          <FiSave className="w-4 h-4" />
          Save Changes
        </button>
      </div>

      {/* Knova Agent Configuration Modal */}
      {node.type === 'knova-agent' && (
        <KnovaAgentConfigModal
          isOpen={showKnovaModal}
          onClose={() => setShowKnovaModal(false)}
          onSave={(config) => {
            setLocalData(prev => ({
              ...prev,
              config
            }));
            setShowKnovaModal(false);
          }}
          initialConfig={localData.config as any}
        />
      )}
    </div>
  );
}

// Tutorials Tab Component
function TutorialsTab({ tutorials, onTutorialsChange }: {
  tutorials: any[];
  onTutorialsChange: (tutorials: any[]) => void;
}) {
  const [newTutorial, setNewTutorial] = useState({
    title: '',
    description: '',
    type: 'video' as 'video' | 'text' | 'interactive',
    url: '',
    content: '',
    duration: 0
  });

  const addTutorial = () => {
    if (newTutorial.title.trim()) {
      const tutorial = {
        id: `tutorial_${Date.now()}`,
        ...newTutorial
      };
      onTutorialsChange([...tutorials, tutorial]);
      setNewTutorial({
        title: '',
        description: '',
        type: 'video',
        url: '',
        content: '',
        duration: 0
      });
    }
  };

  const removeTutorial = (id: string) => {
    onTutorialsChange(tutorials.filter(t => t.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-700 pb-4">
        <h3 className="text-sm font-medium text-white mb-3">Add Tutorial</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Tutorial title"
            value={newTutorial.title}
            onChange={(e) => setNewTutorial(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
          <textarea
            placeholder="Tutorial description"
            value={newTutorial.description}
            onChange={(e) => setNewTutorial(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <select
              value={newTutorial.type}
              onChange={(e) => setNewTutorial(prev => ({ ...prev, type: e.target.value as any }))}
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="video">Video</option>
              <option value="text">Text</option>
              <option value="interactive">Interactive</option>
            </select>
            <input
              type="number"
              placeholder="Duration (min)"
              value={newTutorial.duration}
              onChange={(e) => setNewTutorial(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
              className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <input
            type="url"
            placeholder="Tutorial URL"
            value={newTutorial.url}
            onChange={(e) => setNewTutorial(prev => ({ ...prev, url: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={addTutorial}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
          >
            Add Tutorial
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {tutorials.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            <FiVideo className="w-6 h-6 mx-auto mb-2" />
            <p>No tutorials added yet</p>
          </div>
        ) : (
          tutorials.map((tutorial) => (
            <div key={tutorial.id} className="bg-gray-700 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-sm font-medium text-white">{tutorial.title}</h4>
                <button
                  onClick={() => removeTutorial(tutorial.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-2">{tutorial.description}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="px-2 py-1 bg-gray-600 rounded">{tutorial.type}</span>
                {tutorial.duration > 0 && <span>{tutorial.duration} min</span>}
                {tutorial.url && (
                  <a href={tutorial.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                    <FiExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Documentation Tab Component
function DocumentationTab({ documentation, onDocumentationChange }: {
  documentation: any[];
  onDocumentationChange: (docs: any[]) => void;
}) {
  const [newDoc, setNewDoc] = useState({
    title: '',
    content: '',
    type: 'markdown' as 'markdown' | 'html' | 'pdf',
    url: ''
  });

  const addDocumentation = () => {
    if (newDoc.title.trim()) {
      const doc = {
        id: `doc_${Date.now()}`,
        ...newDoc
      };
      onDocumentationChange([...documentation, doc]);
      setNewDoc({
        title: '',
        content: '',
        type: 'markdown',
        url: ''
      });
    }
  };

  const removeDocumentation = (id: string) => {
    onDocumentationChange(documentation.filter(d => d.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-700 pb-4">
        <h3 className="text-sm font-medium text-white mb-3">Add Documentation</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Document title"
            value={newDoc.title}
            onChange={(e) => setNewDoc(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
          <select
            value={newDoc.type}
            onChange={(e) => setNewDoc(prev => ({ ...prev, type: e.target.value as any }))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
            <option value="pdf">PDF</option>
          </select>
          <input
            type="url"
            placeholder="Document URL (optional)"
            value={newDoc.url}
            onChange={(e) => setNewDoc(prev => ({ ...prev, url: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
          <textarea
            placeholder="Document content"
            value={newDoc.content}
            onChange={(e) => setNewDoc(prev => ({ ...prev, content: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={addDocumentation}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
          >
            Add Documentation
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {documentation.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            <FiBook className="w-6 h-6 mx-auto mb-2" />
            <p>No documentation added yet</p>
          </div>
        ) : (
          documentation.map((doc) => (
            <div key={doc.id} className="bg-gray-700 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-sm font-medium text-white">{doc.title}</h4>
                <button
                  onClick={() => removeDocumentation(doc.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <span className="px-2 py-1 bg-gray-600 rounded">{doc.type}</span>
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                    <FiExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              {doc.content && (
                <p className="text-xs text-gray-400 line-clamp-3">{doc.content}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Attachments Tab Component
function AttachmentsTab({ attachments, onAttachmentsChange }: {
  attachments: any[];
  onAttachmentsChange: (attachments: any[]) => void;
}) {
  const [newAttachment, setNewAttachment] = useState({
    name: '',
    type: '',
    url: '',
    description: ''
  });

  const addAttachment = () => {
    if (newAttachment.name.trim() && newAttachment.url.trim()) {
      const attachment = {
        id: `attachment_${Date.now()}`,
        size: 0, // Would be calculated from actual file
        ...newAttachment
      };
      onAttachmentsChange([...attachments, attachment]);
      setNewAttachment({
        name: '',
        type: '',
        url: '',
        description: ''
      });
    }
  };

  const removeAttachment = (id: string) => {
    onAttachmentsChange(attachments.filter(a => a.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-700 pb-4">
        <h3 className="text-sm font-medium text-white mb-3">Add Attachment</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="File name"
            value={newAttachment.name}
            onChange={(e) => setNewAttachment(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            placeholder="File type (e.g., pdf, docx, xlsx)"
            value={newAttachment.type}
            onChange={(e) => setNewAttachment(prev => ({ ...prev, type: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
          <input
            type="url"
            placeholder="File URL"
            value={newAttachment.url}
            onChange={(e) => setNewAttachment(prev => ({ ...prev, url: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
          <textarea
            placeholder="Description (optional)"
            value={newAttachment.description}
            onChange={(e) => setNewAttachment(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={addAttachment}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
          >
            Add Attachment
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {attachments.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            <FiPaperclip className="w-6 h-6 mx-auto mb-2" />
            <p>No attachments added yet</p>
          </div>
        ) : (
          attachments.map((attachment) => (
            <div key={attachment.id} className="bg-gray-700 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <FiPaperclip className="w-4 h-4 text-gray-400" />
                  <h4 className="text-sm font-medium text-white">{attachment.name}</h4>
                </div>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <span className="px-2 py-1 bg-gray-600 rounded">{attachment.type}</span>
                <span>{formatFileSize(attachment.size)}</span>
                <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                  <FiDownload className="w-3 h-3" />
                </a>
              </div>
              {attachment.description && (
                <p className="text-xs text-gray-400">{attachment.description}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
