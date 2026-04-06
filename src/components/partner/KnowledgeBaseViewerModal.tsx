'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  FiX, FiFolder, FiFile, FiDownload, FiEye, FiArrowLeft,
  FiLoader, FiDatabase, FiInfo, FiFileText, FiImage,
  FiVideo, FiMusic, FiArchive, FiCode, FiGlobe, FiClock,
  FiCheckCircle, FiAlertCircle
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  totalFiles: number;
  totalFolders: number;
  totalWebsiteUrls?: number;
  activeWebsiteUrls?: number;
  totalWebsitePages?: number;
  scrapedWebsitePages?: number;
  processingWebsitePages?: number;
  totalSize: number;
  isReady: boolean;
  readyFiles?: number;
  processingFiles: number;
  failedFiles?: number;
  createdAt: string;
  updatedAt: string;
  websiteUrls?: WebsiteUrl[];
}

interface WebsiteUrl {
  id: string;
  baseUrl: string;
  scrapingFrequency: string;
  isActive: boolean;
  lastScrapedAt?: string;
  nextScrapeAt?: string;
  totalPages: number;
  scrapedPages: number;
  processingPages: number;
  pages: WebsitePage[];
}

interface WebsitePage {
  id: string;
  url: string;
  title?: string;
  scrapingStatus: string;
  lastScrapedAt?: string;
}

interface Folder {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
  folderCount: number;
}

interface File {
  id: string;
  name: string;
  description?: string;
  fileType: string;
  fileSize: number;
  embeddingStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeBaseViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgeBase: KnowledgeBase;
  customerId: string;
}

