'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { CalendarBooking } from './CalendarBooking';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onBookingComplete: (date: string, time: string) => void;
}

export function CalendarModal({ isOpen, onClose, userId, onBookingComplete }: CalendarModalProps) {
  // Handle booking completion
  const handleBookingComplete = (date: string, time: string) => {
    onBookingComplete(date, time);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative w-[90vw] max-w-3xl max-h-[85vh] overflow-auto bg-white rounded-xl shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold text-gray-800">Schedule a Meeting</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Calendar Content */}
            <div className="p-4">
              <CalendarBooking 
                onBookingComplete={handleBookingComplete} 
                userId={userId}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
