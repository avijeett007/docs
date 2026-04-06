'use client';

import React, { useRef } from 'react';
import { PortalMode, portalModes, PartnerTier, canAccessPortalMode, canAccessPortalModeWithManualSaaS } from '@/lib/portalModes';
import { FiCheck, FiChevronLeft, FiChevronRight, FiStar, FiLock, FiClock } from 'react-icons/fi';
import Image from 'next/image';

interface PortalModeSelectorProps {
  selected: PortalMode;
  onChange: (mode: PortalMode) => void;
  partnerTier: PartnerTier;
  manualSaasModeEnabled?: boolean;
  onUpgradeRequired?: (mode: PortalMode) => void;
}

export default function PortalModeSelector({
  selected,
  onChange,
  partnerTier,
  manualSaasModeEnabled = false,
  onUpgradeRequired
}: PortalModeSelectorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -280, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 280, behavior: 'smooth' });
    }
  };

  const handleModeClick = (mode: PortalMode) => {
    const canAccess = canAccessPortalModeWithManualSaaS(partnerTier, mode, manualSaasModeEnabled);

    if (!canAccess && onUpgradeRequired) {
      onUpgradeRequired(mode);
      return;
    }

    if (canAccess) {
      onChange(mode);
    }
  };

  return (
    <div className="relative">
      {/* Navigation Arrows */}
      <button
        onClick={scrollLeft}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-full flex items-center justify-center transition-colors"
        aria-label="Scroll left"
      >
        <FiChevronLeft className="text-gray-300" size={16} />
      </button>
      
      <button
        onClick={scrollRight}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-full flex items-center justify-center transition-colors"
        aria-label="Scroll right"
      >
        <FiChevronRight className="text-gray-300" size={16} />
      </button>
      
      {/* Horizontal Scroller */}
      <div 
        ref={scrollContainerRef}
        className="flex gap-6 py-4 px-1 overflow-x-auto snap-x snap-mandatory"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {Object.values(portalModes).map((mode) => {
          const canAccess = canAccessPortalModeWithManualSaaS(partnerTier, mode.id, manualSaasModeEnabled);
          const isSelected = selected === mode.id;
          
          return (
            <div key={mode.id} className="snap-center">
              <div
                className={`
                  w-72 flex flex-col rounded-lg overflow-hidden cursor-pointer
                  transition-all duration-200 bg-gray-800 border relative
                  ${isSelected 
                    ? 'ring-2 ring-offset-1 ring-blue-500 border-blue-500/50' 
                    : canAccess 
                      ? 'border-gray-700 hover:border-gray-500'
                      : 'border-gray-700/50 opacity-75'
                  }
                  ${mode.isPremium ? 'shadow-lg shadow-purple-500/10' : ''}
                `}
                onClick={() => handleModeClick(mode.id)}
              >
                {/* Status indicators */}
                <div className="absolute top-2 right-2 z-10 flex gap-1">
                  {mode.isUpcoming && (
                    <div className="bg-amber-500 text-white text-xs font-bold py-1 px-2 rounded-full shadow-lg flex items-center">
                      <FiClock className="mr-1" size={10} />
                      UPCOMING
                    </div>
                  )}
                  {mode.isPremium && (
                    <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-bold py-1 px-2 rounded-full shadow-lg flex items-center">
                      <FiStar className="text-amber-300 mr-1" size={10} />
                      PREMIUM
                    </div>
                  )}
                  {!canAccess && (
                    <div className="bg-red-500 text-white text-xs font-bold py-1 px-2 rounded-full shadow-lg flex items-center">
                      <FiLock className="mr-1" size={10} />
                      LOCKED
                    </div>
                  )}
                </div>

                {/* Preview Image */}
                <div className="relative h-40 bg-gray-900 flex items-center justify-center">
                  {mode.previewImage ? (
                    <Image
                      src={mode.previewImage}
                      alt={`${mode.name} preview`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 288px"
                    />
                  ) : (
                    <div className="text-gray-500 text-sm">Preview Coming Soon</div>
                  )}
                  
                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute top-2 left-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow">
                      <FiCheck className="text-white" size={14} />
                    </div>
                  )}
                  
                  {/* Overlay for locked modes */}
                  {!canAccess && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <FiLock className="text-white" size={24} />
                    </div>
                  )}
                </div>
                
                {/* Mode info */}
                <div className={`p-4 ${mode.isPremium ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gray-800'}`}>
                  <h3 className={`font-medium text-sm mb-1 ${
                    mode.isPremium 
                      ? 'bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-white' 
                      : canAccess 
                        ? 'text-white' 
                        : 'text-gray-400'
                  }`}>
                    {mode.name}
                  </h3>
                  <p className={`text-xs mt-1 line-clamp-2 ${canAccess ? 'text-gray-400' : 'text-gray-500'}`}>
                    {mode.description}
                  </p>
                  
                  {!canAccess && (
                    <div className="mt-2 text-xs text-amber-400 font-medium">
                      Upgrade required
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
