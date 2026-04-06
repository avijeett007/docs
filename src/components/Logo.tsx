import React from 'react';
import navigationConfig from '../config/dashboard/navigation.json';

interface LogoProps {
  collapsed?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ collapsed = false, className = '' }) => {
  const logoText = collapsed ? 'K-AI' : navigationConfig.brand.name;
  const textSize = collapsed ? 'text-lg' : 'text-xl';

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {/* Logo Icon */}
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-teal-500 rounded-lg opacity-70 animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-teal-500 rounded-lg blur-sm" />
        <div className="absolute inset-0 bg-gray-900 rounded-lg transform rotate-45">
          <div className="absolute inset-0.5 bg-gray-900 rounded-lg" />
        </div>
        <span className="absolute inset-0 flex items-center justify-center font-bold text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text">
          K
        </span>
      </div>

      {/* Brand Text */}
      <div className={`flex items-center transition-all duration-300 ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
        <span className={`font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-blue-100/90 bg-clip-text text-transparent ${textSize}`}>
          {logoText}
        </span>
        <span className="ml-1 text-sm font-semibold text-teal-500 dark:text-teal-400">
          {!collapsed && navigationConfig.brand.suffix}
        </span>
      </div>
    </div>
  );
};

export default Logo;
