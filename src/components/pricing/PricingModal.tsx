import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiX } from 'react-icons/fi';
import { PLATFORM_FEE, VOICE_AI_RATE, TELEPHONY_RATE, EMAIL_RATE, SMS_RATE } from '@/lib/pricing';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const formatCurrency = (amount: number, decimals = 3) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount);
  };

  const formatBasePlatformFee = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const PricingComponent = ({ label, price, unit, description, isBaseFee = false }: 
    { label: string; price: number; unit: string; description?: string; isBaseFee?: boolean }) => (
    <div className="p-4 bg-gray-800/50 rounded-lg">
      <div className="flex justify-between items-start mb-2">
        <p className="text-lg font-semibold text-white">{label}</p>
        <div className="text-right">
          <p className="text-xl font-bold text-blue-400">
            {isBaseFee ? formatBasePlatformFee(price) : formatCurrency(price)}
          </p>
          <p className="text-sm text-gray-400">{unit}</p>
        </div>
      </div>
      {description && (
        <p className="text-sm text-gray-400">{description}</p>
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
                  Our Pricing
                </Dialog.Title>

                <div className="space-y-6">
                  {/* Base Platform Fee */}
                  <PricingComponent
                    label="Base Platform Fee"
                    price={PLATFORM_FEE}
                    unit="/month"
                    description="Access to all platform features, analytics, and basic support"
                    isBaseFee={true}
                  />

                  {/* Usage-based Pricing */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white">Usage-based Costs</h3>
                    
                    <PricingComponent
                      label="Voice AI Processing"
                      price={VOICE_AI_RATE}
                      unit="/minute"
                      description="Real-time speech recognition and natural language understanding"
                    />

                    <PricingComponent
                      label="Telephony"
                      price={TELEPHONY_RATE}
                      unit="/minute"
                      description="Standard Twilio telephony costs for toll-free numbers"
                    />

                    <PricingComponent
                      label="Transcription"
                      price={0.050}
                      unit="/transcript"
                      description="High-quality transcription with speaker diarization"
                    />

                    <PricingComponent
                      label="Email Notifications"
                      price={EMAIL_RATE}
                      unit="/email"
                      description="Transactional emails and notifications"
                    />

                    <PricingComponent
                      label="SMS Notifications"
                      price={SMS_RATE}
                      unit="/SMS"
                      description="Text message notifications and alerts"
                    />
                  </div>

                  {/* Features */}
                  <div className="mt-8">
                    <h3 className="text-lg font-medium text-white mb-4">Included Features</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        'Advanced Voice AI Processing',
                        'Natural Language Understanding',
                        'Real-time Speech Recognition',
                        'Voice Biometrics',
                        'Custom Voice Training',
                        'Analytics & Reporting',
                        'API Access',
                        '24/7 Support',
                        'Custom Automation Support',
                        'Unlimited Users',
                        'Data Export',
                        'Custom Integrations'
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

                  {/* Contact CTA */}
                  <div className="mt-8 p-6 bg-blue-500/10 rounded-lg border border-blue-400/20">
                    <h3 className="text-lg font-semibold text-white mb-2">Need a Custom Plan?</h3>
                    <p className="text-gray-400 mb-4">
                      We offer custom pricing for enterprises with specific requirements or high volume needs.
                    </p>
                    <button
                      onClick={() => window.location.href = 'mailto:support@knotie-ai.pro'}
                      className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Contact Sales
                    </button>
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
