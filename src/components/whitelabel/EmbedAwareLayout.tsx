'use client';

import React from 'react';
import { useEmbedContext } from '@/hooks/useEmbedContext';
import { EmbedStatusIndicator } from './EmbedAwareNavigation';

interface EmbedAwareLayoutProps {
  children: React.ReactNode;
  showEmbedIndicator?: boolean;
  className?: string;
}

export default function EmbedAwareLayout({
  children,
  showEmbedIndicator = true,
  className = '',
}: EmbedAwareLayoutProps) {
  const { isEmbedded, isLoading } = useEmbedContext();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`${className} ${isEmbedded ? 'embed-mode' : ''}`}>
      {isEmbedded && showEmbedIndicator && <EmbedStatusIndicator />}
      {children}
      
      {/* Add embed-specific styles */}
      {isEmbedded && (
        <style jsx global>{`
          .embed-mode {
            /* Adjust styles for embedded context */
            --embed-padding: 1rem;
          }
          
          .embed-mode .sidebar {
            /* Hide or adjust sidebar in embed mode if needed */
          }
          
          .embed-mode .header {
            /* Adjust header for embed mode */
          }
          
          /* Hide certain elements in embed mode */
          .embed-mode .hide-in-embed {
            display: none !important;
          }
          
          /* Adjust spacing in embed mode */
          .embed-mode .container {
            padding: var(--embed-padding);
          }
        `}</style>
      )}
    </div>
  );
}

// Higher-order component to wrap pages with embed awareness
export function withEmbedAwareness<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    showEmbedIndicator?: boolean;
    requiredAccessModes?: string[];
    blockedFeatures?: string[];
  } = {}
) {
  return function EmbedAwareComponent(props: P) {
    const { isEmbedded, accessMode, shouldHideFeature } = useEmbedContext();
    
    // Check if current access mode is allowed
    if (options.requiredAccessModes && isEmbedded && accessMode) {
      if (!options.requiredAccessModes.includes(accessMode)) {
        return (
          <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Access Restricted</h2>
              <p className="text-gray-400">
                This page requires {options.requiredAccessModes.join(' or ')} access mode.
              </p>
            </div>
          </div>
        );
      }
    }
    
    // Check if any blocked features are being accessed
    if (options.blockedFeatures && isEmbedded) {
      const hasBlockedFeature = options.blockedFeatures.some(feature => 
        shouldHideFeature(feature)
      );
      
      if (hasBlockedFeature) {
        return (
          <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Feature Not Available</h2>
              <p className="text-gray-400">
                This feature is not available in your current access mode.
              </p>
            </div>
          </div>
        );
      }
    }
    
    return (
      <EmbedAwareLayout showEmbedIndicator={options.showEmbedIndicator}>
        <Component {...props} />
      </EmbedAwareLayout>
    );
  };
}

// Embed-aware page wrapper for specific restrictions
export function EmbedRestrictedPage({
  children,
  feature,
  accessModes,
  fallback,
}: {
  children: React.ReactNode;
  feature?: string;
  accessModes?: string[];
  fallback?: React.ReactNode;
}) {
  const { isEmbedded, accessMode, shouldHideFeature } = useEmbedContext();
  
  // If not embedded, show normally
  if (!isEmbedded) {
    return <>{children}</>;
  }
  
  // Check access mode restrictions
  if (accessModes && accessMode && !accessModes.includes(accessMode)) {
    return fallback || (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-400 mb-2">Access Restricted</h3>
        <p className="text-gray-500">
          This page requires {accessModes.join(' or ')} access mode.
        </p>
      </div>
    );
  }
  
  // Check feature restrictions
  if (feature && shouldHideFeature(feature)) {
    return fallback || (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-400 mb-2">Feature Not Available</h3>
        <p className="text-gray-500">
          This feature is not available in your current access mode.
        </p>
      </div>
    );
  }
  
  return <>{children}</>;
}
