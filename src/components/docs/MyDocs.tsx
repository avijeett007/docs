'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiUpload, FiLink, FiPlus, FiRefreshCw, FiEdit2, FiTrash2, FiHelpCircle } from 'react-icons/fi';
import { useUser } from '@clerk/nextjs';
import KnowledgeBaseModal from './KnowledgeBaseModal';
import KnowledgeBaseSelector from './KnowledgeBaseSelector';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { toast } from 'react-hot-toast';
import Tooltip from '@/components/ui/Tooltip';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  version: string;
  autoEmbed: boolean;
  isEmbed: string | null;
  reEmbed: boolean;
}

interface Document {
  id: string;
  originalName: string;
  version: number;
  size: number;
  mimeType: string;
  hashValue: string | null;
  knowledgeBases: Array<{
    knowledgeBase: KnowledgeBase;
  }>;
}

interface EmbeddingResponse {
  message: string;
  requestId: string;
  cost: number;
}

const EMBEDDING_COST_PER_1K_TOKENS = 0.0004; // $0.0004 per 1K tokens

export default function MyDocs() {
  const { user } = useUser();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [fileLink, setFileLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isKnowledgeBaseModalOpen, setIsKnowledgeBaseModalOpen] = useState(false);
  const [editingKnowledgeBase, setEditingKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [updatingDocument, setUpdatingDocument] = useState<string | null>(null);
  const [processingEmbedding, setProcessingEmbedding] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

  // Load knowledge bases and documents
  useEffect(() => {
    fetchKnowledgeBases();
    fetchDocuments();
  }, []);

  const fetchKnowledgeBases = async () => {
    try {
      const response = await fetch('/api/knowledge-bases');
      if (!response.ok) {
        throw new Error('Failed to fetch knowledge bases');
      }
      const data = await response.json();
      setKnowledgeBases(data.knowledgeBases);
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
      toast.error('Failed to fetch knowledge bases');
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      const data = await response.json();
      setDocuments(data.documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to fetch documents');
    }
  };

  const handleCreateEmbedding = async (knowledgeBaseId: string) => {
    setProcessingEmbedding(knowledgeBaseId);
    try {
      const response = await fetch(`/api/embeddings/${knowledgeBaseId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create embedding');
      }

      const data: EmbeddingResponse = await response.json();
      
      toast.success(
        <div>
          <p>Embedding process initiated!</p>
          <p className="text-sm text-gray-300 mt-1">
            Estimated cost: ${EMBEDDING_COST_PER_1K_TOKENS} per 1K tokens
          </p>
        </div>,
        { duration: 5000 }
      );

      // Update knowledge base in state
      setKnowledgeBases(prevKbs => 
        prevKbs.map(kb => 
          kb.id === knowledgeBaseId 
            ? { ...kb, isEmbed: 'active', reEmbed: false }
            : kb
        )
      );
    } catch (error) {
      console.error('Error creating embedding:', error);
      toast.error('Failed to initiate embedding process');
    } finally {
      setProcessingEmbedding(null);
    }
  };

  const handleAutoEmbedToggle = async (knowledgeBaseId: string, currentValue: boolean) => {
    try {
      const response = await fetch(`/api/knowledge-bases/${knowledgeBaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoEmbed: !currentValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update auto-embed setting');
      }

      setKnowledgeBases(prevKbs => 
        prevKbs.map(kb => 
          kb.id === knowledgeBaseId 
            ? { ...kb, autoEmbed: !currentValue }
            : kb
        )
      );

      toast.success(`Auto-embedding ${!currentValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating auto-embed setting:', error);
      toast.error('Failed to update auto-embed setting');
    }
  };

  const renderKnowledgeBaseTiles = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
      {knowledgeBases.map((kb) => (
        <motion.div
          key={kb.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-lg p-6 shadow-lg"
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-semibold text-white">{kb.name}</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setEditingKnowledgeBase(kb);
                  setIsKnowledgeBaseModalOpen(true);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FiEdit2 size={18} />
              </button>
            </div>
          </div>
          
          <p className="text-gray-400 mb-4">{kb.description}</p>
          
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-300">Auto-Embedding</label>
                <Tooltip 
                  content={`Automatically create embeddings for new documents. Cost: $${EMBEDDING_COST_PER_1K_TOKENS} per 1K tokens`}
                >
                  <FiHelpCircle className="text-gray-400 hover:text-white cursor-help" size={16} />
                </Tooltip>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={kb.autoEmbed}
                  onChange={() => handleAutoEmbedToggle(kb.id, kb.autoEmbed)}
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <button
              onClick={() => handleCreateEmbedding(kb.id)}
              disabled={
                processingEmbedding === kb.id || 
                (!kb.reEmbed && (kb.isEmbed === 'done' || kb.isEmbed === 'active')) ||
                !documents.some(doc => doc.knowledgeBases?.some(kbase => kbase.knowledgeBase.id === kb.id))
              }
              className={`w-full px-4 py-2 ${
                !documents.some(doc => doc.knowledgeBases?.some(kbase => kbase.knowledgeBase.id === kb.id))
                  ? 'bg-gray-600 cursor-not-allowed'
                  : !kb.reEmbed && kb.isEmbed === 'done'
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : kb.reEmbed 
                      ? 'bg-yellow-600 hover:bg-yellow-700' 
                      : 'bg-blue-600 hover:bg-blue-700'
              } text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2`}
            >
              {processingEmbedding === kb.id ? (
                <>
                  <FiRefreshCw className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : !documents.some(doc => doc.knowledgeBases?.some(kbase => kbase.knowledgeBase.id === kb.id)) ? (
                <>
                  <FiUpload />
                  <span>No Documents</span>
                </>
              ) : kb.isEmbed === 'done' && !kb.reEmbed ? (
                <>
                  <FiUpload />
                  <span>Embedding Complete</span>
                </>
              ) : kb.reEmbed ? (
                <>
                  <FiRefreshCw />
                  <span>Update Embedding</span>
                </>
              ) : (
                <>
                  <FiUpload />
                  <span>Create Embedding</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      ))}

      {/* Add New Knowledge Base Tile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => {
          setEditingKnowledgeBase(null);
          setIsKnowledgeBaseModalOpen(true);
        }}
        className="bg-gray-800 rounded-lg p-6 shadow-lg cursor-pointer hover:bg-gray-700 transition-colors flex items-center justify-center min-h-[200px]"
      >
        <div className="text-center">
          <FiPlus size={40} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-400">Add New Knowledge Base</p>
        </div>
      </motion.div>
    </div>
  );

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Send knowledge base IDs as JSON string
        if (selectedKnowledgeBases.length > 0) {
          formData.append('knowledgeBaseIds', JSON.stringify(selectedKnowledgeBases.map(kb => kb.id)));
        }

        const response = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload document');
        }

        const data = await response.json();
        console.log('Upload response:', data); // Add logging
        
        // Update documents state with the new document
        setDocuments(prev => [data.document, ...prev]);
        
        // Refresh knowledge bases to get updated reEmbed status
        await fetchKnowledgeBases();
        
        // Clear selected knowledge bases after successful upload
        setSelectedKnowledgeBases([]);
      }
      toast.success('Documents uploaded successfully');
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload documents');
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = ''; // Reset file input
      }
    }
  };

  const handleDeleteDocument = async (document: Document) => {
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      // Remove document from state
      setDocuments(prev => prev.filter(d => d.id !== document.id));
      
      // Refresh knowledge bases to get updated reEmbed status
      await fetchKnowledgeBases();
      
      toast.success('Document deleted successfully');
      setDeleteModalOpen(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleUpdateDocument = async (documentId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    
    const file = event.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentId', documentId);

    try {
      const response = await fetch('/api/documents', {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to update document');
      }

      const data = await response.json();
      setDocuments(prev => prev.map(doc => 
        doc.id === documentId ? data.document : doc
      ));

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error updating document:', error);
      toast.error('Failed to update document');
    }
  };

  const handleKnowledgeBasesChange = async (document: Document, selectedKnowledgeBases: KnowledgeBase[]) => {
    try {
      setUpdatingDocument(document.id);
      const response = await fetch('/api/documents/metadata', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: document.id,
          knowledgeBases: selectedKnowledgeBases,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update document metadata');
      }

      const updatedDoc = await response.json();
      setDocuments(docs =>
        docs.map(d => (d.id === document.id ? updatedDoc : d))
      );

      // Refresh knowledge bases to get updated reEmbed status
      await fetchKnowledgeBases();
    } catch (error) {
      console.error('Error updating document metadata:', error);
      toast.error('Failed to update document metadata');
    } finally {
      setUpdatingDocument(null);
    }
  };

  const mapDocumentToKnowledgeBase = async (documentId: string, knowledgeBaseIds: string[]) => {
    try {
      if (knowledgeBaseIds.length === 0) {
        alert('Please select at least one knowledge base');
        return;
      }

      // Update document in database
      const response = await fetch('/api/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          knowledgeBaseIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to map document');
      }

      const data = await response.json();
      
      // Update document metadata in R2
      const metadataResponse = await fetch('/api/documents/metadata', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          metadata: {
            knowledgeBaseIds,
            knowledgeBaseNames: knowledgeBaseIds
              .map(id => knowledgeBases.find(kb => kb.id === id)?.name)
              .filter(Boolean)
          }
        }),
      });

      if (!metadataResponse.ok) {
        console.warn('Failed to update document metadata in R2');
      }

      setDocuments(prev => prev.map(doc => 
        doc.id === documentId ? data.document : doc
      ));
      
      // Clear selected knowledge bases after successful mapping
      setSelectedKnowledgeBases([]);
    } catch (error) {
      console.error('Error mapping document:', error);
      toast.error('Failed to map document');
    }
  };

  const handleEditKnowledgeBase = async (knowledgeBase: KnowledgeBase) => {
    setEditingKnowledgeBase(knowledgeBase);
    setIsKnowledgeBaseModalOpen(true);
  };

  const createKnowledgeBase = async (name: string, description: string) => {
    try {
      const response = await fetch('/api/knowledge-bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          autoEmbed: false,
          isEmbed: null,
          reEmbed: false
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create knowledge base');
      }

      const data = await response.json();
      setKnowledgeBases(prev => [...prev, data.knowledgeBase]);
      setIsKnowledgeBaseModalOpen(false);
      toast.success('Knowledge base created successfully');
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      toast.error('Failed to create knowledge base');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gray-800/30 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Upload Documents & Static Knowledgebase</h2>
        
        {/* File Upload Section */}
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <label className="text-sm text-gray-300">Select Knowledge Base(s):</label>
            <div className="flex flex-wrap gap-2">
              {knowledgeBases.map((kb) => (
                <button
                  key={kb.id}
                  onClick={() => setSelectedKnowledgeBases(prev => 
                    prev.includes(kb) 
                      ? prev.filter(k => k.id !== kb.id)
                      : [...prev, kb]
                  )}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedKnowledgeBases.includes(kb)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {kb.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-sm text-gray-300">Upload File:</label>
            <div className="flex space-x-2">
              <label className="flex-1 cursor-pointer">
                <div className="flex items-center justify-center w-full h-12 px-4 transition-colors duration-200 bg-gray-700/50 border border-gray-600 rounded-lg hover:bg-gray-700/70">
                  <FiUpload className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-300">
                    {uploading ? 'Uploading...' : 'Choose files or drag & drop'}
                  </span>
                </div>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.txt,.md,.doc,.docx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Knowledgebases Section */}
      <div className="bg-gray-800/30 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Knowledgebases</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setEditingKnowledgeBase(null);
                setIsKnowledgeBaseModalOpen(true);
              }}
              className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <FiPlus className="w-4 h-4 mr-2" />
              Create New
            </button>
            <button 
              onClick={fetchKnowledgeBases}
              className="flex items-center px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {renderKnowledgeBaseTiles()}
      </div>

      {/* Documents Section */}
      <div className="bg-gray-800/30 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Documents</h3>
        <div className="bg-gray-900/50 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Filename</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Version</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Knowledge Bases</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-800/30">
                  <td className="px-6 py-4 text-sm text-white">{doc.originalName}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">v{doc.version}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{doc.mimeType}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {(doc.size / 1024).toFixed(1)} KB
                  </td>
                  <td className="px-6 py-4">
                    <KnowledgeBaseSelector
                      knowledgeBases={knowledgeBases}
                      selectedKnowledgeBases={(doc.knowledgeBases || []).map(kb => kb.knowledgeBase)}
                      onKnowledgeBasesChange={(selected) => handleKnowledgeBasesChange(doc, selected)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) {
                            handleUpdateDocument(doc.id, e);
                          }
                        }}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        title="Update document"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDocumentToDelete(doc);
                          setDeleteModalOpen(true);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete document"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <KnowledgeBaseModal
        isOpen={isKnowledgeBaseModalOpen}
        onClose={() => {
          setIsKnowledgeBaseModalOpen(false);
          setEditingKnowledgeBase(null);
        }}
        onSubmit={createKnowledgeBase}
        initialData={editingKnowledgeBase}
      />

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDocumentToDelete(null);
        }}
        onConfirm={() => {
          if (documentToDelete) {
            handleDeleteDocument(documentToDelete);
          }
        }}
        itemName={documentToDelete?.originalName || ''}
      />

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFileUpload(e);
          }
        }}
      />
    </div>
  );
}
