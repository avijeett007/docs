import React from 'react';

interface GHLIconProps {
  className?: string;
  size?: number;
}

export default function GHLIcon({ className = '', size = 20 }: GHLIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* GHL Logo - Stylized "G" with modern design */}
      <path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
        fill="currentColor"
        opacity="0.3"
      />
      <path
        d="M16 8H8c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h3v-2H8v-4h8v2h-3v2h3c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2z"
        fill="currentColor"
      />
      <circle cx="15" cy="9" r="1" fill="currentColor" />
    </svg>
  );
}
