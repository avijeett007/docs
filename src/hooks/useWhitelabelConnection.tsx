"use client"

import React, { createContext, useState, useCallback, useContext } from "react";
import { useToast } from "@/components/toast/ToasterProvider";

export type WhitelabelConnectionMode = "whitelabel"

type WhitelabelConnectionDetails = {
  wsUrl: string;
  token: string;
  shouldConnect: boolean;
  mode: WhitelabelConnectionMode;
};

type WhitelabelConnectionContextType = {
  wsUrl: string;
  token: string;
  shouldConnect: boolean;
  mode: WhitelabelConnectionMode;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const WhitelabelConnectionContext = createContext<WhitelabelConnectionContextType | undefined>(undefined);

export const WhitelabelConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setToastMessage } = useToast();
  const [connectionDetails, setConnectionDetails] = useState<WhitelabelConnectionDetails>({
    wsUrl: "",
    token: "",
    shouldConnect: false,
    mode: "whitelabel"
  });

  const connect = useCallback(
    async () => {
      let token = "";
      let url = "";
      try {
        // Use the whitelabel-specific token endpoint
        if (!process.env.NEXT_PUBLIC_LIVEKIT_URL) {
          throw new Error("NEXT_PUBLIC_LIVEKIT_URL is not set");
        }
        url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        
        const response = await fetch("/api/whitelabel/token");
        if (!response.ok) {
          throw new Error("Failed to fetch whitelabel token");
        }
        const { accessToken } = await response.json();
        token = accessToken;

        setConnectionDetails({
          wsUrl: url,
          token,
          shouldConnect: true,
          mode: "whitelabel"
        });

        setToastMessage({
          type: "success",
          message: "Connected to Voice AI Agent successfully!"
        });
      } catch (error) {
        console.error('❌ WhitelabelConnection: Connection failed:', error);
        setToastMessage({
          type: "error",
          message: `Failed to connect: ${(error as Error).message}`
        });
        throw error;
      }
    },
    [setToastMessage]
  );

  const disconnect = useCallback(
    async () => {
      setConnectionDetails({
        wsUrl: "",
        token: "",
        shouldConnect: false,
        mode: "whitelabel"
      });
      
      setToastMessage({
        type: "info",
        message: "Disconnected from Voice AI Agent"
      });
    },
    [setToastMessage]
  );

  return (
    <WhitelabelConnectionContext.Provider
      value={{
        wsUrl: connectionDetails.wsUrl,
        token: connectionDetails.token,
        shouldConnect: connectionDetails.shouldConnect,
        mode: connectionDetails.mode,
        connect,
        disconnect,
      }}
    >
      {children}
    </WhitelabelConnectionContext.Provider>
  );
};

export const useWhitelabelConnection = () => {
  const context = useContext(WhitelabelConnectionContext);
  if (context === undefined) {
    throw new Error("useWhitelabelConnection must be used within a WhitelabelConnectionProvider");
  }
  return context;
};
