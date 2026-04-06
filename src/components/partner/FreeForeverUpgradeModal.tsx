'use client';

import React, { useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiStar, FiArrowRight, FiCalendar, FiClock } from 'react-icons/fi';

interface FreeForeverUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed?: () => void; // Optional callback to proceed with original action
  title: string;
  message: string;
  featureDescription: string;
}

export default function FreeForeverUpgradeModal({
  isOpen,
  onClose,
  onProceed,
  title,
  message,
  featureDescription,
}: FreeForeverUpgradeModalProps) {
  // Load the booking widget script when modal opens
  useEffect(() => {
    if (isOpen) {
      // Check if script is already loaded
      if (!document.getElementById('knotie-booking-script')) {
        const script = document.createElement('script');
        script.id = 'knotie-booking-script';
        script.src = 'https://crm.knotie-ai.pro/js/form_embed.js';
        script.type = 'text/javascript';
        document.head.appendChild(script);
      }
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          as="div"
          className="relative z-50"
          onClose={onClose}
          open={isOpen}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <Dialog.Panel className="w-full max-w-7xl transform overflow-hidden rounded-2xl bg-gray-900 border border-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                        <FiStar className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <Dialog.Title className="text-xl font-bold text-white">
                          {title}
                        </Dialog.Title>
                        <p className="text-sm text-gray-400 mt-1">
                          Upgrade to unlock premium features
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                      <FiX className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Content - Horizontal Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Content */}
                    <div className="space-y-6">
                      {/* Message */}
                      <div className="bg-gradient-to-r from-blue-500/10 to-purple-600/10 border border-blue-500/20 rounded-lg p-4">
                        <p className="text-gray-300 leading-relaxed">
                          {message}
                        </p>
                      </div>

                      {/* Feature Highlight */}
                      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <FiArrowRight className="h-4 w-4 text-blue-400" />
                          <span className="text-white font-medium">What you'll unlock:</span>
                        </div>
                        <p className="text-gray-300 text-sm">
                          {featureDescription}
                        </p>
                      </div>

                      {/* Upgrade Benefits */}
                      <div className="space-y-4">
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                          <h4 className="text-green-400 font-medium mb-2">Premium Features</h4>
                          <ul className="text-sm text-green-300 space-y-1">
                            <li>• Unlimited customers & agents</li>
                            <li>• Custom domain & branding</li>
                            <li>• Team collaboration</li>
                            <li>• Priority support</li>
                          </ul>
                        </div>
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                          <h4 className="text-purple-400 font-medium mb-2">Special Offers</h4>
                          <ul className="text-sm text-purple-300 space-y-1">
                            <li>• Exclusive pricing plans</li>
                            <li>• Custom integrations</li>
                            <li>• Dedicated account manager</li>
                            <li>• Advanced analytics</li>
                          </ul>
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div className="flex items-center justify-center space-x-6 py-4 bg-gray-800/30 rounded-lg">
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <FiClock className="h-4 w-4 text-blue-400" />
                            <span className="text-white font-semibold">15 min</span>
                          </div>
                          <p className="text-xs text-gray-400">Quick call</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <FiStar className="h-4 w-4 text-yellow-400" />
                            <span className="text-white font-semibold">Free</span>
                          </div>
                          <p className="text-xs text-gray-400">No commitment</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <FiArrowRight className="h-4 w-4 text-green-400" />
                            <span className="text-white font-semibold">Custom</span>
                          </div>
                          <p className="text-xs text-gray-400">Tailored offer</p>
                        </div>
                      </div>

                      {/* Action Buttons - Moved to left column for better visibility */}
                      <div className="flex gap-3 pt-4">
                        {onProceed && (
                          <button
                            onClick={() => {
                              onClose();
                              onProceed();
                            }}
                            className="flex-1 px-6 py-3 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
                          >
                            <span>Maybe Later</span>
                            <FiArrowRight className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={onClose}
                          className="px-6 py-3 text-sm text-gray-400 hover:text-white transition-colors border border-gray-600 hover:border-gray-500 rounded-lg"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {/* Right Column - Booking Widget */}
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 flex flex-col min-h-[600px]">
                      <div className="flex items-center space-x-2 mb-4">
                        <FiCalendar className="h-5 w-5 text-blue-400" />
                        <h3 className="text-lg font-semibold text-white">
                          Book a Meeting with Our Team
                        </h3>
                      </div>
                      <p className="text-gray-400 text-sm mb-4">
                        Schedule a personalized demo and discover special offers available for your business.
                      </p>

                      {/* Booking Widget - Scrollable Container */}
                      <div className="bg-white rounded-lg overflow-hidden flex-1 min-h-0">
                        <div className="h-[500px] overflow-y-auto">
                          <iframe
                            src="https://crm.knotie-ai.pro/widget/booking/pLhUvEEyKe9SFN1gGCAZ"
                            style={{
                              width: '100%',
                              border: 'none',
                              height: '800px', // Taller height to ensure full calendar visibility
                              minHeight: '800px',
                            }}
                            id="pLhUvEEyKe9SFN1gGCAZ_1762370154942"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-6 pt-4 border-t border-gray-700">
                    <div className="flex items-center justify-center">
                      <p className="text-xs text-gray-500">
                        Free Forever plan • Limited features • Upgrade to unlock full potential
                      </p>
                    </div>
                  </div>
                </Dialog.Panel>
              </motion.div>
            </div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
