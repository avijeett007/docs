import { usePathname } from 'next/navigation';
import { userGuideSteps } from '@/config/userGuideSteps';

export function useContextualGuide() {
  const pathname = usePathname();

  // Map pathnames to guide sections
  const getGuideSection = (): keyof typeof userGuideSteps => {
    if (!pathname) return 'dashboard';

    // Main dashboard tour (sidebar + dashboard) only on /partner/dashboard
    if (pathname === '/partner/dashboard') {
      return 'sidebar'; // This includes both sidebar navigation AND dashboard content
    }

    // Page-specific guides for other routes (content only, no sidebar)
    if (pathname === '/partner/settings') {
      return 'settings';
    }

    if (pathname === '/partner/settings/whitelabel') {
      return 'settings-whitelabel';
    }

    if (pathname === '/partner/settings/api-keys') {
      return 'settings-api-keys';
    }

    if (pathname === '/partner/usage-analytics') {
      return 'usage-analytics';
    }

    if (pathname === '/partner/ai-agents') {
      return 'ai-agents';
    }

    if (pathname === '/partner/ai-agents/retell') {
      return 'ai-agents-retell';
    }

    if (pathname === '/partner/customers') {
      return 'customers';
    }

    if (pathname === '/partner/customers') {
      return 'customers';
    }

    if (pathname === '/partner/billing') {
      return 'billing';
    }

    if (pathname === '/partner/credits') {
      return 'credits';
    }

    if (pathname === '/partner/ai-usage') {
      return 'ai-usage';
    }

    if (pathname === '/partner/usage-analytics') {
      return 'usage-analytics';
    }

    if (pathname.startsWith('/partner/ai-agents')) {
      return 'ai-agents';
    }

    if (pathname === '/partner/marketing') {
      return 'marketing';
    }

    if (pathname === '/partner/tutorials') {
      return 'tutorials';
    }

    if (pathname === '/partner/team') {
      return 'team';
    }

    // Default to a simple dashboard content guide for any other partner routes
    return 'dashboard';
  };

  const currentSection = getGuideSection();
  const steps = userGuideSteps[currentSection]?.steps || [];
  
  // Check if this is the main dashboard tour
  const isMainTour = pathname === '/partner/dashboard';
  
  return {
    currentSection,
    steps,
    isMainTour,
    pathname
  };
}
