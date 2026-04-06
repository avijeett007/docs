'use client';

import React from 'react';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';
import { FiMic, FiPhone, FiHeadphones, FiUser, FiBarChart2 } from 'react-icons/fi';

interface PortalPreviewProps {
  theme: PortalTheme;
  branding: {
    businessName: string;
    logo?: string;
    primaryColor: string;
    secondaryColor: string;
    portalTitle?: string;
    portalSlogan?: string;
    fontFamily?: string;
  };
}

export default function PortalPreview({ theme, branding }: PortalPreviewProps) {
  const themeConfig = getThemeConfig(theme);

  // Derived values from branding
  const title = branding.portalTitle || `${branding.businessName} AI Portal`;
  const slogan = branding.portalSlogan || 'Powered by advanced voice AI technology';
  const font = branding.fontFamily || 'Inter';

  return (
    <div className="w-full rounded-lg overflow-hidden shadow-lg border border-gray-700 bg-gray-900">
      {/* Preview Header */}
      <div
        className={`p-4 flex items-center justify-between border-b border-gray-800 ${themeConfig.styleClasses.header}`}
        style={{ fontFamily: font }}
      >
        <div className="flex items-center space-x-2">
          {branding.logo ? (
            <div
              className="w-8 h-8 rounded-md bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${branding.logo})` }}
            ></div>
          ) : (
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-sm"
              style={{ background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})` }}
            >
              {branding.businessName.substring(0, 1)}
            </div>
          )}
          <span className="text-white font-medium text-sm truncate max-w-[120px] relative z-10">{title}</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            className={`text-xs px-2 py-1 rounded text-white ${themeConfig.styleClasses.button.secondary}`}
          >
            Login
          </button>
          <button
            className={`text-xs px-2 py-1 rounded text-white ${themeConfig.styleClasses.button.primary}`}
            style={{ backgroundColor: branding.primaryColor }}
          >
            Sign Up
          </button>
        </div>
      </div>

      {/* Preview Hero */}
      <div
        className={`${themeConfig.styleClasses.hero} p-4 space-y-2`}
        style={{ fontFamily: font }}
      >
        <h3
          className="text-lg font-bold relative z-10"
          style={{
            color: branding.primaryColor,
            textShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}
        >
          {title}
        </h3>
        <p className="text-xs text-gray-300">{slogan}</p>

        <div className="flex items-center space-x-3 mt-2">
          <div className="flex h-6">
            <FiMic
              className="w-4 h-4"
              style={{ color: branding.primaryColor }}
            />
            <FiHeadphones
              className="w-4 h-4 -ml-1"
              style={{ color: branding.secondaryColor }}
            />
          </div>
          <span className="text-xs text-gray-400">VAPI & Retell Integration</span>
        </div>
      </div>

      {/* Preview Features */}
      <div className={`p-4 grid grid-cols-2 gap-2`}>
        <div
          className={`p-2 ${themeConfig.styleClasses.card}`}
          style={{ fontFamily: font }}
        >
          <div
            className={`${themeConfig.styleClasses.featureIcon} mb-2 inline-block`}
            style={{ backgroundColor: `${branding.primaryColor}20` }}
          >
            <FiPhone
              className="w-3 h-3"
              style={{ color: branding.primaryColor }}
            />
          </div>
          <h4 className="text-xs font-medium text-white">Voice Agents</h4>
          <p className="text-xs text-gray-400 mt-1">Manage your AI voice agents</p>
        </div>

        <div
          className={`p-2 ${themeConfig.styleClasses.card}`}
          style={{ fontFamily: font }}
        >
          <div
            className={`${themeConfig.styleClasses.featureIcon} mb-2 inline-block`}
            style={{ backgroundColor: `${branding.secondaryColor}20` }}
          >
            <FiBarChart2
              className="w-3 h-3"
              style={{ color: branding.secondaryColor }}
            />
          </div>
          <h4 className="text-xs font-medium text-white">Analytics</h4>
          <p className="text-xs text-gray-400 mt-1">Track call performance metrics</p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 text-center text-xs text-gray-500 border-t border-gray-800">
        © {branding.businessName} - {new Date().getFullYear()}
      </div>
    </div>
  );
}
