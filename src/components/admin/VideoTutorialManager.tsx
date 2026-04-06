'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Check, AlertCircle, Plus, Edit, Trash2, ArrowUp, ArrowDown, Play, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';

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

export default function VideoTutorialManager() {
  const { toast } = useToast();
  const [videos, setVideos] = useState<VideoTutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoTutorial | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [audience, setAudience] = useState('partner');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch videos
  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/video-tutorials');

      if (!response.ok) {
        throw new Error('Failed to fetch video tutorials');
      }

      const data = await response.json();
      setVideos(data.videos || []);
    } catch (err) {
      console.error('Error fetching video tutorials:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Reset form
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setVideoUrl('');
    setThumbnailUrl('');
    setAudience('partner');
    setIsActive(true);
    setCurrentVideo(null);
  };

  // Open create dialog
  const handleOpenCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  // Open edit dialog
  const handleOpenEditDialog = (video: VideoTutorial) => {
    setCurrentVideo(video);
    setTitle(video.title);
    setDescription(video.description || '');
    setVideoUrl(video.videoUrl);
    setThumbnailUrl(video.thumbnailUrl || '');
    setAudience(video.audience);
    setIsActive(video.isActive);
    setIsEditDialogOpen(true);
  };

  // Open preview dialog
  const handleOpenPreviewDialog = (video: VideoTutorial) => {
    setCurrentVideo(video);
    setIsPreviewDialogOpen(true);
  };

  // Create video
  const handleCreateVideo = async () => {
    if (!title || !videoUrl) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch('/api/admin/video-tutorials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          videoUrl,
          thumbnailUrl,
          audience,
          isActive,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create video tutorial');
      }

      toast({
        title: 'Video Tutorial Created',
        description: 'Video tutorial has been created successfully',
        variant: 'default',
      });

      setIsCreateDialogOpen(false);
      resetForm();
      fetchVideos();
    } catch (err) {
      console.error('Error creating video tutorial:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create video tutorial',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update video
  const handleUpdateVideo = async () => {
    if (!currentVideo || !title || !videoUrl) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/admin/video-tutorials/${currentVideo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          videoUrl,
          thumbnailUrl,
          audience,
          isActive,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update video tutorial');
      }

      toast({
        title: 'Video Tutorial Updated',
        description: 'Video tutorial has been updated successfully',
        variant: 'default',
      });

      setIsEditDialogOpen(false);
      resetForm();
      fetchVideos();
    } catch (err) {
      console.error('Error updating video tutorial:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update video tutorial',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete video
  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video tutorial? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/video-tutorials/${videoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete video tutorial');
      }

      toast({
        title: 'Video Tutorial Deleted',
        description: 'Video tutorial has been deleted successfully',
        variant: 'default',
      });

      fetchVideos();
    } catch (err) {
      console.error('Error deleting video tutorial:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete video tutorial',
        variant: 'destructive',
      });
    }
  };

  // Change sequence
  const handleChangeSequence = async (videoId: string, direction: 'up' | 'down') => {
    try {
      const response = await fetch(`/api/admin/video-tutorials/${videoId}/sequence`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          direction,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update sequence');
      }

      fetchVideos();
    } catch (err) {
      console.error('Error updating sequence:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update sequence',
        variant: 'destructive',
      });
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Video Tutorials</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage video tutorials for partners, customers, and public audiences
          </p>
        </div>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Video
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label>Filter by audience</Label>
        <Select defaultValue="all" onValueChange={(value) => {
          // Filter videos by audience (to be implemented)
        }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select audience" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Audiences</SelectItem>
            <SelectItem value="partner">Partners</SelectItem>
            <SelectItem value="customer">Customers</SelectItem>
            <SelectItem value="public">Public</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No video tutorials found. Add your first video to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {videos.map((video) => (
            <Card key={video.id} className="overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="relative w-full md:w-64 h-40 bg-gray-100">
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${getVideoThumbnail(video)})` }}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full bg-white bg-opacity-80 hover:bg-opacity-100"
                      onClick={() => handleOpenPreviewDialog(video)}
                    >
                      <Play className="h-6 w-6 text-gray-900" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold">{video.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{video.description || 'No description'}</p>
                    </div>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenPreviewDialog(video)}>
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(video)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        video.audience === 'partner' ? 'bg-blue-100 text-blue-800' :
                        video.audience === 'customer' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {video.audience.charAt(0).toUpperCase() + video.audience.slice(1)}
                      </span>
                      {!video.isActive && (
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleChangeSequence(video.id, 'up')}
                        disabled={videos.indexOf(video) === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleChangeSequence(video.id, 'down')}
                        disabled={videos.indexOf(video) === videos.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteVideo(video.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Add Video Tutorial</DialogTitle>
            <DialogDescription className="text-gray-300">
              Add a new video tutorial for partners, customers, or public audiences.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter video description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="videoUrl">Video URL</Label>
              <Input
                id="videoUrl"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Enter YouTube, Loom, or S3 URL"
              />
              <p className="text-xs text-gray-500">
                Supported formats: YouTube, Loom, or any public video URL
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="thumbnailUrl">Thumbnail URL (Optional)</Label>
              <Input
                id="thumbnailUrl"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="Enter thumbnail image URL"
              />
              <p className="text-xs text-gray-500">
                Leave blank to use default thumbnail from video provider
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="audience">Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger id="audience">
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="partner">Partners</SelectItem>
                  <SelectItem value="customer">Customers</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateVideo} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Video'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Video Tutorial</DialogTitle>
            <DialogDescription className="text-gray-300">
              Update the details of this video tutorial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter video description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-videoUrl">Video URL</Label>
              <Input
                id="edit-videoUrl"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Enter YouTube, Loom, or S3 URL"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-thumbnailUrl">Thumbnail URL (Optional)</Label>
              <Input
                id="edit-thumbnailUrl"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="Enter thumbnail image URL"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-audience">Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger id="edit-audience">
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="partner">Partners</SelectItem>
                  <SelectItem value="customer">Customers</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="edit-isActive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateVideo} disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Video'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden bg-gray-800 border-gray-700">
          <div className="p-6 bg-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-white">{currentVideo?.title}</h3>
                <p className="text-sm text-gray-300">{currentVideo?.description}</p>
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
          </div>
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
