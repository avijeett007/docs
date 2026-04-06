'use client';

import React from 'react';
import { Dialog } from '@headlessui/react';
import { X, Gift, Zap, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface TierSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tierType: 'free_forever' | 'starter_special' | null;
  onConfirm: (choice: 'free_trial' | 'special_offer' | 'continue_free') => void;
}

const TierSelectionModal: React.FC<TierSelectionModalProps> = ({
  isOpen,
  onClose,
  tierType,
  onConfirm
}) => {
  if (!tierType) return null;

  const handleConfirm = (choice: 'free_trial' | 'special_offer' | 'continue_free') => {
    onConfirm(choice);
    onClose();
  };

  const renderFreeForeverModal = () => (
    <div className="text-center">
      <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 mb-6">
        <Gift className="w-8 h-8 text-white" />
      </div>

      <Dialog.Title className="text-2xl font-bold text-white mb-3">
        Welcome to Free Forever!
      </Dialog.Title>

      <p className="text-gray-300 mb-6 text-base">
        You'll get <span className="text-cyan-400 font-semibold">7 days FREE trial</span> of all premium features,
        then continue with your Free Forever plan.
      </p>

      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-400/20 rounded-xl p-5 mb-6">
        <h4 className="text-sm font-semibold text-cyan-400 mb-3">What you get during the trial:</h4>
        <ul className="text-sm text-gray-300 space-y-2 text-left">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
            All AI providers (VAPI, Ultravox, ElevenLabs)
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
            Unlimited customers & agents
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
            Advanced features & integrations
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
            Priority support & training
          </li>
        </ul>
      </div>

      <button
        onClick={() => handleConfirm('free_trial')}
        className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
      >
        Start 7-Day Free Trial
        <ArrowRight className="w-5 h-5" />
      </button>

      <p className="text-xs text-gray-400 mt-4">
        Credit card required for verification to prevent bot abuse. Cancel anytime during trial.
      </p>
    </div>
  );

  const renderStarterSpecialModal = () => (
    <div className="text-center">
      <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 mb-6">
        <Zap className="w-8 h-8 text-white" />
      </div>

      <Dialog.Title className="text-2xl font-bold text-white mb-3">
        Special Launch Offer!
      </Dialog.Title>

      <p className="text-gray-300 mb-6 text-base">
        Start today and get our <span className="text-cyan-400 font-semibold">$149 plan for just $49/month</span>,
        or continue with a free trial.
      </p>

      <div className="space-y-4 mb-6">
        <button
          onClick={() => handleConfirm('special_offer')}
          className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
        >
          Get $49/month Special Offer
          <ArrowRight className="w-5 h-5" />
        </button>

        <button
          onClick={() => handleConfirm('free_trial')}
          className="w-full py-4 px-6 bg-gray-700/50 border border-gray-600 text-white font-medium rounded-xl hover:bg-gray-600/50 hover:border-gray-500 transition-all duration-300"
        >
          Continue with Free Trial
        </button>
      </div>

      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-400/20 rounded-xl p-4">
        <p className="text-sm text-cyan-300 flex items-center justify-center gap-2">
          🔥 Limited time offer - Save $100/month
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <Dialog.Panel className="mx-auto max-w-lg w-full bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl shadow-cyan-500/10">
            {/* Header */}
            <div className="flex items-center justify-end p-6 border-b border-gray-700/50">
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-cyan-400 transition-colors p-1 rounded-lg hover:bg-gray-800/50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8">
              {tierType === 'free_forever' && renderFreeForeverModal()}
              {tierType === 'starter_special' && renderStarterSpecialModal()}
            </div>
          </Dialog.Panel>
        </motion.div>
      </div>
    </Dialog>
  );
};

export default TierSelectionModal;
