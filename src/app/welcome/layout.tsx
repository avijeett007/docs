'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { Inter, Poppins, Roboto, Montserrat } from 'next/font/google';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';

// Font definitions
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins'
});
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-roboto'
});
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-montserrat'
});

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { branding, loading } = usePartnerBranding();
  const [brandingApplied, setBrandingApplied] = useState(false);
  const [isRedirectingToSaaS, setIsRedirectingToSaaS] = useState(false);

  // Handle SaaS mode detection and redirection
  useEffect(() => {
    if (branding && branding.portalMode === 'SAAS') {
      console.log('🚀 WELCOME LAYOUT - SaaS mode detected, redirecting...');
      setIsRedirectingToSaaS(true);
      // Quick redirect to SaaS landing page
      setTimeout(() => {
        router.push('/whitelabel/saas');
      }, 200);
    }
  }, [branding, router]);

  // Set document title and favicon whenever branding changes
  useEffect(() => {
    if (branding && branding.businessName) {
      const pageTitle = branding.portalTitle || `${branding.businessName} AI Portal`;
      document.title = pageTitle;

      // Set a small timeout to ensure all branding is applied before showing content
      setTimeout(() => {
        setBrandingApplied(true);
      }, 100);
    }
  }, [branding]);

  // Separate effect for favicon to ensure it runs whenever branding data changes
  useEffect(() => {
    if (branding?.favicon) {
      try {
        // Find existing favicon elements and update their href instead of removing them
        const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
        let faviconUpdated = false;

        existingFavicons.forEach(link => {
          const linkElement = link as HTMLLinkElement;
          // Update existing favicon hrefs to our custom favicon
          if (linkElement.rel === 'icon' || linkElement.rel === 'shortcut icon') {
            linkElement.href = branding.favicon!;
            linkElement.setAttribute('data-custom-favicon', 'true');
            faviconUpdated = true;
          }
        });

        // If no existing favicon was found, create new ones
        if (!faviconUpdated) {
          const faviconLink = document.createElement('link');
          faviconLink.rel = 'icon';
          faviconLink.href = branding.favicon;
          faviconLink.setAttribute('data-custom-favicon', 'true');
          faviconLink.type = 'image/x-icon';
          document.head.appendChild(faviconLink);

          const shortcutLink = document.createElement('link');
          shortcutLink.rel = 'shortcut icon';
          shortcutLink.href = branding.favicon;
          shortcutLink.setAttribute('data-custom-favicon', 'true');
          shortcutLink.type = 'image/x-icon';
          document.head.appendChild(shortcutLink);
        }

        // Force favicon refresh by adding a timestamp
        setTimeout(() => {
          const allFavicons = document.querySelectorAll('link[rel*="icon"]');
          allFavicons.forEach(link => {
            const linkElement = link as HTMLLinkElement;
            const originalHref = linkElement.href.split('?')[0];
            linkElement.href = originalHref + '?t=' + Date.now();
          });
        }, 100);
      } catch (error) {
        console.error('Error setting custom favicon:', error);
      }
    }
  }, [branding]);

  // Determine which font to use based on partner branding
  const getFontClassName = () => {
    switch (branding.fontFamily?.toLowerCase()) {
      case 'poppins':
        return poppins.variable;
      case 'roboto':
        return roboto.variable;
      case 'montserrat':
        return montserrat.variable;
      default: // Inter is the default
        return inter.variable;
    }
  };

  // Get theme config based on partner preference or default to Modern theme
  const theme = (branding.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme);

  // Set CSS variables for the welcome portal based on partner branding and theme
  const brandingStyles = {
    '--brand-primary-color': branding.primaryColor,
    '--brand-secondary-color': branding.secondaryColor,
    '--brand-font-family': `var(--font-${branding.fontFamily?.toLowerCase() || 'inter'})`,
    '--theme-container': themeConfig.styleClasses.container,
    '--theme-header': themeConfig.styleClasses.header,
    '--theme-hero': themeConfig.styleClasses.hero,
    '--theme-card': themeConfig.styleClasses.card,
    '--theme-button-primary': themeConfig.styleClasses.button.primary,
    '--theme-button-secondary': themeConfig.styleClasses.button.secondary,
    '--theme-feature-icon': themeConfig.styleClasses.featureIcon,
  } as React.CSSProperties;

  console.log('🎨 WELCOME LAYOUT - Theme:', theme);
  console.log('🎨 WELCOME LAYOUT - Theme config:', themeConfig);
  console.log('🎨 WELCOME LAYOUT - Branding applied:', brandingApplied);

  // Show SaaS redirection loading (minimal and professional)
  if (isRedirectingToSaaS) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-400 mx-auto"></div>
          <p className="mt-4 text-gray-300">Redirecting to your portal...</p>
        </div>
      </div>
    );
  }

  // Show enhanced loading state while fetching branding or before branding is fully applied
  if (loading || !branding || !branding.businessName || !brandingApplied) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-400 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading portal...</p>
          {branding && branding.businessName && !brandingApplied && (
            <p className="mt-2 text-sm text-gray-500">Applying {branding.businessName} branding...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${getFontClassName()} font-sans min-h-screen text-white ${themeConfig.styleClasses.container}`}
      style={brandingStyles}
    >
      {children}
    </div>
  );
}
