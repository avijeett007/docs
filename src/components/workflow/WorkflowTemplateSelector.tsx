'use client';

import React, { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiPlus, FiDownload, FiUpload, FiEye, FiCopy } from 'react-icons/fi';
import { Dialog, Transition } from '@headlessui/react';
import { WorkflowTemplate } from '@/types/workflow';
import { WorkflowTemplateManager } from '@/lib/workflow/workflowTemplates';

interface WorkflowTemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateId: string) => void;
  onCreateBlank: () => void;
}

export default function WorkflowTemplateSelector({
  isOpen,
  onClose,
  onSelectTemplate,
  onCreateBlank
}: WorkflowTemplateSelectorProps) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<WorkflowTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState<WorkflowTemplate | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchTerm, selectedCategory]);

  const loadTemplates = () => {
    const allTemplates = WorkflowTemplateManager.getPublicTemplates();
    setTemplates(allTemplates);
    
    const allCategories = WorkflowTemplateManager.getCategories();
    setCategories(allCategories);
  };

  const filterTemplates = () => {
    let filtered = templates;

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = WorkflowTemplateManager.searchTemplates(searchTerm);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    setFilteredTemplates(filtered);
  };

  const handleTemplateSelect = (templateId: string) => {
    onSelectTemplate(templateId);
    onClose();
  };

  const handlePreview = (template: WorkflowTemplate) => {
    setPreviewTemplate(template);
  };

  const handleExportTemplate = (template: WorkflowTemplate) => {
    const exported = WorkflowTemplateManager.exportTemplate(template.id);
    if (exported) {
      const blob = new Blob([exported], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.name.replace(/\s+/g, '-').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleImportTemplate = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          const result = WorkflowTemplateManager.importTemplate(content);
          if (result.success) {
            loadTemplates(); // Refresh templates
            alert('Template imported successfully!');
          } else {
            alert(`Import failed: ${result.error}`);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <>
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
                <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-gray-900 border border-blue-400/20 shadow-xl transition-all">
                  {/* Header */}
                  <div className="flex items-center justify-between p-6 border-b border-gray-700">
                    <div>
                      <Dialog.Title as="h3" className="text-xl font-medium text-white">
                        Choose Workflow Template
                      </Dialog.Title>
                      <p className="text-sm text-gray-400 mt-1">
                        Start with a pre-built template or create from scratch
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleImportTemplate}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors"
                      >
                        <FiUpload className="w-4 h-4" />
                        Import
                      </button>
                      <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Search and Filters */}
                  <div className="p-6 border-b border-gray-700">
                    <div className="flex gap-4 mb-4">
                      <div className="flex-1 relative">
                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          placeholder="Search templates..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="all">All Categories</option>
                        {categories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Templates Grid */}
                  <div className="p-6 max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Blank Template */}
                      <div
                        onClick={onCreateBlank}
                        className="p-6 bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 cursor-pointer transition-all hover:scale-[1.02] group"
                      >
                        <div className="text-center">
                          <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-500/20 transition-colors">
                            <FiPlus className="w-8 h-8 text-gray-400 group-hover:text-blue-400" />
                          </div>
                          <h3 className="text-lg font-medium text-white mb-2">Blank Template</h3>
                          <p className="text-sm text-gray-400">Start from scratch with an empty workflow canvas</p>
                        </div>
                      </div>

                      {/* Template Cards */}
                      {filteredTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="bg-gray-800 rounded-lg overflow-hidden hover:shadow-lg transition-all hover:scale-[1.02] group"
                        >
                          {/* Template Thumbnail */}
                          <div className="h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                            <div className="text-4xl">
                              {template.category === 'Lead Generation' ? '📱' : 
                               template.category === 'Customer Support' ? '🎧' : '⚙️'}
                            </div>
                          </div>

                          {/* Template Info */}
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-sm font-medium text-white line-clamp-2">
                                {template.name}
                              </h3>
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                {template.category}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 line-clamp-2 mb-3">
                              {template.description}
                            </p>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1 mb-3">
                              {template.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                                  {tag}
                                </span>
                              ))}
                              {template.tags.length > 3 && (
                                <span className="text-xs text-gray-500">+{template.tags.length - 3}</span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleTemplateSelect(template.id)}
                                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs transition-colors"
                              >
                                Use Template
                              </button>
                              <button
                                onClick={() => handlePreview(template)}
                                className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
                              >
                                <FiEye className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleExportTemplate(template)}
                                className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
                              >
                                <FiDownload className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {filteredTemplates.length === 0 && (
                      <div className="text-center py-12">
                        <div className="text-gray-400 mb-2">No templates found</div>
                        <div className="text-sm text-gray-500">
                          Try adjusting your search or category filter
                        </div>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Template Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          isOpen={!!previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUseTemplate={() => {
            handleTemplateSelect(previewTemplate.id);
            setPreviewTemplate(null);
          }}
        />
      )}
    </>
  );
}

// Template Preview Modal Component
function TemplatePreviewModal({
  template,
  isOpen,
  onClose,
  onUseTemplate
}: {
  template: WorkflowTemplate;
  isOpen: boolean;
  onClose: () => void;
  onUseTemplate: () => void;
}) {
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
                <div className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-medium text-white">{template.name}</h3>
                      <p className="text-gray-400 mt-1">{template.description}</p>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Workflow Steps:</h4>
                      <div className="space-y-2">
                        {template.nodes.map((node, index) => (
                          <div key={node.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                              {index + 1}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{node.data.name}</div>
                              <div className="text-xs text-gray-400">{node.data.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Tags:</h4>
                      <div className="flex flex-wrap gap-2">
                        {template.tags.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onUseTemplate}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
                    >
                      <FiCopy className="w-4 h-4" />
                      Use This Template
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
