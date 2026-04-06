'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiPlus, 
  FiEdit2, 
  FiTrash2, 
  FiSave, 
  FiX, 
  FiPlay,
  FiEye,
  FiEyeOff
} from 'react-icons/fi';

interface PageVideo {
  id: string;
  pageUrl: string;
  title: string;
  description?: string;
  videoUrl: string;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const AVAILABLE_PAGES = [
  { value: '/partner/dashboard', label: 'Partner Dashboard' },
  { value: '/partner/settings/whitelabel', label: 'Whitelabel Settings' },
  { value: '/partner/settings/email-domain', label: 'Email Domain Settings' },
  { value: '/partner/customers', label: 'Customer Management' },
  { value: '/partner/ai-agents', label: 'AI Agents' },
  { value: '/partner/ai-usage', label: 'Analytics & Usage' },
  { value: '/partner/settings', label: 'General Settings' },
  { value: '/partner/settings/api-keys', label: 'API Keys' },
  { value: '/partner/ai-agents/retell', label: 'Retell Agents' },
  { value: '/partner/ai-agents/vapi', label: 'VAPI Agents' },
  { value: '/partner/ai-agents/ultravox', label: 'Ultravox Agents' },
  { value: '/partner/ai-agents/elevenlabs', label: 'ElevenLabs Agents' },
  { value: '/partner/ai-agents/ghl', label: 'GHL Agents' }
];

const POSITION_OPTIONS = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'top-left', label: 'Top Left' }
];

export default function PageVideoManager() {
  const [videos, setVideos] = useState<PageVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState<PageVideo | null>(null);
  const [formData, setFormData] = useState<{
    pageUrl: string;
    title: string;
    description: string;
    videoUrl: string;
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    isActive: boolean;
  }>({
    pageUrl: '',
    title: '',
    description: '',
    videoUrl: '',
    position: 'bottom-right',
    isActive: true
  });

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/admin/page-videos');
      if (response.ok) {
        const data = await response.json();
        setVideos(data.videos || []);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingVideo
        ? `/api/admin/page-videos/${editingVideo.id}`
        : '/api/admin/page-videos';

      const method = editingVideo ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchVideos();
        resetForm();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to save video'}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleEdit = (video: PageVideo) => {
    setEditingVideo(video);
    setFormData({
      pageUrl: video.pageUrl,
      title: video.title,
      description: video.description || '',
      videoUrl: video.videoUrl,
      position: video.position,
      isActive: video.isActive
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;
    
    try {
      const response = await fetch(`/api/admin/page-videos/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchVideos();
      }
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  const toggleActive = async (video: PageVideo) => {
    try {
      const response = await fetch(`/api/admin/page-videos/${video.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...video, isActive: !video.isActive })
      });

      if (response.ok) {
        await fetchVideos();
      }
    } catch (error) {
      console.error('Error toggling video status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      pageUrl: '',
      title: '',
      description: '',
      videoUrl: '',
      position: 'bottom-right',
      isActive: true
    });
    setEditingVideo(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Page Video Management</h2>
          <p className="text-gray-400 mt-1">
            Manage tutorial videos that appear on partner portal pages
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <FiPlus className="w-4 h-4" />
          <span>Add Video</span>
        </button>
      </div>

      {/* Video Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50" onClick={resetForm} />
            <motion.div
              className="relative bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">
                  {editingVideo ? 'Edit Video' : 'Add New Video'}
                </h3>
                <button
                  onClick={resetForm}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Page
                    </label>
                    <select
                      value={formData.pageUrl}
                      onChange={(e) => setFormData({ ...formData, pageUrl: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select a page</option>
                      {AVAILABLE_PAGES.map((page) => (
                        <option key={page.value} value={page.value}>
                          {page.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Position
                    </label>
                    <select
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value as any })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {POSITION_OPTIONS.map((pos) => (
                        <option key={pos.value} value={pos.value}>
                          {pos.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., How to Set Up Whitelabel"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief description of what the video covers"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Video URL
                  </label>
                  <input
                    type="url"
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://www.youtube.com/watch?v=..."
                    required
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm text-gray-300">
                    Active (show on page)
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <FiSave className="w-4 h-4" />
                    <span>{editingVideo ? 'Update' : 'Create'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Videos List */}
      <div className="grid gap-4">
        {videos.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
            <FiPlay className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No videos configured yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Add your first tutorial video to get started
            </p>
          </div>
        ) : (
          videos.map((video) => (
            <div
              key={video.id}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="font-semibold text-white">{video.title}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      video.isActive 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {video.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-400 mb-2">
                    Page: <span className="text-blue-400">{video.pageUrl}</span>
                  </p>
                  
                  {video.description && (
                    <p className="text-sm text-gray-300 mb-2">{video.description}</p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Position: {video.position}</span>
                    <span>Updated: {new Date(video.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => toggleActive(video)}
                    className={`p-2 rounded-lg transition-colors ${
                      video.isActive
                        ? 'text-green-400 hover:bg-green-500/20'
                        : 'text-gray-400 hover:bg-gray-700'
                    }`}
                    title={video.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {video.isActive ? <FiEye className="w-4 h-4" /> : <FiEyeOff className="w-4 h-4" />}
                  </button>
                  
                  <button
                    onClick={() => handleEdit(video)}
                    className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handleDelete(video.id)}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
