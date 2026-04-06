'use client';

import { useState, useEffect } from 'react';
import { PageVideo } from '@/lib/staticPageVideos';

export function usePageVideo(currentPath: string) {
  const [video, setVideo] = useState<PageVideo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPageVideo = async () => {
      try {
        const response = await fetch(`/api/partner/page-videos?path=${encodeURIComponent(currentPath)}`);

        if (response.ok) {
          const data = await response.json();

          if (data.success && data.video) {
            setVideo(data.video);
          } else {
            setVideo(null);
          }
        } else {
          setVideo(null);
        }
      } catch (error) {
        console.error('Error fetching page video:', error);
        setVideo(null);
      } finally {
        setLoading(false);
      }
    };

    if (currentPath) {
      fetchPageVideo();
    }
  }, [currentPath]);

  return { video, loading };
}


