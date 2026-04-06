'use client';

import React from 'react';
import { FiHardDrive, FiFolder, FiDatabase } from 'react-icons/fi';
import FileValidationService from '@/lib/services/fileValidationService';

interface SizeDisplayProps {
  type: 'folder' | 'knowledgebase' | 'total';
  sizeBytes: number;
  fileCount?: number;
  className?: string;
  showIcon?: boolean;
  showLabel?: boolean;
}

export default function SizeDisplay({
  type,
  sizeBytes,
  fileCount,
  className = '',
  showIcon = true,
  showLabel = true,
}: SizeDisplayProps) {
  const sizeInfo = FileValidationService.formatFileSize(sizeBytes);
  
  const getIcon = () => {
    switch (type) {
      case 'folder':
        return <FiFolder className="w-4 h-4" />;
      case 'knowledgebase':
        return <FiDatabase className="w-4 h-4" />;
      case 'total':
        return <FiHardDrive className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'folder':
        return 'Folder size';
      case 'knowledgebase':
        return 'Knowledge base size';
      case 'total':
        return 'Total size';
      default:
        return '';
    }
  };

  const getColorClass = () => {
    if (sizeInfo.gb >= 1) {
      return 'text-red-400'; // Large files in red
    } else if (sizeInfo.mb >= 100) {
      return 'text-amber-400'; // Medium files in yellow
    } else if (sizeInfo.mb >= 10) {
      return 'text-blue-400'; // Small files in blue
    } else {
      return 'text-green-400'; // Very small files in green
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && (
        <span className="text-gray-400">
          {getIcon()}
        </span>
      )}
      
      <div className="flex flex-col">
        {showLabel && (
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            {getLabel()}
          </span>
        )}
        
        <div className="flex items-center gap-2">
          <span className={`font-medium ${getColorClass()}`}>
            {sizeInfo.formatted}
          </span>
          
          {fileCount !== undefined && (
            <span className="text-xs text-gray-400">
              ({fileCount} file{fileCount !== 1 ? 's' : ''})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Utility component for displaying storage usage bar
interface StorageUsageBarProps {
  usedBytes: number;
  totalBytes: number;
  className?: string;
}

export function StorageUsageBar({ usedBytes, totalBytes, className = '' }: StorageUsageBarProps) {
  const percentage = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  const usedInfo = FileValidationService.formatFileSize(usedBytes);
  const totalInfo = FileValidationService.formatFileSize(totalBytes);

  const getBarColor = () => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between text-sm">
        <span className="text-gray-300">
          {usedInfo.formatted} used of {totalInfo.formatted}
        </span>
        <span className="text-gray-400">
          {percentage.toFixed(1)}%
        </span>
      </div>
      
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${getBarColor()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

// Utility component for file size summary
interface FileSizeSummaryProps {
  files: Array<{ fileSize: number; name: string }>;
  className?: string;
}

export function FileSizeSummary({ files, className = '' }: FileSizeSummaryProps) {
  const totalSize = files.reduce((sum, file) => sum + (file.fileSize || 0), 0);
  const sizeInfo = FileValidationService.formatFileSize(totalSize);
  
  const sizeBuckets = {
    large: files.filter(f => f.fileSize > 10 * 1024 * 1024).length, // > 10MB
    medium: files.filter(f => f.fileSize > 1024 * 1024 && f.fileSize <= 10 * 1024 * 1024).length, // 1-10MB
    small: files.filter(f => f.fileSize <= 1024 * 1024).length, // <= 1MB
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">
          {files.length} files
        </span>
        <span className="text-sm font-medium text-blue-400">
          {sizeInfo.formatted}
        </span>
      </div>
      
      {files.length > 0 && (
        <div className="flex gap-4 text-xs text-gray-400">
          {sizeBuckets.large > 0 && (
            <span>{sizeBuckets.large} large (&gt;10MB)</span>
          )}
          {sizeBuckets.medium > 0 && (
            <span>{sizeBuckets.medium} medium (1-10MB)</span>
          )}
          {sizeBuckets.small > 0 && (
            <span>{sizeBuckets.small} small (&lt;1MB)</span>
          )}
        </div>
      )}
    </div>
  );
}
