import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { calculatePriceWithInput } from '@/lib/pricing';
import type { CallVolumeRangeKey, ComplexityKey } from '@/lib/pricing';

interface PriceComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  avgDuration: number;
  monthlyVolume: number;
}

export default function PriceComparisonModal({
  isOpen,
  onClose,
  avgDuration,
  monthlyVolume
}: PriceComparisonModalProps) {
  // Convert monthlyVolume to appropriate range
  const getVolumeRange = (volume: number): CallVolumeRangeKey => {
    if (volume <= 1000) return '0-1000';
    if (volume <= 5000) return '1001-5000';
    if (volume <= 10000) return '5001-10000';
    return '10001+';
  };

  // Get complexity based on duration
  const getComplexity = (duration: number): ComplexityKey => {
    if (duration <= 3) return 'Simple';
    if (duration <= 6) return 'Moderate';
    return 'Complex';
  };

  const pricing = calculatePriceWithInput({
    monthlyCallVolume: getVolumeRange(monthlyVolume),
    callComplexity: getComplexity(avgDuration),
    scriptComplexity: getComplexity(avgDuration)
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount));
  };

  const PriceComparison = ({ label, knotie, competitor, tooltip }: { label: string; knotie: number; competitor: number; tooltip?: string }) => (
    <div className="grid grid-cols-3 gap-4 py-3 border-b border-gray-700">
      <div className="text-gray-300">{label}</div>
      <div className="text-right font-semibold text-blue-400">{formatCurrency(knotie)}</div>
      <div className="text-right font-semibold text-gray-400">{formatCurrency(competitor)}</div>
      {tooltip && (
        <div className="col-span-3 text-xs text-gray-400 mt-1">{tooltip}</div>
      )}
    </div>
  );

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-gray-900 p-6 shadow-xl transition-all">
                <div className="absolute right-4 top-4">
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 text-gray-400 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>

                <Dialog.Title className="text-2xl font-semibold text-white mb-6">
                  Price Comparison
                </Dialog.Title>

                <div className="space-y-6">
                  {/* Usage Summary */}
                  <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-medium text-white mb-2">Your Usage Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-400">Monthly Call Volume</p>
                        <p className="text-xl font-semibold text-white">{monthlyVolume.toLocaleString()} calls</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Average Call Duration</p>
                        <p className="text-xl font-semibold text-white">{avgDuration} minutes</p>
                      </div>
                    </div>
                  </div>

                  {/* Price Comparison Table */}
                  <div className="bg-gray-800/30 rounded-lg p-6">
                    <div className="grid grid-cols-3 gap-4 pb-3 border-b border-gray-700">
                      <div className="text-gray-400">Component</div>
                      <div className="text-right text-gray-400">Knotie AI</div>
                      <div className="text-right text-gray-400">VAPI</div>
                    </div>

                    <PriceComparison 
                      label="Base Platform Cost" 
                      knotie={pricing.knotieAI.breakdown.platformFee} 
                      competitor={0}
                      tooltip="Knotie AI charges a fixed monthly platform fee, while VAPI charges per minute of usage"
                    />
                    <PriceComparison 
                      label="Platform Usage" 
                      knotie={0} 
                      competitor={pricing.competitor.breakdown.platformUsageCost}
                      tooltip="VAPI charges $0.05 per minute for platform usage"
                    />
                    <PriceComparison 
                      label="Voice AI Processing" 
                      knotie={pricing.knotieAI.breakdown.voiceAICost} 
                      competitor={pricing.competitor.breakdown.voiceAICost}
                      tooltip="Cost for AI processing, speech recognition, and natural language understanding"
                    />
                    <PriceComparison 
                      label="Telephony" 
                      knotie={pricing.knotieAI.breakdown.telephonyCost} 
                      competitor={pricing.competitor.breakdown.telephonyCost}
                      tooltip="Standard Twilio telephony costs considering Toll Free rates"
                    />
                    <PriceComparison 
                      label="Notifications" 
                      knotie={pricing.knotieAI.breakdown.emailCost + pricing.knotieAI.breakdown.smsCost} 
                      competitor={0}
                      tooltip="Knotie AI includes email and SMS notifications, while VAPI requires separate integration and costs"
                    />

                    <div className="grid grid-cols-3 gap-4 py-4 border-t border-gray-700 mt-3">
                      <div className="text-lg font-semibold text-white">Total Monthly Cost</div>
                      <div className="text-right text-lg font-bold text-blue-400">
                        {formatCurrency(pricing.knotieAI.totalPrice)}
                      </div>
                      <div className="text-right text-lg font-bold text-gray-400">
                        {formatCurrency(pricing.competitor.totalPrice)}
                      </div>
                    </div>
                  </div>

                  {/* Savings Highlight */}
                  <div className="bg-blue-500/10 border border-blue-400/20 rounded-lg p-6">
                    <h3 className="text-xl font-semibold text-white mb-4">Your Potential Savings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-gray-300">
                          Monthly savings with Knotie AI
                        </div>
                        <div className="text-2xl font-bold text-blue-400">
                          {formatCurrency(pricing.savings)}
                        </div>
                      </div>
                      <div className="text-sm text-gray-400">
                        Knotie AI offers predictable pricing with a fixed platform fee and includes notification costs, 
                        while VAPI charges per-minute platform fees and requires separate notification integration.
                      </div>
                    </div>
                  </div>

                  {/* Feature Comparison */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white">Why Choose Knotie AI?</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        'Fixed platform cost with no hidden per-minute charges',
                        'Integrated email and SMS notifications included',
                        'No additional integration costs for notifications',
                        'Predictable monthly billing',
                        'Fully managed solution with zero development costs',
                        'Custom automation support at minimal/no charge based on complexity',
                        'Cost effective for small to medium businesses'
                      ].map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 text-gray-300">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            ✓
                          </div>
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
