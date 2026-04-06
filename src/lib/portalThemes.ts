// Theme definitions for white-label portals
export enum PortalTheme {
  MODERN = 'MODERN',
  ENTERPRISE = 'ENTERPRISE',
  MINIMAL = 'MINIMAL',
  BOLD = 'BOLD',
  ELEGANT = 'ELEGANT',
  PREMIUM = 'PREMIUM',
}

export interface ThemeConfig {
  id: PortalTheme;
  name: string;
  description: string;
  isPremium?: boolean;
  imagePreview: string;
  animation: 'fade' | 'slide' | 'zoom' | 'bounce';
  styleClasses: {
    container: string;
    header: string;
    hero: string;
    card: string;
    button: {
      primary: string;
      secondary: string;
    };
    featureIcon: string;
    text: {
      primary: string;
      secondary: string;
      muted: string;
    };
  };
  lightMode?: {
    container: string;
    header: string;
    hero: string;
    card: string;
    button: {
      primary: string;
      secondary: string;
    };
    featureIcon: string;
    text: {
      primary: string;
      secondary: string;
      muted: string;
    };
  };
}

export const portalThemes: Record<PortalTheme, ThemeConfig> = {
  [PortalTheme.MODERN]: {
    id: PortalTheme.MODERN,
    name: 'Azure',
    description: 'A premium SaaS experience with fluid animations and depth',
    imagePreview: '/themes/modern-preview.png',
    animation: 'fade',
    styleClasses: {
      container: 'bg-gradient-to-br from-gray-900 to-gray-800',
      header: 'backdrop-blur-lg bg-gray-900/90 border-b border-gray-800/40 shadow-sm',
      hero: 'bg-gradient-to-r from-gray-800/80 to-gray-900/80 backdrop-blur-md rounded-xl p-8 shadow-lg',
      card: 'bg-gray-800/50 backdrop-blur-md rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-700/30',
      button: {
        primary: 'rounded-lg shadow-lg transform transition-all hover:scale-105 font-medium text-white px-5 py-2',
        secondary: 'rounded-lg border border-gray-600 bg-gray-800/50 hover:bg-gray-700 transition-colors px-4 py-2'
      },
      featureIcon: 'p-3 rounded-xl bg-opacity-20 shadow-inner',
      text: {
        primary: 'text-white',
        secondary: 'text-gray-300',
        muted: 'text-gray-400'
      }
    },
    lightMode: {
      container: 'bg-gradient-to-br from-gray-50 to-white',
      header: 'backdrop-blur-lg bg-white/90 border-b border-gray-200/40 shadow-sm',
      hero: 'bg-gradient-to-r from-white/80 to-gray-50/80 backdrop-blur-md rounded-xl p-8 shadow-lg border border-gray-200/30',
      card: 'bg-white/70 backdrop-blur-md rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200/50',
      button: {
        primary: 'rounded-lg shadow-lg transform transition-all hover:scale-105 font-medium text-white px-5 py-2',
        secondary: 'rounded-lg border border-gray-300 bg-white/50 hover:bg-gray-50 transition-colors px-4 py-2 text-gray-700'
      },
      featureIcon: 'p-3 rounded-xl bg-opacity-20 shadow-inner',
      text: {
        primary: 'text-gray-900',
        secondary: 'text-gray-700',
        muted: 'text-gray-600'
      }
    }
  },
  [PortalTheme.ENTERPRISE]: {
    id: PortalTheme.ENTERPRISE,
    name: 'Cobalt',
    description: 'Professional and sophisticated design with structured layouts',
    imagePreview: '/themes/enterprise-preview.png',
    animation: 'slide',
    styleClasses: {
      container: 'bg-[#0A1022] bg-gradient-to-b from-[#0A1022] to-[#111936]',
      header: 'bg-[#0A1022]/95 border-b border-indigo-900/20 shadow-md',
      hero: 'bg-[#111936] border border-indigo-900/20 rounded-lg p-6 shadow-md',
      card: 'bg-[#141D3B] border border-indigo-900/30 rounded-md hover:shadow-md transition-all duration-300',
      button: {
        primary: 'rounded-md font-medium shadow-sm hover:shadow-md transition-all bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2',
        secondary: 'rounded-md border border-indigo-800/50 bg-[#141D3B] hover:bg-[#1A2547] transition-colors px-3 py-2'
      },
      featureIcon: 'p-2.5 rounded-md border border-indigo-800/30 bg-indigo-900/10',
      text: {
        primary: 'text-white',
        secondary: 'text-indigo-200',
        muted: 'text-indigo-300'
      }
    }
  },
  [PortalTheme.MINIMAL]: {
    id: PortalTheme.MINIMAL,
    name: 'Slate',
    description: 'Clean, distraction-free interface with elegant typography',
    imagePreview: '/themes/minimal-preview.png',
    animation: 'zoom',
    styleClasses: {
      container: 'bg-gray-950',
      header: 'bg-gray-950 border-b border-gray-800/50',
      hero: 'bg-transparent py-8',
      card: 'bg-transparent border-b border-gray-800/50 pb-6 hover:bg-gray-900/20 transition-colors',
      button: {
        primary: 'rounded-none border-b-2 hover:bg-gray-800/50 transition-colors px-4 py-2 font-light tracking-wide',
        secondary: 'rounded-none border-b border-gray-700/50 bg-transparent hover:border-gray-500 transition-colors px-3 py-1.5'
      },
      featureIcon: 'pb-2 border-b border-gray-700/50',
      text: {
        primary: 'text-white',
        secondary: 'text-gray-300',
        muted: 'text-gray-500'
      }
    }
  },
  [PortalTheme.BOLD]: {
    id: PortalTheme.BOLD,
    name: 'Onyx',
    description: 'High-contrast design with strong visual elements',
    imagePreview: '/themes/bold-preview.png',
    animation: 'bounce',
    styleClasses: {
      container: 'bg-black',
      header: 'bg-black border-b-2 border-white/20',
      hero: 'bg-gradient-to-r from-black to-gray-900 rounded-none p-8 border-l-4 border-white',
      card: 'bg-gray-900 rounded-none hover:translate-x-1 transition-all duration-300 border-l-2 border-white/50',
      button: {
        primary: 'rounded-none bg-white text-black hover:bg-gray-300 transition-colors font-bold uppercase tracking-wider text-sm px-5 py-2.5',
        secondary: 'rounded-none border-2 border-white/70 bg-transparent hover:bg-white/10 transition-colors uppercase tracking-wide text-xs px-4 py-2'
      },
      featureIcon: 'p-2 bg-white/10',
      text: {
        primary: 'text-white',
        secondary: 'text-gray-200',
        muted: 'text-gray-400'
      }
    }
  },
  [PortalTheme.ELEGANT]: {
    id: PortalTheme.ELEGANT,
    name: 'Amber',
    description: 'Refined design with subtle animations and luxury feel',
    imagePreview: '/themes/elegant-preview.png',
    animation: 'fade',
    styleClasses: {
      container: 'bg-gradient-to-b from-[#1A1A2E] to-[#16213E]',
      header: 'bg-[#1A1A2E]/90 backdrop-blur-md border-b border-[#C9B27D]/10',
      hero: 'bg-[#16213E] backdrop-filter backdrop-blur-sm rounded-lg p-8 border border-[#C9B27D]/20',
      card: 'bg-[#1A1A2E]/70 backdrop-blur-sm rounded-lg hover:shadow-[0_0_15px_rgba(201,178,125,0.1)] transition-all duration-500 border border-[#C9B27D]/10',
      button: {
        primary: 'rounded-md bg-gradient-to-r from-[#C9B27D] to-[#D4BC8B] text-[#16213E] hover:opacity-90 transition-opacity font-medium px-4 py-2',
        secondary: 'rounded-md border border-[#C9B27D]/30 bg-transparent hover:bg-[#C9B27D]/10 transition-colors px-3 py-1.5'
      },
      featureIcon: 'p-2.5 rounded-full bg-[#C9B27D]/10 border border-[#C9B27D]/20',
      text: {
        primary: 'text-white',
        secondary: 'text-[#C9B27D]',
        muted: 'text-[#C9B27D]/70'
      }
    }
  },
  [PortalTheme.PREMIUM]: {
    id: PortalTheme.PREMIUM,
    name: 'Quantum',
    description: 'Advanced theme with enhanced customization options and premium effects',
    isPremium: true,
    imagePreview: '/themes/premium-preview.png',
    animation: 'zoom',
    styleClasses: {
      container: 'bg-gradient-to-br from-[#0F172A] to-[#0F172A] bg-[url("/patterns/grid.svg")] bg-fixed',
      header: 'backdrop-blur-lg bg-black/40 border-b border-purple-900/30 shadow-lg shadow-purple-500/5',
      hero: 'backdrop-blur-lg bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-xl p-8 shadow-xl border border-purple-500/20',
      card: 'backdrop-blur-md bg-white/5 rounded-lg border border-purple-500/10 shadow-xl shadow-purple-500/5 hover:shadow-purple-500/20 transition-all duration-300 hover:-translate-y-1',
      button: {
        primary: 'rounded-lg shadow-lg text-white font-medium px-5 py-2.5 relative overflow-hidden transition-all duration-300 bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-500 hover:scale-105',
        secondary: 'rounded-lg border border-purple-500/30 backdrop-blur-md bg-black/30 hover:bg-black/50 transition-colors px-4 py-2 hover:border-purple-500/50'
      },
      featureIcon: 'p-3 rounded-xl bg-purple-900/20 border border-purple-500/20 shadow-inner',
      text: {
        primary: 'text-white',
        secondary: 'text-purple-200',
        muted: 'text-purple-300'
      }
    },
    lightMode: {
      container: 'bg-gradient-to-br from-gray-50 to-white min-h-screen',
      header: 'bg-white/95 border-b border-gray-200 shadow-sm',
      hero: 'bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-8 shadow-lg border border-purple-200/30',
      card: 'bg-white rounded-lg border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1',
      button: {
        primary: 'rounded-lg shadow-lg text-white font-medium px-5 py-2.5 relative overflow-hidden transition-all duration-300 bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-500 hover:scale-105',
        secondary: 'rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors px-4 py-2 hover:border-gray-400 text-gray-700'
      },
      featureIcon: 'p-3 rounded-xl bg-purple-100 border border-purple-200 shadow-sm',
      text: {
        primary: 'text-gray-900',
        secondary: 'text-gray-700',
        muted: 'text-gray-600'
      }
    }
  }
};

