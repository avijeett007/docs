'use client';

import { useState, useEffect } from 'react';
import { getEmbedContextFromCookies, shouldHideFeatureInEmbed } from '@/lib/embedTokenAuth';

interface EmbedContext {
  isEmbedded: boolean;
  accessMode?: string;
  embedTokenId?: string;
  embedTokenName?: string;
}

export function useEmbedContext() {
  const [embedContext, setEmbedContext] = useState<EmbedContext>({ isEmbedded: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const context = getEmbedContextFromCookies();
    setEmbedContext(context || { isEmbedded: false });
    setIsLoading(false);
  }, []);

  const shouldHideFeature = (feature: string): boolean => {
    if (!embedContext.isEmbedded || !embedContext.accessMode) {
      return false;
    }
    return shouldHideFeatureInEmbed(feature, embedContext.accessMode);
  };

  const getAccessModeLabel = (): string => {
    if (!embedContext.accessMode) return '';
    
    switch (embedContext.accessMode) {
      case 'full': return 'Full Access';
      case 'readonly': return 'Read Only';
      case 'lite': return 'Lite Access';
      default: return embedContext.accessMode;
    }
  };

  const getAccessModeColor = (): string => {
    if (!embedContext.accessMode) return 'text-gray-400';
    
    switch (embedContext.accessMode) {
      case 'full': return 'text-green-400';
      case 'readonly': return 'text-amber-400';
      case 'lite': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  return {
    ...embedContext,
    isLoading,
    shouldHideFeature,
    getAccessModeLabel,
    getAccessModeColor,
  };
}
