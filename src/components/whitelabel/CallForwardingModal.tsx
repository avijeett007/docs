'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiPhone, FiCopy, FiCheck, FiChevronDown, FiClock, FiHelpCircle, FiAlertTriangle, FiWifi, FiSettings, FiMail } from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';
import CustomerSupportModal from './CustomerSupportModal';

interface CallForwardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignedPhoneNumber: string;
}

interface CountryProvider {
  name: string;
  code: string;
  active: boolean;
}

interface CountryConfig {
  name: string;
  code: string;
  flag: string;
  forwardingCode: string;
  active: boolean;
  providers: CountryProvider[];
}

const countryConfigs: CountryConfig[] = [
  {
    name: 'United Kingdom',
    code: 'GB',
    flag: '🇬🇧',
    forwardingCode: '*61*',
    active: true,
    providers: [
      { name: 'EE', code: 'ee', active: true },
      { name: 'O2', code: 'o2', active: true },
      { name: 'Three', code: 'three', active: true },
      { name: 'Vodafone', code: 'vodafone', active: true },
      { name: 'Tesco Mobile', code: 'tesco', active: true },
      { name: 'giffgaff', code: 'giffgaff', active: true },
    ]
  },
  {
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    forwardingCode: '*61*',
    active: true,
    providers: [
      { name: 'Verizon', code: 'verizon', active: true },
      { name: 'AT&T', code: 'att', active: true },
      { name: 'T-Mobile', code: 'tmobile', active: true },
      { name: 'Sprint', code: 'sprint', active: true },
      { name: 'Other', code: 'other', active: true },
    ]
  },
  {
    name: 'Canada',
    code: 'CA',
    flag: '🇨🇦',
    forwardingCode: '*61*',
    active: true,
    providers: [
      { name: 'Rogers', code: 'rogers', active: true },
      { name: 'Bell', code: 'bell', active: true },
      { name: 'Telus', code: 'telus', active: true },
      { name: 'Freedom Mobile', code: 'freedom', active: true },
      { name: 'Other', code: 'other', active: true },
    ]
  },
  {
    name: 'Germany',
    code: 'DE',
    flag: '🇩🇪',
    forwardingCode: '*61*',
    active: true,
    providers: [
      { name: 'Deutsche Telekom', code: 'telekom', active: true },
      { name: 'Vodafone', code: 'vodafone', active: true },
      { name: 'O2', code: 'o2', active: true },
      { name: '1&1', code: 'oneandone', active: true },
      { name: 'Other', code: 'other', active: true },
    ]
  },
  {
    name: 'France',
    code: 'FR',
    flag: '🇫🇷',
    forwardingCode: '*61*',
    active: true,
    providers: [
      { name: 'Orange', code: 'orange', active: true },
      { name: 'SFR', code: 'sfr', active: true },
      { name: 'Bouygues Telecom', code: 'bouygues', active: true },
      { name: 'Free Mobile', code: 'free', active: true },
      { name: 'Other', code: 'other', active: true },
    ]
  },
  {
    name: 'Australia',
    code: 'AU',
    flag: '🇦🇺',
    forwardingCode: '**61*',
    active: true,
    providers: [
      { name: 'Telstra', code: 'telstra', active: true },
      { name: 'Optus', code: 'optus', active: true },
      { name: 'Vodafone', code: 'vodafone', active: true },
      { name: 'Other (MVNO)', code: 'other', active: true },
    ]
  },
  // Upcoming countries (grayed out)
  {
    name: 'Netherlands',
    code: 'NL',
    flag: '🇳🇱',
    forwardingCode: '*61*',
    active: false,
    providers: []
  },
  {
    name: 'Spain',
    code: 'ES',
    flag: '🇪🇸',
    forwardingCode: '*61*',
    active: false,
    providers: []
  },
  {
    name: 'Italy',
    code: 'IT',
    flag: '🇮🇹',
    forwardingCode: '*61*',
    active: false,
    providers: []
  },
];

