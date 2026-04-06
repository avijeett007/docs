'use client';

import React from 'react';
import VideoTutorialManager from '@/components/admin/VideoTutorialManager';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';

export default function AdminTutorialsPage() {
  const { user } = useAdminAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen admin-layout">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Video Tutorials</h1>
          </div>
          <VideoTutorialManager />
        </div>
      </div>
    </div>
  );
}