export type PartnerThemePreferences = {
  theme: PortalTheme;
  animation: boolean;
  darkMode: boolean;
  customCardStyle?: string;
  customButtonStyle?: string;
};

// Default theme to use if not specified
export const defaultTheme = PortalTheme.MODERN;

// Get theme configuration
export function getThemeConfig(theme: PortalTheme, isLightMode?: boolean): ThemeConfig {
  const baseTheme = portalThemes[theme] || portalThemes[defaultTheme];

  // If light mode is requested and available, merge light mode styles
  if (isLightMode && baseTheme.lightMode) {
    return {
      ...baseTheme,
      styleClasses: baseTheme.lightMode
    };
  }

  return baseTheme;
}

// Animations based on theme
export const themeAnimations = {
  fade: 'transition-opacity duration-700 ease-in-out',
  slide: 'transition-transform duration-700 ease-in-out',
  zoom: 'transition-all duration-700 ease-in-out',
  bounce: 'transition-transform duration-500 ease-in-out'
};

export const animationVariants = {
  fade: {
    hidden: 'opacity-0',
    visible: 'opacity-100'
  },
  slide: {
    hidden: 'translate-y-10 opacity-0',
    visible: 'translate-y-0 opacity-100'
  },
  zoom: {
    hidden: 'scale-95 opacity-0',
    visible: 'scale-100 opacity-100'
  },
  bounce: {
    hidden: 'translate-y-4 opacity-0',
    visible: 'translate-y-0 opacity-100 animate-bounce-once'
  }
};