const CallForwardingModal: React.FC<CallForwardingModalProps> = ({
  isOpen,
  onClose,
  assignedPhoneNumber
}) => {
  const { branding } = usePartnerBranding();
  const [selectedCountry, setSelectedCountry] = useState<CountryConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<CountryProvider | null>(null);
  const [forwardingCode, setForwardingCode] = useState('');
  const [alternativeCodes, setAlternativeCodes] = useState<string[]>([]);
  const [clearingCodes, setClearingCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showHelpSection, setShowHelpSection] = useState(false);
  const [selectedTroubleshootingIssue, setSelectedTroubleshootingIssue] = useState<string | null>(null);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Auto-detect country from phone number
  useEffect(() => {
    console.log('📱 CallForwardingModal useEffect:', {
      assignedPhoneNumber: assignedPhoneNumber,
      assignedPhoneNumberType: typeof assignedPhoneNumber,
      assignedPhoneNumberValue: JSON.stringify(assignedPhoneNumber),
      isOpen: isOpen,
      hasPhoneNumber: !!assignedPhoneNumber,
      phoneNumberLength: assignedPhoneNumber?.length || 0,
      timestamp: new Date().toISOString()
    });

    if (assignedPhoneNumber && isOpen) {
      const detectedCountry = detectCountryFromPhoneNumber(assignedPhoneNumber);
      console.log('🌍 Detected country:', detectedCountry?.name);

      if (detectedCountry) {
        setSelectedCountry(detectedCountry);
        if (detectedCountry.providers.length > 0) {
          setSelectedProvider(detectedCountry.providers[0]);
        }
      }
    }
  }, [assignedPhoneNumber, isOpen]);

  const detectCountryFromPhoneNumber = (phoneNumber: string): CountryConfig | null => {
    // Remove any non-digit characters except +
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    
    if (cleanNumber.startsWith('+44')) {
      return countryConfigs.find(c => c.code === 'GB') || null;
    } else if (cleanNumber.startsWith('+1')) {
      // Could be US or Canada, default to US
      return countryConfigs.find(c => c.code === 'US') || null;
    } else if (cleanNumber.startsWith('+49')) {
      return countryConfigs.find(c => c.code === 'DE') || null;
    } else if (cleanNumber.startsWith('+33')) {
      return countryConfigs.find(c => c.code === 'FR') || null;
    } else if (cleanNumber.startsWith('+61')) {
      return countryConfigs.find(c => c.code === 'AU') || null;
    }

    // Default to UK if can't detect
    return countryConfigs.find(c => c.code === 'GB') || null;
  };

  const generateForwardingCode = () => {
    console.log('🔧 Generate forwarding code clicked:', {
      selectedCountry: selectedCountry?.name,
      assignedPhoneNumber: assignedPhoneNumber,
      hasSelectedCountry: !!selectedCountry,
      hasPhoneNumber: !!assignedPhoneNumber
    });

    if (!selectedCountry || !assignedPhoneNumber) {
      console.log('❌ Cannot generate code - missing requirements:', {
        selectedCountry: !!selectedCountry,
        assignedPhoneNumber: !!assignedPhoneNumber
      });
      return;
    }

    // Primary code with 15-second delay
    const primaryCode = `${selectedCountry.forwardingCode}${assignedPhoneNumber}*15#`;

    // Alternative codes for different providers/situations
    const alternatives = [
      `${selectedCountry.forwardingCode}${assignedPhoneNumber}#`, // Without timing
      `*${selectedCountry.forwardingCode.slice(1)}${assignedPhoneNumber}*15#`, // Single asterisk variant
      `*${selectedCountry.forwardingCode.slice(1)}${assignedPhoneNumber}#`, // Single asterisk without timing
    ];

    // Clearing codes to disable existing forwarding
    const clearing = [
      '##21#', // Clear all call forwarding
      '##61#', // Clear forwarding when no reply
      '##62#', // Clear forwarding when unreachable
      '##67#', // Clear forwarding when busy
    ];

    console.log('✅ Generated forwarding codes:', { primaryCode, alternatives, clearing });
    setForwardingCode(primaryCode);
    setAlternativeCodes(alternatives);
    setClearingCodes(clearing);
  };

  const copyToClipboard = async () => {
    if (!forwardingCode) return;
    
    try {
      await navigator.clipboard.writeText(forwardingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <>
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/90" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-900 rounded-lg max-w-2xl w-full border border-gray-800 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
            <div>
              <Dialog.Title className="text-xl font-semibold text-white">
                Setup Call Forwarding
              </Dialog.Title>
              <p className="text-sm text-gray-400">Forward unanswered calls to your AI assistant</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Assigned Phone Number Display */}
            {assignedPhoneNumber && (
              <div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-500/20">
                    <FiPhone className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1">Your AI Assistant Phone Number</h4>
                    <p className="text-lg font-mono text-blue-400">{assignedPhoneNumber}</p>
                    <p className="text-xs text-gray-400 mt-1">Setting up call forwarding for this number</p>
                  </div>
                </div>
              </div>
            )}

            {/* Country Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-white mb-3">
                Select Your Country
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {countryConfigs.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => {
                      if (country.active) {
                        setSelectedCountry(country);
                        setSelectedProvider(country.providers[0] || null);
                        setForwardingCode('');
                      }
                    }}
                    disabled={!country.active}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedCountry?.code === country.code
                        ? 'border-blue-500 bg-blue-500/10'
                        : country.active
                        ? 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
                        : 'border-gray-700 bg-gray-800/30 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{country.flag}</span>
                      <div className="flex-1">
                        <div className="text-white font-medium">{country.name}</div>
                        {!country.active && (
                          <div className="text-xs text-gray-500">Coming Soon</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Provider Selection */}
            {selectedCountry && selectedCountry.active && selectedCountry.providers.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-white mb-3">
                  Select Your Mobile Provider
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                    className="w-full p-3 rounded-lg border border-gray-600 bg-gray-800 text-white text-left flex items-center justify-between"
                  >
                    <span>{selectedProvider?.name || 'Select Provider'}</span>
                    <FiChevronDown className={`w-4 h-4 transition-transform ${showProviderDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showProviderDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-10">
                      {selectedCountry.providers.map((provider) => (
                        <button
                          key={provider.code}
                          onClick={() => {
                            setSelectedProvider(provider);
                            setShowProviderDropdown(false);
                            setForwardingCode('');
                          }}
                          className="w-full p-3 text-left text-white hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                        >
                          {provider.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Troubleshooting Help Section */}
            {selectedCountry && selectedCountry.active && (
              <div className="mb-6">
                <button
                  onClick={() => setShowHelpSection(!showHelpSection)}
                  className="w-full p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-left flex items-center justify-between hover:bg-yellow-500/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FiHelpCircle className="w-5 h-5 text-yellow-400" />
                    <span className="text-white font-medium">Having trouble? Get help with common issues</span>
                  </div>
                  <FiChevronDown className={`w-4 h-4 text-yellow-400 transition-transform ${showHelpSection ? 'rotate-180' : ''}`} />
                </button>

                {showHelpSection && (
                  <div className="mt-4 space-y-4">
                    <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                      <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                        <FiAlertTriangle className="w-4 h-4 text-orange-400" />
                        Common Issues & Solutions
                      </h4>

                      <div className="space-y-3">
                        {/* Issue 1: Invalid MMI Code */}
                        <div className="border border-gray-600 rounded-lg">
                          <button
                            onClick={() => setSelectedTroubleshootingIssue(
                              selectedTroubleshootingIssue === 'invalid-mmi' ? null : 'invalid-mmi'
                            )}
                            className="w-full p-3 text-left flex items-center justify-between hover:bg-gray-700/50"
                          >
                            <span className="text-gray-300">Getting "Invalid MMI Code" error?</span>
                            <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                              selectedTroubleshootingIssue === 'invalid-mmi' ? 'rotate-180' : ''
                            }`} />
                          </button>
                          {selectedTroubleshootingIssue === 'invalid-mmi' && (
                            <div className="px-3 pb-3 text-sm text-gray-300 space-y-2">
                              <div className="flex items-start gap-2">
                                <span className="text-blue-400 font-mono">1.</span>
                                <div>
                                  <strong>Clear existing forwarding first:</strong>
                                  <div className="mt-1 p-2 bg-gray-900 rounded font-mono text-xs">
                                    ##21# (clears all forwarding)
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-blue-400 font-mono">2.</span>
                                <div>
                                  <strong>Disable WiFi calling temporarily:</strong>
                                  <div className="mt-1 text-xs text-gray-400">
                                    Settings → Phone → WiFi Calling → Turn OFF
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-blue-400 font-mono">3.</span>
                                <span>Try the alternative codes we'll provide below</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Issue 2: WiFi Calling Problems */}
                        <div className="border border-gray-600 rounded-lg">
                          <button
                            onClick={() => setSelectedTroubleshootingIssue(
                              selectedTroubleshootingIssue === 'wifi-calling' ? null : 'wifi-calling'
                            )}
                            className="w-full p-3 text-left flex items-center justify-between hover:bg-gray-700/50"
                          >
                            <span className="text-gray-300">WiFi calling interfering with setup?</span>
                            <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                              selectedTroubleshootingIssue === 'wifi-calling' ? 'rotate-180' : ''
                            }`} />
                          </button>
                          {selectedTroubleshootingIssue === 'wifi-calling' && (
                            <div className="px-3 pb-3 text-sm text-gray-300 space-y-2">
                              <div className="flex items-start gap-2">
                                <FiWifi className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <strong>Temporarily disable WiFi calling:</strong>
                                  <ul className="mt-1 text-xs text-gray-400 space-y-1">
                                    <li>• iPhone: Settings → Phone → WiFi Calling → OFF</li>
                                    <li>• Android: Settings → Connections → WiFi Calling → OFF</li>
                                    <li>• Samsung: Settings → Connections → More → WiFi Calling → OFF</li>
                                  </ul>
                                  <div className="mt-2 text-xs text-yellow-400">
                                    ⚠️ You can re-enable it after setting up forwarding
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Issue 3: Provider Specific */}
                        <div className="border border-gray-600 rounded-lg">
                          <button
                            onClick={() => setSelectedTroubleshootingIssue(
                              selectedTroubleshootingIssue === 'provider-specific' ? null : 'provider-specific'
                            )}
                            className="w-full p-3 text-left flex items-center justify-between hover:bg-gray-700/50"
                          >
                            <span className="text-gray-300">Provider-specific issues?</span>
                            <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                              selectedTroubleshootingIssue === 'provider-specific' ? 'rotate-180' : ''
                            }`} />
                          </button>
                          {selectedTroubleshootingIssue === 'provider-specific' && (
                            <div className="px-3 pb-3 text-sm text-gray-300 space-y-2">
                              <div className="space-y-2">
                                <div><strong>T-Mobile/EE:</strong> Try using **61* instead of *61*</div>
                                <div><strong>Verizon:</strong> May need to call customer service to enable</div>
                                <div><strong>Three UK:</strong> Use *61* without timing parameter</div>
                                <div><strong>O2:</strong> Ensure you&apos;re not on WiFi when setting up</div>
                                <div><strong>Telstra (AU):</strong> Disable MessageBank first by calling 1500, then try the code</div>
                                <div><strong>Optus (AU):</strong> Disable voicemail by calling 321, then set up forwarding</div>
                                <div><strong>Vodafone (AU):</strong> Disable voicemail by calling 121, then try the code</div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Issue 4: Still Not Working */}
                        <div className="border border-gray-600 rounded-lg">
                          <button
                            onClick={() => setSelectedTroubleshootingIssue(
                              selectedTroubleshootingIssue === 'still-not-working' ? null : 'still-not-working'
                            )}
                            className="w-full p-3 text-left flex items-center justify-between hover:bg-gray-700/50"
                          >
                            <span className="text-gray-300">Still not working?</span>
                            <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                              selectedTroubleshootingIssue === 'still-not-working' ? 'rotate-180' : ''
                            }`} />
                          </button>
                          {selectedTroubleshootingIssue === 'still-not-working' && (
                            <div className="px-3 pb-3 text-sm text-gray-300 space-y-2">
                              <div className="flex items-start gap-2">
                                <FiSettings className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <strong>Advanced troubleshooting:</strong>
                                  <ul className="mt-1 text-xs text-gray-400 space-y-1">
                                    <li>• Restart your phone and try again</li>
                                    <li>• Check if you have call forwarding restrictions on your plan</li>
                                    <li>• Try setting up from a different location (better signal)</li>
                                    <li>• Contact your provider to enable call forwarding features</li>
                                    <li>• Some business plans may have restrictions</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Contact Us Button */}
                <div className="mt-4 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FiMail className="w-5 h-5 text-orange-400" />
                      <div>
                        <h4 className="text-white font-medium">Still need help?</h4>
                        <p className="text-sm text-gray-400">Contact our support team for personalized assistance</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowSupportModal(true)}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <FiMail className="w-4 h-4" />
                      Contact Us
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Button */}
            {selectedCountry && selectedCountry.active && selectedProvider && (
              <div className="mb-6">
                <button
                  onClick={generateForwardingCode}
                  className="w-full py-3 px-4 rounded-lg font-medium text-white transition-colors"
                  style={{
                    background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`
                  }}
                >
                  Generate Forwarding Code
                </button>
              </div>
            )}

            {/* Forwarding Code Display */}
            {forwardingCode && (
              <div className="mb-6 space-y-4">
                {/* Primary Code */}
                <div>
                  <label className="block text-sm font-medium text-white mb-3">
                    Primary Forwarding Code (Try this first)
                  </label>
                  <div className="p-4 rounded-lg bg-gray-800 border border-gray-600">
                    <div className="flex items-center justify-between">
                      <code className="text-lg font-mono text-blue-400">{forwardingCode}</code>
                      <button
                        onClick={copyToClipboard}
                        className="flex items-center gap-2 px-3 py-1 rounded text-sm text-gray-300 hover:text-white transition-colors"
                      >
                        {copied ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      This will forward unanswered calls after 15 seconds.
                    </p>
                  </div>
                </div>

                {/* Alternative Codes */}
                {alternativeCodes.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-white mb-3">
                      Alternative Codes (If primary doesn't work)
                    </label>
                    <div className="space-y-2">
                      {alternativeCodes.map((code, index) => (
                        <div key={index} className="p-3 rounded-lg bg-gray-800/50 border border-gray-600">
                          <div className="flex items-center justify-between">
                            <code className="text-sm font-mono text-green-400">{code}</code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(code);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-white transition-colors"
                            >
                              <FiCopy className="w-3 h-3" />
                              Copy
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Try these if the primary code gives you an "Invalid MMI Code" error.
                    </p>
                  </div>
                )}

                {/* Clearing Codes */}
                {clearingCodes.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-white mb-3">
                      Clear Existing Forwarding (Use these first if having issues)
                    </label>
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <FiAlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-sm font-medium text-red-400">Clear existing settings first</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {clearingCodes.map((code, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                            <code className="text-xs font-mono text-red-400">{code}</code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(code);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }}
                              className="text-xs text-gray-400 hover:text-white"
                            >
                              <FiCopy className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Dial these codes first to clear any existing call forwarding, then try the main code.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            {forwardingCode && (
              <div className="space-y-6">
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    Setup Instructions
                  </h4>
                  <div className="space-y-2 text-gray-300">
                    <div className="flex items-start gap-3">
                      <FiAlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                      <span><strong>First:</strong> If you've had issues, dial ##21# to clear existing forwarding</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <FiWifi className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Disable WiFi calling</strong> temporarily (Settings → Phone → WiFi Calling → OFF)</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <FiPhone className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>Open your Phone app and dial the primary code exactly as shown</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <FiCheck className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>Press the Call button to activate forwarding</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <FiPhone className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>You'll see a confirmation message from your network if successful</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <FiSettings className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Re-enable WiFi calling</strong> after setup if you use it</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    Test the Forwarding
                  </h4>
                  <div className="space-y-2 text-gray-300">
                    <div className="flex items-start gap-3">
                      <FiPhone className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Have a friend call your mobile number</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <FiClock className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Don't answer and wait 15 seconds</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <FiCheck className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Your AI assistant will answer and handle the call professionally</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">⚠</span>
                    If Primary Code Doesn't Work
                  </h4>
                  <div className="space-y-2 text-gray-300 text-sm">
                    <div className="flex items-start gap-3">
                      <span className="text-orange-400 font-mono">1.</span>
                      <span>Try the alternative codes shown above</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-orange-400 font-mono">2.</span>
                      <span>Make sure WiFi calling is disabled</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-orange-400 font-mono">3.</span>
                      <span>Clear existing forwarding with ##21# first</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-orange-400 font-mono">4.</span>
                      <span>Contact your provider if none work - some plans restrict call forwarding</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                  <p className="text-sm text-gray-400">
                    <strong>Note:</strong> This forwards calls only when you don't answer within 15 seconds,
                    replacing your voicemail. Your AI assistant will handle these calls professionally
                    and you'll receive call summaries and transcripts.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>

    {/* Customer Support Modal */}
    <CustomerSupportModal
      isOpen={showSupportModal}
      onClose={() => setShowSupportModal(false)}
      defaultCategory="call_forwarding"
      defaultSubject="Call Forwarding Setup Issue"
      defaultDetails={`I'm having trouble setting up call forwarding for my phone number ${assignedPhoneNumber}. I've tried the provided codes but they're not working.`}
    />
    </>
  );
};

export default CallForwardingModal;
