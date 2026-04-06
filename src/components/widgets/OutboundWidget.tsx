"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneCall, Loader2 } from 'lucide-react';
import { WidgetConfig } from '@/providers/types';
import WidgetBranding from './WidgetBranding';
import InteractionHint from './InteractionHint';

interface OutboundWidgetProps {
  config: WidgetConfig;
  onError?: (error: string) => void;
  onCallStart?: () => void;
  onCallEnd?: () => void;
  previewMode?: boolean;
  // Real functionality props
  publicKey?: string;
  accessToken?: string;
  fetchCredentials?: () => Promise<{ publicKey?: string; accessToken?: string }>;
}

// Phone number validation
const validatePhoneNumber = (number: string) => {
  return /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/g.test(number);
};

const OutboundWidget: React.FC<OutboundWidgetProps> = ({
  config,
  onError,
  onCallStart,
  onCallEnd,
  previewMode = false
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle');
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Handle call events
  useEffect(() => {
    if (callStatus === 'connected' && onCallStart) {
      onCallStart();
    }
  }, [callStatus, onCallStart]);

  useEffect(() => {
    if (callStatus === 'ended' && onCallEnd) {
      onCallEnd();
    }
  }, [callStatus, onCallEnd]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid phone number.');
      return;
    }

    setError('');
    setIsLoading(true);
    setCallStatus('calling');

    try {
      if (previewMode) {
        // Preview mode - simulate call
        setTimeout(() => {
          setIsLoading(false);
          setCallStatus('connected');
          setShowSuccess(true);
          setTimeout(() => {
            setCallStatus('ended');
            setShowSuccess(false);
          }, 3000);
        }, 2000);
        return;
      }

      // Real call functionality
      const response = await fetch('/api/vapi/make-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumberId: (config.providerConfig as any)?.phoneNumberId,
          assistantId: (config.providerConfig as any)?.assistantId || config.agentId,
          customerNumber: phoneNumber,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setCallStatus('connected');
        setShowSuccess(true);
        setTimeout(() => {
          setCallStatus('ended');
          setShowSuccess(false);
        }, 5000);
      } else {
        throw new Error(result.message || 'Failed to make call');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to make call';
      setError(errorMessage);
      setCallStatus('idle');
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setPhoneNumber('');
    setError('');
    setCallStatus('idle');
    setShowSuccess(false);
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'calling':
        return config.customization.appearance.secondaryColor || '#F59E0B';
      case 'connected':
        return '#10B981';
      case 'ended':
        return '#6B7280';
      default:
        return config.customization.appearance.primaryColor;
    }
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'calling':
        return 'Calling...';
      case 'connected':
        return 'Call Connected!';
      case 'ended':
        return 'Call Ended';
      default:
        return 'Ready to Call';
    }
  };

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-full p-6"
      style={{ 
        backgroundColor: config.customization.appearance.backgroundColor,
        color: config.customization.appearance.textColor,
        borderRadius: `${config.customization.appearance.borderRadius}px`
      }}
    >
      {/* Welcome message */}
      {config.customization.messages.welcomeMessage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-center mb-6 px-4"
          style={{ color: config.customization.appearance.textColor }}
        >
          {config.customization.messages.welcomeMessage}
        </motion.div>
      )}

      {/* Status Indicator */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center justify-center mb-6"
      >
        <div
          className="flex items-center justify-center rounded-full transition-all duration-300"
          style={{
            backgroundColor: getStatusColor(),
            width: '80px',
            height: '80px',
            boxShadow: `0 4px 20px ${getStatusColor()}40`
          }}
        >
          {isLoading ? (
            <Loader2 size={32} className="animate-spin text-white" />
          ) : callStatus === 'connected' ? (
            <PhoneCall size={32} className="text-white" />
          ) : (
            <Phone size={32} className="text-white" />
          )}
        </div>
      </motion.div>

      {/* Status Text */}
      <motion.div
        key={callStatus}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm font-medium mb-6 text-center"
        style={{ color: getStatusColor() }}
      >
        {getStatusText()}
      </motion.div>

      {/* Success Message */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            className="mb-4 p-3 rounded-lg bg-green-100 text-green-800 text-sm text-center"
          >
            Call initiated successfully! You should receive a call shortly.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phone Input Form */}
      {callStatus === 'idle' && (
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-4"
        >
          <div>
            <label 
              className="block text-xs font-medium mb-2"
              style={{ color: config.customization.appearance.textColor }}
            >
              Enter your phone number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{
                backgroundColor: `${config.customization.appearance.primaryColor}10`,
                borderColor: config.customization.appearance.primaryColor + '40',
                color: config.customization.appearance.textColor
              } as React.CSSProperties}
              disabled={isLoading}
            />
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-red-500 text-xs text-center"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !phoneNumber}
            className="w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              backgroundColor: config.customization.appearance.primaryColor,
              color: 'white',
              boxShadow: `0 4px 15px ${config.customization.appearance.primaryColor}40`
            }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Calling...</span>
              </div>
            ) : (
              config.customization.messages.buttonText || 'Start Call'
            )}
          </button>
        </motion.form>
      )}

      {/* Reset Button for ended calls */}
      {callStatus === 'ended' && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={resetForm}
          className="mt-4 px-6 py-2 rounded-lg font-medium transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-opacity-50"
          style={{
            backgroundColor: config.customization.appearance.secondaryColor || config.customization.appearance.primaryColor,
            color: 'white',
            boxShadow: `0 2px 10px ${config.customization.appearance.primaryColor}30`
          }}
        >
          Make Another Call
        </motion.button>
      )}

      {/* Interactive Hint */}
      <InteractionHint
        config={config}
        isCallActive={callStatus === 'connected'}
        isLoading={isLoading}
        position="bottom"
      />

      {/* Widget Branding */}
      <WidgetBranding config={config} />
    </div>
  );
};

export default OutboundWidget;
