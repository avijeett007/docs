'use client';

import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2 
      className={`animate-spin ${sizeClasses[size]} ${className}`} 
    />
  );
}

interface LoadingButtonProps {
  loading: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export function LoadingButton({ 
  loading, 
  children, 
  disabled, 
  className = '', 
  onClick,
  type = 'button'
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={`relative inline-flex items-center justify-center ${className} ${
        loading || disabled ? 'opacity-75 cursor-not-allowed' : ''
      }`}
    >
      {loading && (
        <LoadingSpinner 
          size="sm" 
          className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2" 
        />
      )}
      <span className={loading ? 'invisible' : 'visible'}>
        {children}
      </span>
    </button>
  );
}

interface LoadingOverlayProps {
  loading: boolean;
  children: React.ReactNode;
  message?: string;
  className?: string;
}

export function LoadingOverlay({ 
  loading, 
  children, 
  message = 'Loading...', 
  className = '' 
}: LoadingOverlayProps) {
  return (
    <div className={`relative ${className}`}>
      {children}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="text-center">
            <LoadingSpinner size="lg" className="text-blue-600 mb-2" />
            <p className="text-sm text-[#45556C]">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

export function Skeleton({ className = '', animate = true }: SkeletonProps) {
  return (
    <div
      className={`bg-[#E2E8F0] rounded ${animate ? 'animate-pulse' : ''} ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`p-4 border border-gray-200 rounded-lg ${className}`}>
      <div className="flex items-center space-x-3 mb-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/2 mb-2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

interface LoadingStateProps {
  loading: boolean;
  error?: Error | null;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  onRetry?: () => void;
}

export function LoadingState({
  loading,
  error,
  children,
  loadingComponent,
  errorComponent,
  onRetry,
}: LoadingStateProps) {
  if (loading) {
    return (
      <div>
        {loadingComponent || (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <LoadingSpinner size="lg" className="text-blue-600 mb-2" />
              <p className="text-sm text-gray-600">Loading...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {errorComponent || (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="text-red-500 mb-2">
                <RefreshCw className="h-8 w-8 mx-auto" />
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {error.message || 'Something went wrong'}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return <div>{children}</div>;
}

interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
  showPercentage?: boolean;
  animated?: boolean;
}

export function ProgressBar({ 
  progress, 
  className = '', 
  showPercentage = false,
  animated = true 
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-1">
        {showPercentage && (
          <span className="text-sm text-gray-600">{Math.round(clampedProgress)}%</span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <motion.div
          className="bg-blue-600 h-2 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: animated ? 0.5 : 0 }}
        />
      </div>
    </div>
  );
}

interface PulsingDotProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PulsingDot({ className = '', size = 'md' }: PulsingDotProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  return (
    <div className={`${sizeClasses[size]} bg-blue-600 rounded-full animate-pulse ${className}`} />
  );
}

export function TypingIndicator({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <PulsingDot size="sm" />
      <PulsingDot size="sm" className="animation-delay-200" />
      <PulsingDot size="sm" className="animation-delay-400" />
    </div>
  );
}

/**
 * Hook for managing loading states
 */
export function useLoadingState(initialLoading = false) {
  const [loading, setLoading] = React.useState(initialLoading);
  const [error, setError] = React.useState<Error | null>(null);

  const startLoading = React.useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  const stopLoading = React.useCallback(() => {
    setLoading(false);
  }, []);

  const setLoadingError = React.useCallback((error: Error) => {
    setLoading(false);
    setError(error);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const reset = React.useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return {
    loading,
    error,
    startLoading,
    stopLoading,
    setLoadingError,
    clearError,
    reset,
  };
}
