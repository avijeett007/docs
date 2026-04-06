'use client';

import React, { useState, useEffect } from 'react';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';
import {
  FiFileText, FiUpload, FiPlus, FiSearch, FiFolder,
  FiFile, FiTrash2, FiEdit, FiLoader, FiAlertCircle,
  FiArrowLeft, FiDatabase, FiEye, FiGlobe
} from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';
import { useWhitelabelAuth } from '@/hooks/useWhitelabelAuth';
import NewKnowledgeBaseModal from '@/components/whitelabel/knowledge-base/NewKnowledgeBaseModal';
import NewFolderModal from '@/components/whitelabel/knowledge-base/NewFolderModal';
import FileUploadModal from '@/components/whitelabel/knowledge-base/FileUploadModal';
import WebsiteUrlModal from '@/components/whitelabel/WebsiteUrlModal';
import WebsiteUrlsList from '@/components/whitelabel/WebsiteUrlsList';
import KBProcessingStatus from '@/components/whitelabel/KBProcessingStatus';
import SizeDisplay, { FileSizeSummary } from '@/components/whitelabel/knowledge-base/SizeDisplay';
import { formatFileSize, formatDate } from '@/lib/utils';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    folders: number;
    files: number;
  };
  totalSize?: number; // Total size in bytes
}

interface Folder {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    files?: number;
    childFolders?: number;
  };
}

interface File {
  id: string;
  name: string;
  description: string | null;
  fileType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}

