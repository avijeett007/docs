// Provider factory for dynamic provider loading

import { VoiceProvider, ProviderConfig, ProviderName, ProviderSDKUrls, ProviderGlobalChecks } from './types';
import { VapiProvider } from './VapiProvider';
import { RetellProvider } from './RetellProvider';
import { UltravoxProvider } from './UltravoxProvider';
import { KnovaProvider } from './KnovaProvider';
import { ElevenLabsProvider } from './ElevenLabsProvider';

export class ProviderFactory {
  private static sdkUrls: ProviderSDKUrls = {
    vapi: 'https://cdn.jsdelivr.net/npm/@vapi-ai/web@latest/dist/index.umd.js',
    retell: 'https://unpkg.com/retell-client-js-sdk@latest/dist/index.umd.js',
    ultravox: 'https://unpkg.com/ultravox-client@latest/dist/ultravox-client.umd.js',
    knova: 'https://unpkg.com/livekit-client@latest/dist/livekit-client.umd.js',
    elevenlabs: 'https://unpkg.com/@elevenlabs/client@latest/dist/index.umd.js'
  };

  private static globalChecks: ProviderGlobalChecks = {
    vapi: () => typeof window !== 'undefined' && typeof (window as any).Vapi !== 'undefined',
    retell: () => typeof window !== 'undefined' && typeof (window as any).retellClientJsSdk !== 'undefined' && typeof (window as any).retellClientJsSdk.RetellWebClient !== 'undefined',
    ultravox: () => typeof window !== 'undefined' && typeof (window as any).UltravoxSession !== 'undefined',
    knova: () => typeof window !== 'undefined' && typeof (window as any).LiveKit !== 'undefined',
    elevenlabs: () => typeof window !== 'undefined' && typeof (window as any).Conversation !== 'undefined'
  };

  static async createProvider(
    providerName: ProviderName,
    config: ProviderConfig
  ): Promise<VoiceProvider> {
    // Ensure SDK is loaded
    await this.loadSDK(providerName);

    switch (providerName) {
      case 'vapi':
        return new VapiProvider(config);
      case 'retell':
        return new RetellProvider(config);
      case 'ultravox':
        return new UltravoxProvider(config);
      case 'knova':
        return new KnovaProvider(config);
      case 'elevenlabs':
        return new ElevenLabsProvider(config);
      default:
        throw new Error(`Unsupported provider: ${providerName}`);
    }
  }

  static async loadSDK(providerName: ProviderName): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('SDK loading is only supported in browser environment');
    }

    // Check if SDK is already loaded
    if (this.globalChecks[providerName]()) {
      return;
    }

    const sdkUrl = this.sdkUrls[providerName];
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = sdkUrl;
      script.async = true;
      
      script.onload = () => {
        // Wait a bit for the global to be available
        setTimeout(() => {
          if (this.globalChecks[providerName]()) {
            resolve();
          } else {
            reject(new Error(`${providerName} SDK failed to load properly`));
          }
        }, 100);
      };
      
      script.onerror = () => {
        reject(new Error(`Failed to load ${providerName} SDK from ${sdkUrl}`));
      };
      
      document.head.appendChild(script);
    });
  }

  static preloadAllSDKs(): void {
    if (typeof window === 'undefined') return;

    // Preload all common SDKs
    Object.values(this.sdkUrls).forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      link.as = 'script';
      document.head.appendChild(link);
    });
  }

  static isSDKLoaded(providerName: ProviderName): boolean {
    return this.globalChecks[providerName]();
  }

  static getSupportedProviders(): ProviderName[] {
    return ['vapi', 'retell', 'ultravox', 'knova', 'elevenlabs'];
  }
}
