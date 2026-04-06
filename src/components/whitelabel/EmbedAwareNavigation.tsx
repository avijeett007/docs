'use client';

import React from 'react';
import { useEmbedContext } from '@/hooks/useEmbedContext';
import { FiShield, FiInfo } from 'react-icons/fi';

interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon?: React.ComponentType<any>;
  feature?: string; // Feature identifier for embed restrictions
}

interface EmbedAwareNavigationProps {
  items: NavigationItem[];
  children: (filteredItems: NavigationItem[]) => React.ReactNode;
}

export default function EmbedAwareNavigation({ items, children }: EmbedAwareNavigationProps) {
  const { isEmbedded, shouldHideFeature, isLoading } = useEmbedContext();

  if (isLoading) {
    return null; // Or a loading skeleton
  }

  const filteredItems = items.filter(item => {
    if (!isEmbedded || !item.feature) {
      return true; // Show all items if not embedded or no feature restriction
    }
    return !shouldHideFeature(item.feature);
  });

  return <>{children(filteredItems)}</>;
}

// Embed status indicator component
export function EmbedStatusIndicator() {
  const { isEmbedded, embedTokenName, getAccessModeLabel, getAccessModeColor } = useEmbedContext();

  if (!isEmbedded) {
    return null;
  }

  return (
    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 text-sm">
        <FiShield className="w-4 h-4 text-purple-400" />
        <span className="text-purple-300 font-medium">Embedded Access</span>
        {embedTokenName && (
          <span className="text-gray-400">• {embedTokenName}</span>
        )}
        <span className={`ml-auto ${getAccessModeColor()}`}>
          {getAccessModeLabel()}
        </span>
      </div>
    </div>
  );
}

// Component to conditionally render content based on embed context
interface EmbedConditionalProps {
  showInEmbed?: boolean;
  hideInEmbed?: boolean;
  accessModes?: string[]; // Only show for specific access modes
  feature?: string; // Hide if feature is restricted
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function EmbedConditional({
  showInEmbed = true,
  hideInEmbed = false,
  accessModes,
  feature,
  children,
  fallback = null,
}: EmbedConditionalProps) {
  const { isEmbedded, accessMode, shouldHideFeature } = useEmbedContext();

  // If hideInEmbed is true and we're embedded, don't show
  if (hideInEmbed && isEmbedded) {
    return <>{fallback}</>;
  }

  // If showInEmbed is false and we're embedded, don't show
  if (!showInEmbed && isEmbedded) {
    return <>{fallback}</>;
  }

  // If accessModes is specified and current mode is not in the list, don't show
  if (accessModes && isEmbedded && accessMode && !accessModes.includes(accessMode)) {
    return <>{fallback}</>;
  }

  // If feature is specified and should be hidden, don't show
  if (feature && shouldHideFeature(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Embed-aware button that shows different states based on access mode
interface EmbedAwareButtonProps {
  feature?: string;
  readonlyMessage?: string;
  liteMessage?: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function EmbedAwareButton({
  feature,
  readonlyMessage = 'This action is not available in read-only mode',
  liteMessage = 'This feature is not available in lite mode',
  children,
  onClick,
  className = '',
  disabled = false,
}: EmbedAwareButtonProps) {
  const { isEmbedded, accessMode, shouldHideFeature } = useEmbedContext();

  // If feature should be hidden, don't render the button
  if (feature && shouldHideFeature(feature)) {
    return null;
  }

  // If in readonly or lite mode and feature is restricted, show disabled state
  const isRestricted = isEmbedded && feature && (
    (accessMode === 'readonly' && shouldHideFeature(feature)) ||
    (accessMode === 'lite' && shouldHideFeature(feature))
  );

  const handleClick = () => {
    if (isRestricted) {
      const message = accessMode === 'readonly' ? readonlyMessage : liteMessage;
      alert(message); // You might want to use a proper toast/modal here
      return;
    }
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      disabled={Boolean(disabled || isRestricted)}
      className={`${className} ${isRestricted ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isRestricted ? (accessMode === 'readonly' ? readonlyMessage : liteMessage) : undefined}
    >
      {children}
    </button>
  );
}

// Embed-aware form wrapper that can disable form submission in readonly mode
interface EmbedAwareFormProps {
  feature?: string;
  onSubmit?: (e: React.FormEvent) => void;
  children: React.ReactNode;
  className?: string;
}

export function EmbedAwareForm({
  feature,
  onSubmit,
  children,
  className = '',
}: EmbedAwareFormProps) {
  const { isEmbedded, accessMode, shouldHideFeature } = useEmbedContext();

  const isReadonly = isEmbedded && (accessMode === 'readonly' || (feature && shouldHideFeature(feature)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isReadonly) {
      alert('Form submission is not available in read-only mode');
      return;
    }
    
    onSubmit?.(e);
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <fieldset disabled={Boolean(isReadonly)}>
        {children}
      </fieldset>
      {isReadonly && (
        <div className="mt-2 flex items-center gap-2 text-sm text-amber-400">
          <FiInfo className="w-4 h-4" />
          <span>Form editing is disabled in read-only mode</span>
        </div>
      )}
    </form>
  );
}