const KnowledgeBaseViewerModal: React.FC<KnowledgeBaseViewerModalProps> = ({
  isOpen,
  onClose,
  knowledgeBase,
  customerId
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [websiteUrls, setWebsiteUrls] = useState<WebsiteUrl[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());

  // Custom close handler to prevent accidental closes
  const handleClose = () => {
    onClose();
  };

  // Prevent dialog from closing on backdrop click
  const handleDialogClose = () => {
    // Completely disable backdrop close to prevent interference
  };

  // Load folder contents
  const loadFolderContents = async (folderId: string | null = null) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        console.error('[KnowledgeBaseViewerModal] No partner token found');
        return;
      }

      const url = `/api/partner/customers/${customerId}/knowledge-bases/${knowledgeBase.id}/files${
        folderId ? `?folderId=${folderId}` : ''
      }`;

      console.log('[KnowledgeBaseViewerModal] Loading folder contents:', {
        url,
        customerId,
        knowledgeBaseId: knowledgeBase.id,
        folderId,
        hasToken: !!token
      });

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Knowledge base files API response:', data);
        console.log('Folders found:', data.data?.folders?.length || 0);
        console.log('Files found:', data.data?.files?.length || 0);
        console.log('Current folder ID:', folderId);
        console.log('Raw folders data:', data.data?.folders);
        console.log('Raw files data:', data.data?.files);
        setFolders(data.data?.folders || []);
        setFiles(data.data?.files || []);
      } else {
        const errorText = await response.text();
        console.error('Failed to load folder contents:', response.status, response.statusText, errorText);
        toast.error(`Failed to load folder contents: ${response.status}`);
      }

      // Load website URLs when at root level (folderId is null)
      if (!folderId) {
        // Use the website URLs from the knowledge base data passed from parent
        if (knowledgeBase.websiteUrls) {
          setWebsiteUrls(knowledgeBase.websiteUrls);
        } else {
          setWebsiteUrls([]);
        }
      } else {
        // Clear website URLs when navigating into folders
        setWebsiteUrls([]);
      }
    } catch (error) {
      console.error('Error loading folder contents:', error);
      toast.error('Failed to load folder contents');
      setFolders([]);
      setFiles([]);
      setWebsiteUrls([]);
    } finally {
      setLoading(false);
    }
  };

  // Navigate to folder
  const navigateToFolder = (folder: Folder, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setCurrentFolderId(folder.id);
    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
    loadFolderContents(folder.id);
  };

  // Navigate back
  const navigateBack = (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (folderPath.length === 0) return;

    const newPath = folderPath.slice(0, -1);
    setFolderPath(newPath);

    const parentFolderId = newPath.length > 0 ? newPath[newPath.length - 1].id : null;
    setCurrentFolderId(parentFolderId);
    loadFolderContents(parentFolderId);
  };

  // Navigate to root
  const navigateToRoot = (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setCurrentFolderId(null);
    setFolderPath([]);
    loadFolderContents(null);
  };

  // Download file
  const downloadFile = async (file: File) => {
    setDownloadingFiles(prev => new Set(prev).add(file.id));
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      // Generate presigned URL for download
      const response = await fetch(
        `/api/partner/customers/${customerId}/knowledge-bases/${knowledgeBase.id}/presigned-urls`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cookie': `partner_token=${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileIds: [file.id],
            expiresIn: 3600, // 1 hour
            purpose: 'partner_preview'
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.data?.urls && data.data.urls.length > 0) {
          const downloadUrl = data.data.urls[0].url;
          
          // Create download link
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = file.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          toast.success(`Downloading ${file.name}`);
        } else {
          toast.error('Failed to generate download link');
        }
      } else {
        toast.error('Failed to download file');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.id);
        return newSet;
      });
    }
  };

  // Get file icon
  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (type.includes('image')) return FiImage;
    if (type.includes('video')) return FiVideo;
    if (type.includes('audio')) return FiMusic;
    if (type.includes('zip') || type.includes('archive')) return FiArchive;
    if (type.includes('code') || type.includes('javascript') || type.includes('python')) return FiCode;
    return FiFileText;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Load initial contents when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentFolderId(null);
      setFolderPath([]);
      loadFolderContents(null);
    }
  }, [isOpen, knowledgeBase.id, customerId]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={handleDialogClose}>
        <Transition.Child
          as="div"
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as="div"
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
              className="w-full max-w-4xl h-[80vh] bg-gray-900 rounded-xl shadow-xl border border-gray-800 flex flex-col overflow-hidden"
            >
              <Dialog.Panel className="h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <FiDatabase className="w-6 h-6" style={{ color: '#22d3ee' }} />
                    <div>
                      <Dialog.Title className="text-xl font-semibold text-white">
                        {knowledgeBase.name}
                      </Dialog.Title>
                      <p className="text-sm text-gray-400 mt-1">
                        {knowledgeBase.totalFiles} files
                        {(knowledgeBase.totalWebsiteUrls || 0) > 0 && (
                          <> • {knowledgeBase.totalWebsiteUrls} websites ({knowledgeBase.totalWebsitePages || 0} pages)</>
                        )}
                        • {formatFileSize(knowledgeBase.totalSize)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                {/* Breadcrumb Navigation */}
                <div className="flex items-center gap-2 px-6 py-3 bg-gray-800/50 border-b border-gray-800">
                  <button
                    type="button"
                    onClick={(e) => navigateToRoot(e)}
                    className="transition-colors hover:opacity-80"
                    style={{ color: '#22d3ee' }}
                  >
                    <FiDatabase className="w-4 h-4" />
                  </button>
                  {folderPath.map((folder, index) => (
                    <React.Fragment key={folder.id}>
                      <span className="text-gray-500">/</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const newPath = folderPath.slice(0, index + 1);
                          setFolderPath(newPath);
                          setCurrentFolderId(folder.id);
                          loadFolderContents(folder.id);
                        }}
                        className="transition-colors text-sm hover:opacity-80"
                        style={{ color: '#22d3ee' }}
                      >
                        {folder.name}
                      </button>
                    </React.Fragment>
                  ))}
                  {folderPath.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => navigateBack(e)}
                      className="ml-auto text-gray-400 hover:text-white transition-colors"
                    >
                      <FiArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex items-center gap-3 text-gray-400">
                        <FiLoader className="w-6 h-6 animate-spin" />
                        <span>Loading contents...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Folders */}
                      {folders.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                            Folders ({folders.length})
                          </h3>
                          <div className="grid gap-2">
                            {folders.map((folder) => (
                              <button
                                key={folder.id}
                                type="button"
                                onClick={(e) => navigateToFolder(folder, e)}
                                className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-left"
                              >
                                <FiFolder className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-medium truncate">{folder.name}</p>
                                  {folder.description && (
                                    <p className="text-gray-400 text-sm truncate">{folder.description}</p>
                                  )}
                                  <p className="text-gray-500 text-xs">
                                    {folder.fileCount} files • {folder.folderCount} folders
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Files */}
                      {files.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                            Files ({files.length})
                          </h3>
                          <div className="grid gap-2">
                            {files.map((file) => {
                              const FileIcon = getFileIcon(file.fileType);
                              const isDownloading = downloadingFiles.has(file.id);
                              
                              return (
                                <div
                                  key={file.id}
                                  className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg"
                                >
                                  <FileIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium truncate">{file.name}</p>
                                    {file.description && (
                                      <p className="text-gray-400 text-sm truncate">{file.description}</p>
                                    )}
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                      <span>{formatFileSize(file.fileSize)}</span>
                                      <span
                                        className="px-2 py-1 rounded"
                                        style={{
                                          backgroundColor: file.embeddingStatus === 'completed' ? 'rgba(34, 197, 94, 0.2)' :
                                                         file.embeddingStatus === 'processing' ? 'rgba(245, 158, 11, 0.2)' :
                                                         file.embeddingStatus === 'failed' ? 'rgba(239, 68, 68, 0.2)' :
                                                         'rgba(107, 114, 128, 0.2)',
                                          color: file.embeddingStatus === 'completed' ? '#4ade80' :
                                                file.embeddingStatus === 'processing' ? '#fbbf24' :
                                                file.embeddingStatus === 'failed' ? '#f87171' :
                                                '#9ca3af'
                                        }}
                                      >
                                        {file.embeddingStatus}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      downloadFile(file);
                                    }}
                                    disabled={isDownloading}
                                    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                                  >
                                    {isDownloading ? (
                                      <FiLoader className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <FiDownload className="w-4 h-4" />
                                    )}
                                    {isDownloading ? 'Downloading...' : 'Download'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Website URLs */}
                      {websiteUrls.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                            Website URLs ({websiteUrls.length})
                          </h3>
                          <div className="grid gap-2">
                            {websiteUrls.map((websiteUrl) => (
                              <div
                                key={websiteUrl.id}
                                className="p-3 bg-gray-800 rounded-lg border border-gray-700"
                              >
                                <div className="flex items-start gap-3">
                                  <FiGlobe className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-white font-medium truncate">{websiteUrl.baseUrl}</p>
                                      <span
                                        className={clsx(
                                          "px-2 py-1 rounded text-xs font-medium",
                                          websiteUrl.isActive
                                            ? "bg-green-500/20 text-green-400"
                                            : "bg-gray-500/20 text-gray-400"
                                        )}
                                      >
                                        {websiteUrl.isActive ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                                      <span>{websiteUrl.totalPages} pages</span>
                                      <span>{websiteUrl.scrapedPages} scraped</span>
                                      {websiteUrl.processingPages > 0 && (
                                        <span className="text-yellow-400">{websiteUrl.processingPages} processing</span>
                                      )}
                                      <span className="flex items-center gap-1">
                                        <FiClock className="w-3 h-3" />
                                        {websiteUrl.scrapingFrequency}
                                      </span>
                                    </div>

                                    {websiteUrl.lastScrapedAt && (
                                      <p className="text-xs text-gray-500">
                                        Last scraped: {new Date(websiteUrl.lastScrapedAt).toLocaleString()}
                                      </p>
                                    )}

                                    {/* Show individual pages if available */}
                                    {websiteUrl.pages && websiteUrl.pages.length > 0 && (
                                      <div className="mt-3 space-y-1">
                                        <p className="text-xs font-medium text-gray-400">Pages:</p>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                          {websiteUrl.pages.map((page) => (
                                            <div key={page.id} className="flex items-center gap-2 text-xs">
                                              {page.scrapingStatus === 'completed' ? (
                                                <FiCheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                                              ) : page.scrapingStatus === 'processing' ? (
                                                <FiLoader className="w-3 h-3 text-yellow-400 animate-spin flex-shrink-0" />
                                              ) : (
                                                <FiAlertCircle className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                              )}
                                              <span className="text-gray-300 truncate flex-1">
                                                {page.title || page.url}
                                              </span>
                                              <span
                                                className={clsx(
                                                  "px-1.5 py-0.5 rounded text-xs",
                                                  page.scrapingStatus === 'completed' ? "bg-green-500/20 text-green-400" :
                                                  page.scrapingStatus === 'processing' ? "bg-yellow-500/20 text-yellow-400" :
                                                  page.scrapingStatus === 'failed' ? "bg-red-500/20 text-red-400" :
                                                  "bg-gray-500/20 text-gray-400"
                                                )}
                                              >
                                                {page.scrapingStatus}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty State */}
                      {!loading && folders.length === 0 && files.length === 0 && websiteUrls.length === 0 && (
                        <div className="text-center py-12">
                          <FiFolder className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-400 mb-2">Empty Folder</h3>
                          <p className="text-gray-500">
                            This folder doesn't contain any files or subfolders.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default KnowledgeBaseViewerModal;
