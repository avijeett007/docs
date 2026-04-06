'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoTutorial {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  sequence: number;
  audience: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function VideoTutorials() {
  const { toast } = useToast();
  const [videos, setVideos] = useState<VideoTutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoTutorial | null>(null);

  // Fetch videos
  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get token from localStorage
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch('/api/partner/video-tutorials', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in again');
        }
        throw new Error('Failed to fetch video tutorials');
      }

      const data = await response.json();
      setVideos(data.videos || []);
    } catch (err) {
      console.error('Error fetching video tutorials:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching videos');
      toast({
        title: 'Error',
        description: 'Failed to load video tutorials',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Open preview dialog
  const handleOpenPreviewDialog = (video: VideoTutorial) => {
    setCurrentVideo(video);
    setIsPreviewDialogOpen(true);
  };

  // Get video embed URL
  const getVideoEmbedUrl = (url: string) => {
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtube.com/watch?v=')
        ? url.split('v=')[1].split('&')[0]
        : url.includes('youtu.be/')
          ? url.split('youtu.be/')[1].split('?')[0]
          : '';
      return `https://www.youtube.com/embed/${videoId}`;
    }

    // Loom
    if (url.includes('loom.com')) {
      if (url.includes('/share/')) {
        return url.replace('/share/', '/embed/');
      }
      return url;
    }

    // Default: return the original URL
    return url;
  };

  // Get video thumbnail
  const getVideoThumbnail = (video: VideoTutorial) => {
    if (video.thumbnailUrl) {
      return video.thumbnailUrl;
    }

    // YouTube
    if (video.videoUrl.includes('youtube.com') || video.videoUrl.includes('youtu.be')) {
      const videoId = video.videoUrl.includes('youtube.com/watch?v=')
        ? video.videoUrl.split('v=')[1].split('&')[0]
        : video.videoUrl.includes('youtu.be/')
          ? video.videoUrl.split('youtu.be/')[1].split('?')[0]
          : '';
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    // Default placeholder
    return '/images/video-placeholder.jpg';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-md text-red-400">
        <p>{error || 'Failed to load video tutorials. Please try again later.'}</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No video tutorials available at this time.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video) => (
          <Card
            key={video.id}
            className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow bg-gray-800 border-gray-700"
            onClick={() => handleOpenPreviewDialog(video)}
          >
            <div className="relative aspect-video w-full bg-gray-100">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${getVideoThumbnail(video)})` }}
              />
              <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-white bg-opacity-80 hover:bg-opacity-100"
                >
                  <Play className="h-6 w-6 text-gray-900" />
                </Button>
              </div>
            </div>
            <CardContent className="p-4">
              <h3 className="font-medium text-white">{video.title}</h3>
              {video.description && (
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{video.description}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden bg-gray-800 border-gray-700">
          <DialogHeader className="p-6 bg-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle className="text-white">{currentVideo?.title}</DialogTitle>
                <p className="text-sm text-gray-300 mt-1">{currentVideo?.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(currentVideo?.videoUrl, '_blank')}
                className="flex items-center bg-gray-600 text-white border-gray-500 hover:bg-gray-500"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Original
              </Button>
            </div>
          </DialogHeader>
          <div className="aspect-video w-full">
            {currentVideo && (
              <iframe
                src={getVideoEmbedUrl(currentVideo.videoUrl)}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
