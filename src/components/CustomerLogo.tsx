import React from 'react';

interface CustomerLogoProps {
  size?: number;
  primaryColor?: string;
  secondaryColor?: string;
  className?: string;
}

const CustomerLogo: React.FC<CustomerLogoProps> = ({ 
  size = 40,
  primaryColor = '#6366f1',
  secondaryColor = '#8b5cf6',
  className = ''
}) => {
  const logoSize = `${size}px`;

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {/* Logo Icon */}
      <div className="relative" style={{ width: logoSize, height: logoSize }}>
        <div className="absolute inset-0 rounded-lg opacity-70 animate-pulse" 
          style={{ background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }} />
        <div className="absolute inset-0 rounded-lg blur-sm" 
          style={{ background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }} />
        <div className="absolute inset-0 bg-gray-900 rounded-lg transform rotate-45">
          <div className="absolute inset-0.5 bg-gray-900 rounded-lg" />
        </div>
        <span className="absolute inset-0 flex items-center justify-center font-bold text-transparent bg-clip-text"
          style={{ background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }}>
          K
        </span>
      </div>
    </div>
  );
};

export default CustomerLogo;
