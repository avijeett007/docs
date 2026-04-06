import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import navigationConfig from '../config/dashboard/navigation.json';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface CustomerSidebarLogoProps {
  collapsed?: boolean;
  className?: string;
}

const CustomerSidebarLogo: React.FC<CustomerSidebarLogoProps> = ({ collapsed = false, className = '' }) => {
  const { branding } = usePartnerBranding();
  const { businessName, logo, primaryColor, secondaryColor } = branding;
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);
  const [logoError, setLogoError] = useState(false);
  
  // Reset logo state when logo URL changes
  useEffect(() => {
    setIsLogoLoaded(false);
    setLogoError(false);
  }, [logo]);

  const displayName = businessName || 'Knotie-AI';
  const displaySuffix = 'Pro';
  const textSize = collapsed ? 'text-lg' : 'text-xl';

  // Use partner colors for gradient if available
  const fromColor = primaryColor || '#3b82f6'; // Default blue
  const toColor = secondaryColor || '#2dd4bf'; // Default teal

  // If we have a valid logo, only show the logo at a much larger size
  if (logo && !logoError) {
    // Much larger logo size for partner logos
    const logoContainerSize = collapsed ? 'w-20 h-14' : 'w-40 h-14';
    const logoWidth = collapsed ? 80 : 160;
    const logoHeight = collapsed ? 56 : 56;
    
    return (
      <div className={`flex items-center ${className}`}>
        <div className={`relative ${logoContainerSize} flex-shrink-0 flex items-center justify-start`}>
          <Image 
            src={logo} 
            alt={businessName || 'Partner Logo'} 
            width={logoWidth}
            height={logoHeight}
            className="object-contain max-h-full"
            onLoad={() => setIsLogoLoaded(true)}
            onError={() => setLogoError(true)}
            style={{ maxWidth: '100%' }}
            priority
          />
        </div>
      </div>
    );
  }

  // If no logo or logo error, show company name with default logo (smaller size)
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="relative w-8 h-8 flex-shrink-0">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-teal-500 opacity-90"></div>
        <div className="absolute inset-0.5 rounded-full bg-gray-900 flex items-center justify-center">
          <span className="text-white font-bold text-lg">K</span>
        </div>
      </div>
      {!collapsed && (
        <div className="flex items-center">
          <span className={`font-bold text-transparent bg-clip-text ${textSize}`}
                style={{ 
                  backgroundImage: `linear-gradient(to right, ${fromColor}, ${toColor})`,
                  WebkitBackgroundClip: 'text'
                }}>
            {displayName}
          </span>
          <span className="ml-1 text-sm font-semibold" 
                style={{ color: toColor }}>
            {displaySuffix}
          </span>
        </div>
      )}
    </div>
  );
};

export default CustomerSidebarLogo;
