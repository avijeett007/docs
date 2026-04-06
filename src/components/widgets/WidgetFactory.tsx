"use client";

import React from 'react';
import { WidgetConfig } from '@/providers/types';
import SiriWidget from './SiriWidget';
import OrbWidget from './OrbWidget';
import FloatyWidget from './FloatyWidget';
import MinimalWidget from './MinimalWidget';
import RadialWidget from './RadialWidget';
import GlobWidget from './GlobWidget';
import OutboundWidget from './OutboundWidget';

interface WidgetFactoryProps {
  config: WidgetConfig;
  onError?: (error: string) => void;
  onCallStart?: () => void;
  onCallEnd?: () => void;
  onAnalyticsEvent?: (eventType: string, data?: any) => void;
  previewMode?: boolean;
  // Real functionality props
  publicKey?: string;
  accessToken?: string;
  fetchCredentials?: () => Promise<{ publicKey?: string; accessToken?: string }>;
}

const WidgetFactory: React.FC<WidgetFactoryProps> = ({
  config,
  onError,
  onCallStart,
  onCallEnd,
  onAnalyticsEvent,
  previewMode = false,
  publicKey,
  accessToken,
  fetchCredentials
}) => {
  // Handle analytics events
  const handleCallStart = () => {
    onAnalyticsEvent?.('call_start', {
      agentType: config.agentType,
      widgetType: config.widgetType,
      timestamp: Date.now()
    });
    onCallStart?.();
  };

  const handleCallEnd = () => {
    onAnalyticsEvent?.('call_end', {
      agentType: config.agentType,
      widgetType: config.widgetType,
      timestamp: Date.now()
    });
    onCallEnd?.();
  };

  const handleError = (error: string) => {
    onAnalyticsEvent?.('error', {
      agentType: config.agentType,
      widgetType: config.widgetType,
      error,
      timestamp: Date.now()
    });
    onError?.(error);
  };

  // Render the appropriate widget based on type
  switch (config.widgetType) {
    case 'siri':
      return (
        <SiriWidget
          config={config}
          onError={handleError}
          onCallStart={handleCallStart}
          onCallEnd={handleCallEnd}
          previewMode={previewMode}
          publicKey={publicKey}
          accessToken={accessToken}
          fetchCredentials={fetchCredentials}
        />
      );

    case 'orb':
      return (
        <OrbWidget
          config={config}
          onError={handleError}
          onCallStart={handleCallStart}
          onCallEnd={handleCallEnd}
          previewMode={previewMode}
          publicKey={publicKey}
          accessToken={accessToken}
          fetchCredentials={fetchCredentials}
        />
      );

    case 'floaty':
      return (
        <FloatyWidget
          config={config}
          onError={handleError}
          onCallStart={handleCallStart}
          onCallEnd={handleCallEnd}
          previewMode={previewMode}
          publicKey={publicKey}
          accessToken={accessToken}
          fetchCredentials={fetchCredentials}
        />
      );

    case 'minimal':
      return (
        <MinimalWidget
          config={config}
          onError={handleError}
          onCallStart={handleCallStart}
          onCallEnd={handleCallEnd}
          previewMode={previewMode}
          publicKey={publicKey}
          accessToken={accessToken}
          fetchCredentials={fetchCredentials}
        />
      );

    case 'radial':
      return (
        <RadialWidget
          config={config}
          onError={handleError}
          onCallStart={handleCallStart}
          onCallEnd={handleCallEnd}
          previewMode={previewMode}
          publicKey={publicKey}
          accessToken={accessToken}
          fetchCredentials={fetchCredentials}
        />
      );

    case 'glob':
      return (
        <GlobWidget
          config={config}
          onError={handleError}
          onCallStart={handleCallStart}
          onCallEnd={handleCallEnd}
          previewMode={previewMode}
          publicKey={publicKey}
          accessToken={accessToken}
          fetchCredentials={fetchCredentials}
        />
      );

    case 'outbound':
      return (
        <OutboundWidget
          config={config}
          onError={handleError}
          onCallStart={handleCallStart}
          onCallEnd={handleCallEnd}
          previewMode={previewMode}
          publicKey={publicKey}
          accessToken={accessToken}
          fetchCredentials={fetchCredentials}
        />
      );

    default:
      return (
        <div className="flex items-center justify-center p-4 text-red-500">
          <p>Unsupported widget type: {config.widgetType}</p>
        </div>
      );
  }
};

export default WidgetFactory;
