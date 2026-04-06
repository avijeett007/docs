'use client';

import { useState, useEffect } from 'react';
import { FiX, FiAlertTriangle, FiClock, FiArrowRight, FiMinimize2 } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface MigrationWarningPopupProps {
  partnerId: string;
  hasAgents: boolean;
  isFirstTimeUser: boolean;
  onDismiss: () => void;
}

export default function MigrationWarningPopup({ 
  partnerId, 
  hasAgents, 
  isFirstTimeUser, 
  onDismiss 
}: MigrationWarningPopupProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Calculate time left until June 14th
  useEffect(() => {
    const calculateTimeLeft = () => {
      const targetDate = new Date('2025-06-14T00:00:00Z');
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        setTimeLeft(`${days} days, ${hours} hours`);
      } else {
        setTimeLeft('Migration deadline passed');
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000 * 60 * 60); // Update every hour

    return () => clearInterval(timer);
  }, []);

  // Auto-minimize after 10 seconds if not first time user
  useEffect(() => {
    if (!isFirstTimeUser && hasAgents) {
      const timer = setTimeout(() => {
        setIsMinimized(true);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [isFirstTimeUser, hasAgents]);

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
    // Navigate to agents page
    window.location.href = '/partner/ai-agents';
  };

  if (!isVisible) return null;

  // Different content for first-time users vs existing users
  const content = isFirstTimeUser ? {
    type: 'info' as const,
    title: 'Welcome to Knotie AI Pro 5.0!',
    message: 'Great news! You\'re starting with our latest agent-level API key system and webhook-based analytics. No migration needed!',
    actionText: 'Get Started',
    urgency: false
  } : {
    type: 'warning' as const,
    title: 'Action Required: Migrate to Knotie AI Pro 5.0',
    message: hasAgents 
      ? 'We\'re upgrading to agent-level API keys and webhook-based analytics. Please migrate your agents before June 14th, or we\'ll automatically apply these changes.'
      : 'We\'re upgrading to agent-level API keys and webhook-based analytics. Import your first agent to get started with the new system.',
    actionText: hasAgents ? 'Migrate Agents' : 'Import Agents',
    urgency: true
  };

  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <div 
          onClick={handleExpand}
          className={`
            cursor-pointer rounded-lg shadow-lg p-3 flex items-center gap-2 max-w-xs
            ${content.type === 'warning' 
              ? 'bg-amber-500 text-white' 
              : 'bg-blue-500 text-white'
            }
          `}
        >
          <FiAlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium truncate">
            {content.urgency ? 'Migration Required' : 'Welcome to 5.0!'}
          </span>
          {content.urgency && (
            <div className="flex items-center gap-1 text-xs">
              <FiClock className="w-3 h-3" />
              <span>{timeLeft}</span>
            </div>
          )}
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
          className={`
            bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative
            ${content.type === 'warning' ? 'border-l-4 border-amber-500' : 'border-l-4 border-blue-500'}
          `}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`
                p-2 rounded-full
                ${content.type === 'warning' 
                  ? 'bg-amber-100 text-amber-600' 
                  : 'bg-blue-100 text-blue-600'
                }
              `}>
                <FiAlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {content.title}
              </h3>
            </div>
            
            <div className="flex items-center gap-1">
              {!isFirstTimeUser && (
                <button
                  onClick={handleMinimize}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Minimize"
                >
                  <FiMinimize2 className="w-4 h-4" />
                </button>
              )}
              {isFirstTimeUser && (
                <button
                  onClick={handleClose}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Close"
                >
                  <FiX className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              {content.message}
            </p>

            {content.urgency && (
              <div className={`
                p-3 rounded-lg flex items-center gap-2 mb-4
                ${content.type === 'warning' 
                  ? 'bg-amber-50 border border-amber-200' 
                  : 'bg-blue-50 border border-blue-200'
                }
              `}>
                <FiClock className={`w-4 h-4 ${content.type === 'warning' ? 'text-amber-600' : 'text-blue-600'}`} />
                <div>
                  <p className={`text-sm font-medium ${content.type === 'warning' ? 'text-amber-800' : 'text-blue-800'}`}>
                    Time remaining: {timeLeft}
                  </p>
                  <p className={`text-xs ${content.type === 'warning' ? 'text-amber-600' : 'text-blue-600'}`}>
                    Until automatic migration on June 14th, 2025
                  </p>
                </div>
              </div>
            )}

            {hasAgents && content.urgency && (
              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>What's changing:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Individual API keys for each agent</li>
                  <li>Webhook-based analytics (faster & more reliable)</li>
                  <li>Enhanced security and performance</li>
                </ul>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {!isFirstTimeUser && 'This notification will minimize automatically'}
            </div>
            
            <button
              onClick={handleMigrateNow}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                ${content.type === 'warning'
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
                }
              `}
            >
              {content.actionText}
              <FiArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
