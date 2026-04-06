'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiPhone, FiSettings, FiCheck, FiClock, FiX, FiPlay, FiArrowRight } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';

interface DeploymentStatusBannerProps {
  deploymentStatus: string;
  branding: PartnerBranding;
  onDismiss?: () => void;
  assignedPhoneNumber?: string;
  onTryAgent?: () => void;
  onDeployForBusiness?: () => void;
  onSetupCallForwarding?: () => void;

}

const statusConfig = {
  not_started: {
    title: 'Request Received - Setup Starting Soon',
    description: 'We\'ve received your AI agent deployment request! Our team will begin setting up your phone number and AI agent shortly.',
    icon: FiClock,
    color: '#3B82F6',
    bgColor: '#EBF8FF',
    progress: 0
  },
  phone_provisioned: {
    title: 'Phone Number Provisioned',
    description: 'Your dedicated phone number has been set up successfully.',
    icon: FiPhone,
    color: '#3B82F6',
    bgColor: '#EBF8FF',
    progress: 25
  },
  agent_deploying: {
    title: 'AI Agent Deploying',
    description: 'Your AI receptionist is being configured and deployed.',
    icon: FiSettings,
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    progress: 50
  },
  agent_ready: {
    title: 'Agent Ready for Testing',
    description: 'Your AI agent is deployed and ready for final testing. Test it out and deploy when you\'re satisfied!',
    icon: FiCheck,
    color: '#10B981',
    bgColor: '#ECFDF5',
    progress: 75
  },
  completed: {
    title: 'Setup Call Forwarding',
    description: 'Your AI agent is live! Set up call forwarding to start receiving calls through your AI assistant.',
    icon: FiPhone,
    color: '#3B82F6',
    bgColor: '#EBF8FF',
    progress: 100
  }
};

export default function DeploymentStatusBanner({
  deploymentStatus,
  branding,
  onDismiss,
  assignedPhoneNumber,
  onTryAgent,
  onDeployForBusiness,
  onSetupCallForwarding
}: DeploymentStatusBannerProps) {
  const config = statusConfig[deploymentStatus as keyof typeof statusConfig] || statusConfig.not_started;
  const IconComponent = config.icon;
  const [isDeploying, setIsDeploying] = useState(false);

  const handleDeployForBusiness = async () => {
    if (!onDeployForBusiness) return;

    setIsDeploying(true);
    try {
      await onDeployForBusiness();
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mb-6"
    >
      <div
        className="relative rounded-lg p-6 border-2"
        style={{
          background: `linear-gradient(135deg, ${branding.primaryColor}10, ${branding.secondaryColor}10)`,
          borderColor: `${branding.primaryColor}40`
        }}
      >
        {/* Close button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div
            className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: config.color }}
          >
            <IconComponent className="w-6 h-6 text-white" />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">
              {config.title}
            </h3>
            <p className="text-gray-300 mb-4">
              {config.description}
            </p>

            {/* Phone Number Display - Show when phone is provisioned or later stages */}
            {(deploymentStatus === 'phone_provisioned' || deploymentStatus === 'agent_deploying' || deploymentStatus === 'agent_ready' || deploymentStatus === 'completed') && assignedPhoneNumber && (
              <div className="mb-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                <div className="flex items-center gap-2">
                  <FiPhone className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-300">Your assigned phone number:</span>
                  <span className="text-sm font-medium text-white">{assignedPhoneNumber}</span>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                  <span>Deployment Progress</span>
                  <span>{config.progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${config.progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-2 rounded-full transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Status Steps */}
            <div className="mt-4 flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${config.progress >= 25 ? 'bg-green-400' : 'bg-gray-400'}`} />
                <span className="text-gray-300">Phone Setup</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${config.progress >= 50 ? 'bg-green-400' : 'bg-gray-400'}`} />
                <span className="text-gray-300">Agent Deploy</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${config.progress >= 75 ? 'bg-green-400' : 'bg-gray-400'}`} />
                <span className="text-gray-300">Testing</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${config.progress >= 100 ? 'bg-green-400' : 'bg-gray-400'}`} />
                <span className="text-gray-300">Live</span>
              </div>
            </div>

            {/* Action Buttons for Agent Ready Status */}
            {deploymentStatus === 'agent_ready' && (
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onTryAgent}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-gray-600 text-white hover:bg-gray-700 transition-colors"
                >
                  <FiPlay className="w-4 h-4" />
                  Try Agent
                </button>
                <button
                  onClick={handleDeployForBusiness}
                  disabled={isDeploying}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isDeploying ? '#6B7280' : `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`
                  }}
                >
                  {isDeploying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <FiArrowRight className="w-4 h-4" />
                      Deploy for my business
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Action Button for Completed Status */}
            {deploymentStatus === 'completed' && (
              <div className="mt-6">
                <button
                  onClick={() => {
                    console.log('🔘 Setup Call Forwarding button clicked');
                    onSetupCallForwarding?.();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white transition-colors"
                  style={{
                    background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`
                  }}
                >
                  <FiSettings className="w-4 h-4" />
                  Setup Call Forwarding
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
