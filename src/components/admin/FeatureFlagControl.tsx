'use client';

import React, { useState, useEffect } from 'react';
import { FiFlag, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

/**
 * Admin component for controlling feature flags during testing
 * This is only visible to admins and allows quick toggling of feature flags
 */
export default function FeatureFlagControl() {
  const [flags, setFlags] = useState({
    whitelabel: localStorage.getItem('NEXT_PUBLIC_FEATURE_WHITELABEL') === 'true',
    whitelabelThemes: localStorage.getItem('NEXT_PUBLIC_FEATURE_WHITELABEL_THEMES') === 'true',
    whitelabelCustomization: localStorage.getItem('NEXT_PUBLIC_FEATURE_WHITELABEL_CUSTOMIZATION') === 'true',
    whitelabelSubdomains: localStorage.getItem('NEXT_PUBLIC_FEATURE_WHITELABEL_SUBDOMAINS') === 'true',
    liveMemberNotifications: localStorage.getItem('NEXT_PUBLIC_FEATURE_LIVE_MEMBER_NOTIFICATIONS') === 'true',
    providerPhoneImport: localStorage.getItem('NEXT_PUBLIC_FEATURE_PROVIDER_PHONE_IMPORT') === 'true'
  });
  
  const [expanded, setExpanded] = useState(false);
  
  useEffect(() => {
    // Set initial values from localStorage or env vars
    const initialFlags = {
      whitelabel: localStorage.getItem('NEXT_PUBLIC_FEATURE_WHITELABEL') === 'true',
      whitelabelThemes: localStorage.getItem('NEXT_PUBLIC_FEATURE_WHITELABEL_THEMES') === 'true',
      whitelabelCustomization: localStorage.getItem('NEXT_PUBLIC_FEATURE_WHITELABEL_CUSTOMIZATION') === 'true',
      whitelabelSubdomains: localStorage.getItem('NEXT_PUBLIC_FEATURE_WHITELABEL_SUBDOMAINS') === 'true',
      liveMemberNotifications: localStorage.getItem('NEXT_PUBLIC_FEATURE_LIVE_MEMBER_NOTIFICATIONS') === 'true',
      providerPhoneImport: localStorage.getItem('NEXT_PUBLIC_FEATURE_PROVIDER_PHONE_IMPORT') === 'true'
    };
    
    setFlags(initialFlags);
  }, []);
  
  const toggleFlag = (key: keyof typeof flags) => {
    setFlags(prev => {
      const newValue = !prev[key];
      
      // Update localStorage with proper key mapping
      const keyMapping: Record<string, string> = {
        whitelabel: 'WHITELABEL',
        whitelabelThemes: 'WHITELABEL_THEMES',
        whitelabelCustomization: 'WHITELABEL_CUSTOMIZATION',
        whitelabelSubdomains: 'WHITELABEL_SUBDOMAINS',
        liveMemberNotifications: 'LIVE_MEMBER_NOTIFICATIONS',
        providerPhoneImport: 'PROVIDER_PHONE_IMPORT'
      };

      const envKey = keyMapping[key] || key.toUpperCase();
      localStorage.setItem(`NEXT_PUBLIC_FEATURE_${envKey}`, newValue.toString());
      
      // Return updated state
      return { ...prev, [key]: newValue };
    });
  };
  
  const getToggleIcon = (enabled: boolean) => {
    return enabled ? 
      <FiToggleRight className="w-6 h-6 text-green-400" /> : 
      <FiToggleLeft className="w-6 h-6 text-gray-500" />;
  };

  if (!expanded) {
    return (
      <button 
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 p-3 bg-gray-800 rounded-full shadow-lg hover:bg-gray-700 z-50 border border-gray-700"
        title="Feature Flag Controls"
      >
        <FiFlag className="w-5 h-5 text-amber-400" />
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50 w-80 overflow-hidden">
      <div className="p-3 bg-gray-800 flex justify-between items-center">
        <div className="flex items-center">
          <FiFlag className="w-5 h-5 text-amber-400 mr-2" />
          <h3 className="font-medium text-white">Feature Flag Controls</h3>
        </div>
        <button 
          onClick={() => setExpanded(false)}
          className="p-1 hover:bg-gray-700 rounded"
        >
          <FiToggleLeft className="w-5 h-5 text-gray-400" />
        </button>
      </div>
      
      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-400 mb-2">Toggle features for testing. Page will reload when changed.</p>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-white">White-Label Features</label>
            <button 
              onClick={() => {
                toggleFlag('whitelabel');
                setTimeout(() => window.location.reload(), 500);
              }}
              className="focus:outline-none"
            >
              {getToggleIcon(flags.whitelabel)}
            </button>
          </div>
          
          <div className="flex items-center justify-between pl-4">
            <label className="text-sm text-gray-400">Theme Selection</label>
            <button 
              onClick={() => {
                toggleFlag('whitelabelThemes');
                setTimeout(() => window.location.reload(), 500);
              }}
              className="focus:outline-none"
              disabled={!flags.whitelabel}
            >
              {getToggleIcon(flags.whitelabelThemes)}
            </button>
          </div>
          
          <div className="flex items-center justify-between pl-4">
            <label className="text-sm text-gray-400">Customization</label>
            <button 
              onClick={() => {
                toggleFlag('whitelabelCustomization');
                setTimeout(() => window.location.reload(), 500);
              }}
              className="focus:outline-none"
              disabled={!flags.whitelabel}
            >
              {getToggleIcon(flags.whitelabelCustomization)}
            </button>
          </div>
          
          <div className="flex items-center justify-between pl-4">
            <label className="text-sm text-gray-400">Subdomains</label>
            <button 
              onClick={() => {
                toggleFlag('whitelabelSubdomains');
                setTimeout(() => window.location.reload(), 500);
              }}
              className="focus:outline-none"
              disabled={!flags.whitelabel}
            >
              {getToggleIcon(flags.whitelabelSubdomains)}
            </button>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between">
            <label className="text-sm text-white">Live Member Notifications</label>
            <button
              onClick={() => {
                toggleFlag('liveMemberNotifications');
                setTimeout(() => window.location.reload(), 500);
              }}
              className="focus:outline-none"
            >
              {getToggleIcon(flags.liveMemberNotifications)}
            </button>
          </div>
          <p className="text-xs text-gray-500 pl-0">Show popup notifications when members join (performance testing)</p>
        </div>

        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between">
            <label className="text-sm text-white">Provider Phone Import</label>
            <button
              onClick={() => {
                toggleFlag('providerPhoneImport');
                setTimeout(() => window.location.reload(), 500);
              }}
              className="focus:outline-none"
            >
              {getToggleIcon(flags.providerPhoneImport)}
            </button>
          </div>
          <p className="text-xs text-gray-500 pl-0">Import phone numbers from agent providers (Retell, VAPI, etc.)</p>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-800">
          <p className="text-xs text-gray-500">These settings only affect your current browser session.</p>
        </div>
      </div>
    </div>
  );
}
