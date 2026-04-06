'use client';

import React, { useState } from 'react';
import { FiX, FiGlobe, FiLoader } from 'react-icons/fi';
import { toast } from 'sonner';

interface SitemapPage {
  url: string;
  title?: string;
  lastModified?: string;
  changeFrequency?: string;
  priority?: string;
}

interface SitemapData {
  sitemapFound: boolean;
  sitemapUrl?: string;
  baseUrl: string;
  totalPages?: number;
  pages: SitemapPage[];
  crawlMethod?: 'sitemap' | 'web_crawl' | 'single_page';
}

interface WebsiteUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgeBaseId: string;
  onSuccess: () => void;
  primaryColor?: string;
}

export default function WebsiteUrlModal({
  isOpen,
  onClose,
  knowledgeBaseId,
  onSuccess,
  primaryColor = '#3B82F6',
}: WebsiteUrlModalProps) {
  const [step, setStep] = useState<'url' | 'pages' | 'settings'>('url');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [sitemapData, setSitemapData] = useState<SitemapData | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());


  if (!isOpen) return null;

  const handleClose = () => {
    setStep('url');
    setUrl('');
    setSitemapData(null);
    setSelectedPages(new Set());
    onClose();
  };

  const handleUrlSubmit = async () => {
    if (!url.trim()) return;

    setLoading(true);
    try {
      // Ensure URL has protocol
      let fullUrl = url.trim();
      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        fullUrl = `https://${fullUrl}`;
      }

      const response = await fetch('/api/whitelabel/knowledge-base/sitemap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sitemap');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch sitemap');
      }

      let data: SitemapData = result.data;

      // If no pages were found, add the original URL as a fallback
      if (!data.pages || data.pages.length === 0) {
        data = {
          ...data,
          sitemapFound: false,
          pages: [{
            url: fullUrl,
            title: `Website: ${fullUrl}`,
          }],
          crawlMethod: 'single_page',
        };
        toast.info('No sitemap found. You can still add the website URL directly.');
      }

      setSitemapData(data);

      // Auto-select all pages initially
      const allUrls = new Set(data.pages.map(page => page.url));
      setSelectedPages(allUrls);

      setStep('pages');
    } catch (error) {
      console.error('Error fetching sitemap:', error);
      toast.error('Failed to fetch website sitemap. Please check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (!sitemapData) return;
    const allUrls = new Set(sitemapData.pages.map(page => page.url));
    setSelectedPages(allUrls);
  };

  const handleDeselectAll = () => {
    setSelectedPages(new Set());
  };

  const handlePageToggle = (pageUrl: string) => {
    const newSelected = new Set(selectedPages);
    if (newSelected.has(pageUrl)) {
      newSelected.delete(pageUrl);
    } else {
      newSelected.add(pageUrl);
    }
    setSelectedPages(newSelected);
  };

  const handleAddWebsiteUrl = async () => {
    if (!sitemapData || selectedPages.size === 0) return;

    setLoading(true);
    try {
      const selectedPagesData = sitemapData.pages.filter(page =>
        selectedPages.has(page.url)
      ).map(page => ({
        url: page.url,
        title: page.title,
      }));

      const response = await fetch('/api/whitelabel/knowledge-base/website-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knowledgeBaseId,
          baseUrl: sitemapData.baseUrl,
          selectedPages: selectedPagesData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add website URLs');
      }

      toast.success(`Successfully added ${selectedPages.size} website URLs`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error adding website URLs:', error);
      toast.error('Failed to add website URLs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
        >
          <FiX className="h-5 w-5" />
        </button>

        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FiGlobe className="h-5 w-5" />
            Add Website URLs
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'url' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="website-url" className="block text-sm font-medium text-gray-300 mb-1">
                  Website URL
                </label>
                <input
                  id="website-url"
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-opacity-50"
                  style={{ borderColor: primaryColor }}
                />
              </div>
              <p className="text-sm text-gray-400">
                Enter the website URL you want to crawl. We'll automatically discover and parse all accessible pages.
              </p>
            </div>
          )}

          {step === 'pages' && sitemapData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-white">Select Pages to Import</h3>
                  <p className="text-sm text-gray-400">
                    Found {sitemapData.pages.length} pages
                    {sitemapData.crawlMethod === 'sitemap' && ' from sitemap'}
                    {sitemapData.crawlMethod === 'web_crawl' && ' by crawling the website'}
                    {sitemapData.crawlMethod === 'single_page' && ' (single page only)'}
                    . Select which ones to add to your knowledge base.
                  </p>
                  {sitemapData.crawlMethod === 'web_crawl' && (
                    <p className="text-xs text-yellow-400 mt-1">
                      ℹ️ No sitemap found. We crawled the website to discover pages automatically.
                    </p>
                  )}
                  {sitemapData.crawlMethod === 'single_page' && (
                    <p className="text-xs text-yellow-400 mt-1">
                      ℹ️ No sitemap found and crawling was limited. You can manually add more URLs later.
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1 rounded-md text-sm border hover:bg-gray-700"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="px-3 py-1 rounded-md text-sm border border-gray-600 text-gray-400 hover:bg-gray-700"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto border border-gray-700 rounded-lg">
                {sitemapData.pages.map((page) => (
                  <div
                    key={page.url}
                    className={`flex items-center p-3 border-b border-gray-700 last:border-b-0 hover:bg-gray-800 ${
                      selectedPages.has(page.url) ? 'bg-gray-800' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPages.has(page.url)}
                      onChange={() => handlePageToggle(page.url)}
                      className="mr-3"
                      style={{ accentColor: primaryColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">
                        {page.title || page.url}
                      </div>
                      <div className="text-gray-400 text-xs truncate">
                        {page.url}
                      </div>
                      {page.lastModified && (
                        <div className="text-gray-500 text-xs">
                          Last modified: {new Date(page.lastModified).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
          >
            Cancel
          </button>
          
          {step === 'url' && (
            <button
              onClick={handleUrlSubmit}
              disabled={loading || !url.trim()}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {loading && <FiLoader className="h-4 w-4 mr-2 animate-spin" />}
              Next
            </button>
          )}

          {step === 'pages' && (
            <button
              onClick={handleAddWebsiteUrl}
              disabled={loading || selectedPages.size === 0}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {loading && <FiLoader className="h-4 w-4 mr-2 animate-spin" />}
              Add Website URLs ({selectedPages.size} selected)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
