'use client';

import { useState, useEffect } from 'react';
import { FiX, FiAlertTriangle, FiClock, FiArrowRight, FiMinimize2, FiWifi } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface WebhookMigrationPopupProps {
  partnerId: string;
  agentsWithoutWebhooks: number;
  totalAgents: number;
  onDismiss: () => void;
}

export default function WebhookMigrationPopup({ 
  partnerId, 
  agentsWithoutWebhooks,
  totalAgents,
  onDismiss 
}: WebhookMigrationPopupProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Calculate time left until webhook migration deadline (1 week from now)
  useEffect(() => {
    const calculateTimeLeft = () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 7); // 1 week from now
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        setTimeLeft(`${days} days, ${hours} hours`);
      } else {
        setTimeLeft('Webhook migration deadline passed');
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000 * 60 * 60); // Update every hour

    return () => clearInterval(timer);
  }, []);

  // Auto-minimize after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMinimized(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleExpand = () => {
    setIsMinimized(false);
  };

  const handleClose = () => {
    setIsVisible(false);
    onDismiss();
  };

  const handleMigrateNow = () => {
    // Navigate to migration page
    window.location.href = '/partner/agents/migration';
  };

  if (!isVisible || agentsWithoutWebhooks === 0) return null;

  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <div 
          onClick={handleExpand}
          className="cursor-pointer rounded-lg shadow-lg p-3 flex items-center gap-2 max-w-xs bg-orange-500 text-white"
        >
          <FiWifi className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium truncate">
            Webhook Migration Required
          </span>
          <div className="flex items-center gap-1 text-xs">
            <FiClock className="w-3 h-3" />
            <span>{timeLeft}</span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative border-l-4 border-orange-500"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-100 text-orange-600">
                <FiWifi className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Webhook Migration Required
              </h3>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={handleMinimize}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Minimize"
              >
                <FiMinimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Close"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              You have <strong>{agentsWithoutWebhooks} out of {totalAgents} agents</strong> that need webhook migration. 
              We're transitioning to webhook-based analytics for better performance and real-time data.
            </p>

            <div className="p-3 rounded-lg flex items-center gap-2 mb-4 bg-orange-50 border border-orange-200">
              <FiClock className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-orange-800">
                  Time remaining: {timeLeft}
                </p>
                <p className="text-xs text-orange-600">
                  Until API-based analytics are disabled
                </p>
              </div>
            </div>

            <div className="text-sm text-gray-600 space-y-2">
              <p><strong>What's changing:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Real-time webhook-based analytics</li>
                <li>Faster data processing and updates</li>
                <li>Improved reliability and performance</li>
                <li>Your existing webhook URLs will be preserved</li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              This notification will minimize automatically
            </div>
            
            <button
              onClick={handleMigrateNow}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-orange-500 hover:bg-orange-600 text-white"
            >
              Migrate Webhooks
              <FiArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
