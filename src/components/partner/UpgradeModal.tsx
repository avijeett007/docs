'use client';

import { useRouter } from 'next/navigation';
import { FiX } from 'react-icons/fi';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  upgradeButtonText?: string;
}

export default function UpgradeModal({
  isOpen,
  onClose,
  title = 'Prospects Feature',
  message = 'Track and manage your SaaS portal prospects with our Ultimate Scale Agency tier or enable SaaS Mode.',
  upgradeButtonText = 'Upgrade to Ultimate Scale Agency'
}: UpgradeModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    onClose();
    router.push('/partner/settings#subscription');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <FiX className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            {title}
          </h2>
          <p className="text-gray-300 mb-6">
            {message}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpgrade}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
            >
              {upgradeButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

