'use client';

import React from 'react';
import { FiKey, FiCheck, FiX, FiClock, FiAlertTriangle, FiInfo } from 'react-icons/fi';

interface ApiKeyStatusBadgeProps {
  status: 'not_set' | 'valid' | 'invalid' | 'expired' | 'rate_limited' | 'revoked';
  usingPartnerKey?: boolean;
  lastVerified?: string;
  showDetails?: boolean;
  className?: string;
}

export function ApiKeyStatusBadge({
  status,
  usingPartnerKey = false,
  lastVerified,
  showDetails = false,
  className = ''
}: ApiKeyStatusBadgeProps) {
  const getStatusConfig = () => {
    if (usingPartnerKey) {
      return {
        icon: FiInfo,
        color: 'text-amber-600',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-300',
        label: 'Partner Key',
        description: 'Using partner API key as fallback'
      };
    }

    switch (status) {
      case 'valid':
        return {
          icon: FiCheck,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          borderColor: 'border-green-300',
          label: 'Valid',
          description: 'API key is working correctly'
        };
      case 'invalid':
        return {
          icon: FiX,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-300',
          label: 'Invalid',
          description: 'API key verification failed'
        };
      case 'expired':
        return {
          icon: FiClock,
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          borderColor: 'border-orange-300',
          label: 'Expired',
          description: 'API key has expired'
        };
      case 'rate_limited':
        return {
          icon: FiAlertTriangle,
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          borderColor: 'border-orange-300',
          label: 'Rate Limited',
          description: 'API key is rate limited'
        };
      case 'revoked':
        return {
          icon: FiX,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-300',
          label: 'Revoked',
          description: 'API key has been revoked'
        };
      case 'not_set':
      default:
        return {
          icon: FiKey,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-300',
          label: 'Not Set',
          description: 'No API key configured'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const formatLastVerified = (dateString?: string) => {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString();
    } catch {
      return null;
    }
  };

  const lastVerifiedText = formatLastVerified(lastVerified);

  if (showDetails) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bgColor} ${config.borderColor} ${className}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${config.color}`}>
            {config.label}
          </span>
          {lastVerifiedText && (
            <span className="text-xs text-gray-500">
              Verified {lastVerifiedText}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${config.bgColor} ${config.color} ${className}`}
      title={`${config.description}${lastVerifiedText ? ` • Verified ${lastVerifiedText}` : ''}`}
    >
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
    </div>
  );
}

export default ApiKeyStatusBadge;
