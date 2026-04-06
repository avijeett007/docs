import React, { useState, useEffect } from 'react';
import { X, Timer, ArrowRight, Zap } from 'lucide-react';
import { isOfferExpired, getTimeRemaining, getFormattedOfferEndDate } from '../utils/offerUtils';

interface LimitedOfferPopupProps {
  isVisible: boolean;
  onClose: () => void;
  onGetOffer: () => void;
}

const LimitedOfferPopup: React.FC<LimitedOfferPopupProps> = ({ isVisible, onClose, onGetOffer }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Calculate time remaining until offer expires
  useEffect(() => {
    const updateCountdown = () => {
      setTimeLeft(getTimeRemaining());
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  // Don't render if offer has expired or not visible
  if (isOfferExpired() || !isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl max-w-md w-full border border-red-500/30 shadow-2xl shadow-red-500/20 animate-fadeIn relative overflow-hidden">
        {/* Animated background effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 animate-pulse" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white z-10 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="relative p-8">
          {/* Header with urgency indicator */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm font-medium mb-4">
              <Zap size={16} className="animate-pulse" />
              LIMITED TIME OFFER
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">
              🚨 One-Time Lifetime Deal
            </h3>
            <p className="text-gray-300 text-sm">
              This exclusive offer expires on <span className="text-red-400 font-semibold">{getFormattedOfferEndDate()}</span>
            </p>
          </div>

          {/* Countdown Timer */}
          <div className="bg-gray-900/50 rounded-lg p-4 mb-6 border border-red-500/20">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Timer size={18} className="text-red-400" />
              <span className="text-white font-medium">Time Remaining:</span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-red-500/20 rounded-lg p-2">
                <div className="text-xl font-bold text-white">{timeLeft.days}</div>
                <div className="text-xs text-gray-400">Days</div>
              </div>
              <div className="bg-red-500/20 rounded-lg p-2">
                <div className="text-xl font-bold text-white">{timeLeft.hours}</div>
                <div className="text-xs text-gray-400">Hours</div>
              </div>
              <div className="bg-red-500/20 rounded-lg p-2">
                <div className="text-xl font-bold text-white">{timeLeft.minutes}</div>
                <div className="text-xs text-gray-400">Minutes</div>
              </div>
              <div className="bg-red-500/20 rounded-lg p-2">
                <div className="text-xl font-bold text-white">{timeLeft.seconds}</div>
                <div className="text-xs text-gray-400">Seconds</div>
              </div>
            </div>
          </div>

          {/* Offer details */}
          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center gap-2 mb-2">
              <span className="text-3xl font-bold text-white">$499</span>
              <span className="text-lg text-gray-400 line-through">$2997/year</span>
            </div>
            <p className="text-green-400 font-medium text-sm">Save $2,498 - That's 83% OFF!</p>
            <p className="text-gray-300 text-sm mt-2">
              Get lifetime access to all Pro features with a one-time payment
            </p>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={onGetOffer}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600
                        text-white rounded-lg font-semibold transition-all duration-300 transform hover:scale-105
                        flex items-center justify-center gap-2 relative overflow-hidden group"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-red-600 to-orange-600 opacity-0
                             group-hover:opacity-100 transition-opacity duration-300"></span>
              <span className="relative flex items-center gap-2">
                Claim This Deal Now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </span>
            </button>

            <button
              onClick={onClose}
              className="w-full py-2 px-4 text-gray-400 hover:text-white transition-colors text-sm"
            >
              Maybe later
            </button>
          </div>

          {/* Trust indicators */}
          <div className="text-center mt-4">
            <p className="text-xs text-gray-500">
              ✓ No recurring fees ✓ Lifetime updates ✓ 30-day money-back guarantee
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LimitedOfferPopup;
