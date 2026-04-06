import React, { useState } from 'react';
import { FiHelpCircle } from 'react-icons/fi';

interface PricingTooltipProps {
  title: string;
  description: string;
}

const PricingTooltip: React.FC<PricingTooltipProps> = ({ title, description }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="text-blue-300/70 hover:text-blue-300 transition-colors duration-200 ml-2"
      >
        <FiHelpCircle className="w-4 h-4" />
      </button>
      
      {isVisible && (
        <div className="absolute z-50 w-64 p-4 mt-2 -right-2 transform translate-x-full bg-gray-800 rounded-lg shadow-xl border border-blue-400/20 backdrop-blur-xl">
          <div className="text-sm font-medium text-white mb-1">{title}</div>
          <div className="text-xs text-blue-100/70">{description}</div>
          <div className="absolute left-0 top-4 -ml-2 w-2 h-2 bg-gray-800 border-l border-t border-blue-400/20 transform -translate-x-1/2 rotate-45" />
        </div>
      )}
    </div>
  );
};

export default PricingTooltip;
