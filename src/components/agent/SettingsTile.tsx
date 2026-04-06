import React from 'react';
import { motion as m } from 'framer-motion';

interface SettingsTileProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export const SettingsTile: React.FC<SettingsTileProps> = ({
  active,
  onClick,
  children
}) => {
  return (
    <m.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full p-4 rounded-lg border ${
        active
          ? 'bg-blue-500/10 border-blue-500 text-blue-500'
          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
      } transition-colors text-left`}
    >
      {children}
    </m.button>
  );
};
