'use client';

import React, { useEffect } from 'react';
import { LiveKitRoom, StartAudio, RoomAudioRenderer } from '@livekit/components-react';
import { useWhitelabelConnection } from '@/hooks/useWhitelabelConnection';
import { useKrispNoiseFilter } from '@livekit/components-react/krisp';
import WhitelabelVoiceAgent from './WhitelabelVoiceAgent';

interface WhitelabelVoiceAgentWithLiveKitProps {
  className?: string;
}

// Component that uses Krisp inside LiveKitRoom context for whitelabel
function WhitelabelKrispEnabledRoom() {
  const krisp = useKrispNoiseFilter();

  // Enable noise filter by default when it becomes available
  useEffect(() => {
    if (!krisp.isNoiseFilterPending && !krisp.isNoiseFilterEnabled) {
      console.log('🎯 Whitelabel Krisp: Enabling noise filter by default');
      krisp.setNoiseFilterEnabled(true).catch((error) => {
        console.warn('⚠️ Whitelabel Krisp: Failed to enable noise filter:', error);
      });
    }
  }, [krisp, krisp.isNoiseFilterPending, krisp.isNoiseFilterEnabled, krisp.setNoiseFilterEnabled]);

  return (
    <>
      <StartAudio label="Start Audio" />
      <RoomAudioRenderer />
    </>
  );
}

const WhitelabelVoiceAgentWithLiveKit = ({ className }: WhitelabelVoiceAgentWithLiveKitProps) => {
  const { wsUrl, token, shouldConnect, connect, disconnect } = useWhitelabelConnection();

  const handleConnect = async () => {
    if (shouldConnect) {
      console.log('🔴 WhitelabelVoiceAgentWithLiveKit: Disconnecting...');
      await disconnect();
    } else {
      console.log('🟢 WhitelabelVoiceAgentWithLiveKit: Connecting...');
      await connect();
    }
  };

  return (
    <>
      {token && wsUrl ? (
        <LiveKitRoom
          token={token}
          serverUrl={wsUrl}
          connect={shouldConnect}
          // Only enable audio by default, video can be enabled later
          audio={true}
          video={false}
          onDisconnected={() => {
            console.log('✅ LiveKitRoom: Room disconnected successfully');
            // Ensure we clean up properly
            if (!shouldConnect) {
              disconnect();
            }
          }}
        >
          <WhitelabelKrispEnabledRoom />
        </LiveKitRoom>
      ) : null}
      <WhitelabelVoiceAgent 
        onStartCall={handleConnect} 
        isConnected={Boolean(token && wsUrl && shouldConnect)}
        className={className}
      />
    </>
  );
};

export default WhitelabelVoiceAgentWithLiveKit;