export default function KnowledgeBasePage() {
  const { branding } = usePartnerBranding();
  const primaryColor = branding.primaryColor || '#14B8A6';
  const { customerId, partnerId, isLoading: authLoading } = useWhitelabelAuth();



  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Array<{ id: string | null, name: string }>>([
    { id: null, name: 'Root' }
  ]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isNewKnowledgeBaseModalOpen, setIsNewKnowledgeBaseModalOpen] = useState(false);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [isWebsiteUrlModalOpen, setIsWebsiteUrlModalOpen] = useState(false);

  // Website URLs state
  const [websiteUrls, setWebsiteUrls] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'files' | 'websites'>('files');

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [languageLoaded, setLanguageLoaded] = useState(false);

  // Helper function for translations
  const getTranslation = (path: string, fallback?: string) => {
    if (!languageData) return fallback || path;
    return getTranslatedText(
      languageData,
      path,
      fallback,
      branding?.businessName,
      branding?.translatedTexts,
      selectedLanguage
    );
  };

  // Load language data
  useEffect(() => {
    const loadLanguageData = async () => {
      if (!branding || languageLoaded) return;
      try {
        const { languageData: data, selectedLanguage: lang } = await loadLanguageDataWithLocale(
          branding.basicPortalLanguage
        );
        setLanguageData(data);
        setSelectedLanguage(lang);
        setLanguageLoaded(true);
      } catch (error) {
        console.error('Failed to load language:', error);
      }
    };
    loadLanguageData();
  }, [branding, languageLoaded]);

  // Fetch knowledge bases on component mount
  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  // Fetch folders and files when a knowledge base is selected
  useEffect(() => {
    if (selectedKnowledgeBase) {
      fetchFoldersAndFiles();
      fetchWebsiteUrls();

      // Reset folder path when knowledge base changes
      if (currentFolderId === null) {
        setFolderPath([{ id: null, name: 'Root' }]);
      }
    }
  }, [selectedKnowledgeBase, currentFolderId]);

  // Function to handle knowledge base selection
  const handleKnowledgeBaseSelect = (knowledgeBase: KnowledgeBase) => {
    setSelectedKnowledgeBase(knowledgeBase);
    setCurrentFolderId(null);
    setFolderPath([{ id: null, name: 'Root' }]);
  };

  // Function to go back to knowledge base list
  const handleBackToList = () => {
    setSelectedKnowledgeBase(null);
    setCurrentFolderId(null);
    setFolderPath([{ id: null, name: 'Root' }]);
  };

  const fetchFoldersAndFiles = async () => {
    if (!selectedKnowledgeBase) return;

    try {
      setIsLoading(true);
      const url = `/api/whitelabel/knowledge-base/folder?knowledgeBaseId=${selectedKnowledgeBase.id}${
        currentFolderId ? `&parentFolderId=${currentFolderId}` : ''
      }`;

      const response = await fetch(url);

      if (response.status === 401) {
        setError('You need to be logged in to access this page. Please log in and try again.');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch folders and files');
      }

      const data = await response.json();
      setFolders(data.folders || []);
      setFiles(data.files || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching folders and files:', err);
      setError('Failed to load folders and files. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWebsiteUrls = async () => {
    if (!selectedKnowledgeBase) return;

    try {
      const response = await fetch(`/api/whitelabel/knowledge-base/website-urls?knowledgeBaseId=${selectedKnowledgeBase.id}`);

      if (response.status === 401) {
        setError('You need to be logged in to access this page. Please log in and try again.');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch website URLs');
      }

      const data = await response.json();
      setWebsiteUrls(data.data || []);
    } catch (err) {
      console.error('Error fetching website URLs:', err);
      // Don't set error for website URLs as it's not critical
    }
  };

  const handleCreateKnowledgeBase = async (name: string, description: string) => {
    try {
      setIsLoading(true);
      console.log('Creating knowledge base:', { name, description });

      const response = await fetch('/api/whitelabel/knowledge-base', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });

      console.log('Knowledge base creation response status:', response.status);

      if (response.status === 401) {
        setError('You need to be logged in to create a knowledge base. Please log in and try again.');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to create knowledge base');
      }

      const data = await response.json();
      console.log('Knowledge base created:', data);

      // Refresh the knowledge bases list
      await fetchKnowledgeBases();

      // Close the modal
      setIsNewKnowledgeBaseModalOpen(false);
      setError(null);

      // Don't automatically select the new knowledge base
      // Let the user choose from the list
    } catch (err) {
      console.error('Error creating knowledge base:', err);
      setError('Failed to create knowledge base. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch knowledge bases
  const fetchKnowledgeBases = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching knowledge bases...');

      const response = await fetch('/api/whitelabel/knowledge-base');

      console.log('Knowledge bases fetch response status:', response.status);

      if (response.status === 401) {
        setError('You need to be logged in to access this page. Please log in and try again.');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch knowledge bases');
      }

      const data = await response.json();
      console.log('Knowledge bases fetched:', data);

      setKnowledgeBases(data.knowledgeBases || []);

      // Select the first knowledge base if available
      if (data.knowledgeBases && data.knowledgeBases.length > 0) {
        setSelectedKnowledgeBase(data.knowledgeBases[0]);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching knowledge bases:', err);
      setError('Failed to load knowledge bases. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFolder = async (name: string, description: string) => {
    if (!selectedKnowledgeBase) return;

    try {
      setIsLoading(true);
      console.log('Creating folder:', {
        name,
        description,
        knowledgeBaseId: selectedKnowledgeBase.id,
        parentFolderId: currentFolderId
      });

      const response = await fetch('/api/whitelabel/knowledge-base/folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          knowledgeBaseId: selectedKnowledgeBase.id,
          parentFolderId: currentFolderId,
        }),
      });

      console.log('Folder creation response status:', response.status);

      if (response.status === 401) {
        setError('You need to be logged in to create a folder. Please log in and try again.');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to create folder');
      }

      const data = await response.json();
      console.log('Folder created:', data);

      // Refresh the folders and files
      fetchFoldersAndFiles();

      // Close the modal
      setIsNewFolderModalOpen(false);
      setError(null);
    } catch (err) {
      console.error('Error creating folder:', err);
      setError('Failed to create folder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: any, description: string) => {
    if (!selectedKnowledgeBase) return;

    try {
      setIsLoading(true);
      console.log('Uploading file:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        description,
        knowledgeBaseId: selectedKnowledgeBase.id,
        folderId: currentFolderId
      });

      const formData = new FormData();
      formData.append('file', file as Blob);
      formData.append('knowledgeBaseId', selectedKnowledgeBase.id);
      formData.append('description', description);

      if (currentFolderId) {
        formData.append('folderId', currentFolderId);
      }

      const response = await fetch('/api/whitelabel/knowledge-base/file', {
        method: 'POST',
        body: formData,
      });

      console.log('File upload response status:', response.status);

      if (response.status === 401) {
        setError('You need to be logged in to upload files. Please log in and try again.');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('File upload error response:', errorText);
        throw new Error(`Failed to upload file: ${errorText}`);
      }

      const data = await response.json();
      console.log('File uploaded:', data);

      // Refresh the folders and files
      fetchFoldersAndFiles();

      // Close the modal
      setIsFileUploadModalOpen(false);
      setError(null);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Combine folders and files for display
  const items = [
    ...folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      type: 'folder',
      size: (folder._count?.files || 0) + (folder._count?.childFolders || 0),
      lastUpdated: folder.updatedAt,
      description: folder.description,
    })),
    ...files.map(file => ({
      id: file.id,
      name: file.name,
      type: 'file',
      size: file.fileSize,
      lastUpdated: file.updatedAt,
      description: file.description,
      fileType: file.fileType,
    })),
  ];

  // Filter items based on search query
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <WhitelabelLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Knowledge Base</h2>
            {selectedKnowledgeBase && (
              <div className="flex items-center mt-1">
                <button
                  className="text-blue-400 hover:text-blue-300 flex items-center mr-2"
                  onClick={handleBackToList}
                >
                  <FiArrowLeft className="h-4 w-4 mr-1" />
                  <span>Back to list</span>
                </button>
                <span className="text-gray-400">{selectedKnowledgeBase.name}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
            {selectedKnowledgeBase ? (
              <>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search documents..."
                    className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-opacity-50 w-full md:w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>

                <button
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => setIsFileUploadModalOpen(true)}
                >
                  <FiUpload className="h-4 w-4" />
                  <span>Upload</span>
                </button>

                <button
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => setIsNewFolderModalOpen(true)}
                >
                  <FiPlus className="h-4 w-4" />
                  <span>New Folder</span>
                </button>
              </>
            ) : (
              <>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search knowledge bases..."
                    className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-opacity-50 w-full md:w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>

                <button
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => setIsNewKnowledgeBaseModalOpen(true)}
                >
                  <FiPlus className="h-4 w-4" />
                  <span>New Knowledge Base</span>
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 flex items-center">
            <FiAlertCircle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        )}

        {/* Knowledge Base List View */}
        {!selectedKnowledgeBase && (
          <div className="bg-gray-800/30 rounded-lg border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-lg font-medium text-white">Your Knowledge Bases</h3>
              <p className="text-sm text-gray-400 mt-1">
                Select a knowledge base to manage its documents and folders
              </p>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FiLoader className="h-8 w-8 text-gray-400 animate-spin mb-4" />
                <p className="text-gray-400">Loading...</p>
              </div>
            ) : (
              <>
                {knowledgeBases.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-800/50 border-b border-gray-800">
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Items</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Size</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {knowledgeBases
                          .filter(kb =>
                            kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (kb.description && kb.description.toLowerCase().includes(searchQuery.toLowerCase()))
                          )
                          .map((kb) => (
                          <tr key={kb.id} className="hover:bg-gray-800/30">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <FiDatabase className="h-5 w-5 text-blue-500 mr-3" />
                                <button
                                  className="text-white hover:underline font-medium"
                                  onClick={() => handleKnowledgeBaseSelect(kb)}
                                >
                                  {kb.name}
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-gray-300">{kb.description || '-'}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-gray-300">
                                {(kb._count?.folders || 0) + (kb._count?.files || 0)} items
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <SizeDisplay
                                type="knowledgebase"
                                sizeBytes={kb.totalSize || 0}
                                fileCount={kb._count?.files || 0}
                                showIcon={false}
                                showLabel={false}
                                className="text-sm"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-gray-300">{formatDate(kb.createdAt)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex space-x-2">
                                <button
                                  className="p-1 rounded-full hover:bg-gray-700"
                                  onClick={() => handleKnowledgeBaseSelect(kb)}
                                >
                                  <FiEye className="h-4 w-4 text-gray-400 hover:text-white" />
                                </button>
                                <button className="p-1 rounded-full hover:bg-gray-700">
                                  <FiEdit className="h-4 w-4 text-gray-400 hover:text-white" />
                                </button>
                                <button className="p-1 rounded-full hover:bg-gray-700">
                                  <FiTrash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FiDatabase className="h-12 w-12 text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No knowledge bases yet</h3>
                    <p className="text-gray-400 text-center max-w-md mb-6">
                      Create your first knowledge base to start organizing your documents
                    </p>
                    <button
                      className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white"
                      style={{ backgroundColor: primaryColor }}
                      onClick={() => setIsNewKnowledgeBaseModalOpen(true)}
                    >
                      <FiPlus className="h-4 w-4" />
                      <span>Create Knowledge Base</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Knowledge Base Processing Status */}
        {selectedKnowledgeBase && customerId && partnerId && (
          <KBProcessingStatus
            knowledgeBaseId={selectedKnowledgeBase.id}
            knowledgeBaseName={selectedKnowledgeBase.name}
            partnerId={partnerId}
            customerId={customerId}
            onProcessingComplete={() => {
              // Refresh the knowledge base data after processing
              fetchKnowledgeBases();
            }}
            className="mb-6"
          />
        )}

        {/* Knowledge Base Content View */}
        {selectedKnowledgeBase && (
          <div className="bg-gray-800/30 rounded-lg border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-white">Knowledge Base Content</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Manage your documents, folders, and website URLs
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex space-x-1 mb-4">
                <button
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'files'
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                  style={activeTab === 'files' ? { backgroundColor: primaryColor } : {}}
                  onClick={() => setActiveTab('files')}
                >
                  <FiFile className="inline h-4 w-4 mr-2" />
                  Documents & Folders
                </button>
                <button
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'websites'
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                  style={activeTab === 'websites' ? { backgroundColor: primaryColor } : {}}
                  onClick={() => setActiveTab('websites')}
                >
                  <FiGlobe className="inline h-4 w-4 mr-2" />
                  Website URLs ({websiteUrls.length})
                </button>
              </div>

              {/* Breadcrumb navigation - only show for files tab */}
              {activeTab === 'files' && (
                <div className="flex items-center space-x-2 text-sm">
                  {folderPath.map((folder, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && <span className="text-gray-500">/</span>}
                      <button
                        className={`hover:underline ${
                          index === folderPath.length - 1 ? 'text-white font-medium' : 'text-gray-400'
                        }`}
                        onClick={() => {
                          // Navigate to this folder
                          setCurrentFolderId(folder.id);
                          // Update the path to include only up to this folder
                          setFolderPath(folderPath.slice(0, index + 1));
                        }}
                      >
                        {folder.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* Tab Content */}
            {activeTab === 'files' ? (
              isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FiLoader className="h-8 w-8 text-gray-400 animate-spin mb-4" />
                  <p className="text-gray-400">Loading...</p>
                </div>
              ) : (
                <>
                  {filteredItems.length > 0 ? (
                  <div className="space-y-4">
                    {/* File Summary */}
                    <div className="bg-gray-800/30 rounded-lg p-4">
                      <FileSizeSummary
                        files={files.map(f => ({ fileSize: f.fileSize || 0, name: f.name }))}
                        className="mb-2"
                      />
                      {folders.length > 0 && (
                        <div className="text-sm text-gray-400">
                          {folders.length} folder{folders.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                      <thead>
                        <tr className="bg-gray-800/50 border-b border-gray-800">
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Size/Items</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last Updated</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {filteredItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-800/30">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {item.type === 'folder' ? (
                                  <FiFolder className="h-5 w-5 text-amber-500 mr-3" />
                                ) : (
                                  <FiFile className="h-5 w-5 text-blue-500 mr-3" />
                                )}
                                <span
                                  className="text-white cursor-pointer hover:underline"
                                  onClick={() => {
                                    if (item.type === 'folder') {
                                      // Find the folder to get its name
                                      const folder = folders.find(f => f.id === item.id);
                                      if (folder) {
                                        // Add the folder to the path
                                        setFolderPath([...folderPath, { id: item.id, name: folder.name }]);
                                        // Set the current folder ID
                                        setCurrentFolderId(item.id);
                                      }
                                    }
                                  }}
                                >
                                  {item.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-gray-300 capitalize">{item.type}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-gray-300">
                                {item.type === 'folder' ? `${item.size} items` : formatFileSize(item.size)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-gray-300">{formatDate(item.lastUpdated)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex space-x-2">
                                <button className="p-1 rounded-full hover:bg-gray-700">
                                  <FiEdit className="h-4 w-4 text-gray-400 hover:text-white" />
                                </button>
                                <button className="p-1 rounded-full hover:bg-gray-700">
                                  <FiTrash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FiFileText className="h-12 w-12 text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No documents yet</h3>
                    <p className="text-gray-400 text-center max-w-md mb-6">
                      Upload documents or create folders to organize your knowledge base
                    </p>
                    <div className="flex space-x-4">
                      <button
                        className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white"
                        style={{ backgroundColor: primaryColor }}
                        onClick={() => setIsFileUploadModalOpen(true)}
                      >
                        <FiUpload className="h-4 w-4" />
                        <span>Upload Document</span>
                      </button>
                      <button
                        className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white"
                        style={{ backgroundColor: primaryColor }}
                        onClick={() => setIsNewFolderModalOpen(true)}
                      >
                        <FiPlus className="h-4 w-4" />
                        <span>Create Folder</span>
                      </button>
                      <button
                        className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white"
                        style={{ backgroundColor: primaryColor }}
                        onClick={() => setIsWebsiteUrlModalOpen(true)}
                      >
                        <FiGlobe className="h-4 w-4" />
                        <span>Add Website URLs</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )) : (
              /* Website URLs Tab */
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-medium text-white">Website URLs</h4>
                    <p className="text-sm text-gray-400">
                      Add website URLs to include web content in your knowledge base
                    </p>
                  </div>
                  <button
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => setIsWebsiteUrlModalOpen(true)}
                  >
                    <FiGlobe className="h-4 w-4" />
                    <span>Add Website URLs</span>
                  </button>
                </div>

                <WebsiteUrlsList
                  websiteUrls={websiteUrls}
                  onUpdate={fetchWebsiteUrls}
                  primaryColor={primaryColor}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <NewKnowledgeBaseModal
        isOpen={isNewKnowledgeBaseModalOpen}
        onClose={() => setIsNewKnowledgeBaseModalOpen(false)}
        onCreate={handleCreateKnowledgeBase}
        primaryColor={primaryColor}
      />

      <NewFolderModal
        isOpen={isNewFolderModalOpen}
        onClose={() => setIsNewFolderModalOpen(false)}
        onCreate={handleCreateFolder}
        primaryColor={primaryColor}
      />

      <FileUploadModal
        isOpen={isFileUploadModalOpen}
        onClose={() => setIsFileUploadModalOpen(false)}
        onUpload={handleFileUpload}
        primaryColor={primaryColor}
      />

      <WebsiteUrlModal
        isOpen={isWebsiteUrlModalOpen}
        onClose={() => setIsWebsiteUrlModalOpen(false)}
        knowledgeBaseId={selectedKnowledgeBase?.id || ''}
        onSuccess={() => {
          fetchWebsiteUrls();
          setIsWebsiteUrlModalOpen(false);
        }}
        primaryColor={primaryColor}
      />
    </WhitelabelLayout>
  );
}
