'use client';

import React, { useRef } from 'react';
import { PortalTheme, portalThemes } from '@/lib/portalThemes';
import { FiCheck, FiChevronLeft, FiChevronRight, FiStar } from 'react-icons/fi';

interface ThemeSelectorProps {
  selected: PortalTheme;
  onChange: (theme: PortalTheme) => void;
}

// Theme-specific styles that highlight key differences between themes
const getThemePreviewStyles = (themeId: PortalTheme) => {
  switch (themeId) {
    case PortalTheme.MODERN:
      return {
        container: 'bg-gradient-to-br from-gray-800 to-gray-900',
        button: 'bg-blue-500 hover:bg-blue-600 text-white',
        card: 'bg-gray-800/50 border border-gray-700/30 rounded-xl',
        accent: 'bg-blue-500/10 border border-blue-500/20',
        text: 'text-blue-400',
      };
    case PortalTheme.ENTERPRISE:
      return {
        container: 'bg-[#0A1022]',
        button: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        card: 'bg-[#141D3B] border border-indigo-900/30 rounded-md',
        accent: 'bg-indigo-800/10 border border-indigo-800/20',
        text: 'text-indigo-400',
      };
    case PortalTheme.MINIMAL:
      return {
        container: 'bg-gray-950',
        button: 'bg-transparent border-b-2 border-gray-400 text-gray-300',
        card: 'bg-transparent border-b border-gray-800',
        accent: 'border-b border-gray-600',
        text: 'text-gray-300',
      };
    case PortalTheme.BOLD:
      return {
        container: 'bg-black',
        button: 'bg-white hover:bg-gray-100 text-black',
        card: 'bg-gray-900 border-l-2 border-white/50',
        accent: 'bg-white/10 border-l-2 border-white',
        text: 'text-white',
      };
    case PortalTheme.ELEGANT:
      return {
        container: 'bg-gradient-to-b from-[#1A1A2E] to-[#16213E]',
        button: 'bg-gradient-to-r from-[#C9B27D] to-[#D4BC8B] text-[#16213E]',
        card: 'bg-[#1A1A2E]/70 border border-[#C9B27D]/10 rounded-lg',
        accent: 'bg-[#C9B27D]/10 border border-[#C9B27D]/20',
        text: 'text-[#C9B27D]',
      };
    default:
      return {
        container: 'bg-gray-900',
        button: 'bg-blue-500 text-white',
        card: 'bg-gray-800 border border-gray-700',
        accent: 'bg-blue-500/20',
        text: 'text-blue-400',
      };
  }
};

export default function ThemeSelector({ selected, onChange }: ThemeSelectorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };
  
  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };
  
  return (
    <div className="relative">
      {/* Scroll Controls */}
      <button 
        onClick={scrollLeft}
        className="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 z-10 bg-gray-800 hover:bg-gray-700 rounded-full p-2 shadow-lg border border-gray-700"
        aria-label="Scroll left"
      >
        <FiChevronLeft className="text-white" />
      </button>
      
      <button 
        onClick={scrollRight}
        className="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 z-10 bg-gray-800 hover:bg-gray-700 rounded-full p-2 shadow-lg border border-gray-700"
        aria-label="Scroll right"
      >
        <FiChevronRight className="text-white" />
      </button>
      
      {/* Horizontal Scroller */}
      <div 
        ref={scrollContainerRef}
        className="flex gap-6 py-4 px-1 overflow-x-auto snap-x snap-mandatory"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          '::-webkit-scrollbar': { display: 'none' }
        } as React.CSSProperties}
      >
        {Object.values(portalThemes).map((theme) => {
          const styles = getThemePreviewStyles(theme.id);
          
          return (
            <div key={theme.id} className="snap-center">
              <div
                className={`
                  w-60 flex flex-col rounded-lg overflow-hidden cursor-pointer
                  transition-all duration-200 bg-gray-800 border relative
                  ${selected === theme.id 
                    ? 'ring-2 ring-offset-1 ring-blue-500 border-blue-500/50' 
                    : 'border-gray-700 hover:border-gray-500'
                  }
                  ${theme.isPremium ? 'shadow-lg shadow-purple-500/10' : ''}
                `}
                onClick={() => onChange(theme.id)}
              >
                {/* Premium indicator */}
                {theme.isPremium && (
                  <div className="absolute -top-1 -right-1 z-10">
                    <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-bold py-1 px-2 rounded-bl-lg rounded-tr-lg shadow-lg flex items-center">
                      <FiStar className="text-amber-300 mr-1" />
                      PREMIUM
                    </div>
                  </div>
                )}
                {/* Minimalist preview showing key theme differences */}
                <div className={`h-24 relative ${styles.container}`}>
                  {/* Header */}
                  <div className="h-6 flex justify-end px-2 items-center">
                    {/* Login button - key difference between themes */}
                    <div className={`text-xs px-2 py-0.5 rounded ${styles.button}`}>
                      Login
                    </div>
                  </div>
                  
                  {/* Content area */}
                  <div className="p-2 flex">
                    {/* Card - shows styling differences */}
                    <div className={`${styles.card} p-1 w-14 h-14`}></div>
                    
                    {/* Accent element - shows accent styling */}
                    <div className={`${styles.accent} ml-2 p-1.5 h-8 w-20 rounded flex items-center`}>
                      <div className={`${styles.text} text-xs truncate`}>Accent</div>
                    </div>
                  </div>
                  
                  {/* Selected indicator */}
                  {selected === theme.id && (
                    <div className="absolute top-1 left-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow">
                      <FiCheck className="text-white" size={12} />
                    </div>
                  )}
                </div>
                
                {/* Theme info */}
                <div className={`p-3 ${theme.isPremium ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gray-800'}`}>
                  <h3 className={`font-medium text-sm ${theme.isPremium ? 'bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-white' : 'text-white'}`}>{theme.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{theme.description}</p>
                </div>
                
                {/* Add CSS for premium text gradient */}
                {/* Text gradient styling handled via Tailwind classes */}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Scrollbar hiding handled via inline style */}
    </div>
  );
}
