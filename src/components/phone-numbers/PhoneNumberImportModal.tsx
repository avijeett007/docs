'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { FiX, FiCheck, FiLoader, FiPhone, FiAlertCircle, FiInfo } from 'react-icons/fi';

interface PhoneNumberImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  customerId?: string; // For partner portal usage
}

interface ImportableNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
  };
  status: string;
  isAlreadyImported: boolean;
  canImport: boolean;
  importedAt?: string;
  importedProvider?: string;
  availabilityStatus?: 'available' | 'already_imported_by_you' | 'already_imported_by_other' | 'unavailable';
  availabilityMessage?: string;
}

interface ProviderInfo {
  name: string;
  displayName: string;
  capabilities: any;
}

export default function PhoneNumberImportModal({
  isOpen,
  onClose,
  onImportComplete,
  customerId
}: PhoneNumberImportModalProps) {
  const [step, setStep] = useState<'provider' | 'credentials' | 'numbers' | 'importing'>('provider');
  const [selectedProvider, setSelectedProvider] = useState<'twilio' | 'telnyx' | null>(null);
  const [credentials, setCredentials] = useState<any>({});
  const [validatingCredentials, setValidatingCredentials] = useState(false);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [importableNumbers, setImportableNumbers] = useState<ImportableNumber[]>([]);
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const saveCredentials = true; // Always save credentials automatically

  const handleProviderSelect = (provider: 'twilio' | 'telnyx') => {
    setSelectedProvider(provider);
    setCredentials({});
    setStep('credentials');
  };

  const handleCredentialsSubmit = async () => {
    setValidatingCredentials(true);
    
    try {
      const apiEndpoint = customerId 
        ? `/api/partner/customers/${customerId}/phone-numbers/import/validate-credentials`
        : '/api/phone-numbers/import/validate-credentials';
      
      const headers: any = {
        'Content-Type': 'application/json'
      };
      
      if (customerId) {
        const token = localStorage.getItem('partner_token');
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: selectedProvider,
          credentials
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Credentials validated successfully');
        setProviderInfo(result.data);
        await loadImportableNumbers();
        setStep('numbers');
      } else {
        toast.error(result.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Error validating credentials:', error);
      toast.error('Failed to validate credentials');
    } finally {
      setValidatingCredentials(false);
    }
  };

  const loadImportableNumbers = async () => {
    setLoadingNumbers(true);
    
    try {
      const apiEndpoint = customerId 
        ? `/api/partner/customers/${customerId}/phone-numbers/import/list`
        : '/api/phone-numbers/import/list';
      
      const headers: any = {
        'Content-Type': 'application/json'
      };
      
      if (customerId) {
        const token = localStorage.getItem('partner_token');
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: selectedProvider,
          credentials,
          page: 0,
          limit: 50
        })
      });

      const result = await response.json();

      if (result.success) {
        setImportableNumbers(result.data.numbers);
      } else {
        toast.error(result.message || 'Failed to load phone numbers');
      }
    } catch (error) {
      console.error('Error loading numbers:', error);
      toast.error('Failed to load phone numbers');
    } finally {
      setLoadingNumbers(false);
    }
  };

  const handleImport = async () => {
    if (selectedNumbers.size === 0) {
      toast.error('Please select at least one phone number to import');
      return;
    }

    setImporting(true);
    setStep('importing');

    try {
      const numbersToImport = importableNumbers
        .filter(num => selectedNumbers.has(num.id))
        .map(num => ({
          id: num.id,
          phoneNumber: num.phoneNumber,
          friendlyName: num.friendlyName
        }));

      const apiEndpoint = customerId 
        ? `/api/partner/customers/${customerId}/phone-numbers/import`
        : '/api/phone-numbers/import';
      
      const headers: any = {
        'Content-Type': 'application/json'
      };
      
      if (customerId) {
        const token = localStorage.getItem('partner_token');
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: selectedProvider,
          credentials,
          numbers: numbersToImport,
          saveCredentials
        })
      });

      const result = await response.json();

      if (result.success) {
        const { imported, failed, skipped } = result.data;
        
        if (imported.length > 0) {
          toast.success(`Successfully imported ${imported.length} phone numbers`);
        }
        
        if (failed.length > 0) {
          toast.warning(`${failed.length} numbers failed to import`);
        }
        
        if (skipped.length > 0) {
          toast.info(`${skipped.length} numbers were skipped (already imported)`);
        }
        
        onImportComplete();
        onClose();
      } else {
        toast.error(result.message || 'Failed to import phone numbers');
      }
    } catch (error) {
      console.error('Error importing numbers:', error);
      toast.error('Failed to import phone numbers');
    } finally {
      setImporting(false);
    }
  };

  const toggleNumberSelection = (numberId: string) => {
    const newSelection = new Set(selectedNumbers);
    if (newSelection.has(numberId)) {
      newSelection.delete(numberId);
    } else {
      newSelection.add(numberId);
    }
    setSelectedNumbers(newSelection);
  };

  const selectAllAvailable = () => {
    const availableNumbers = importableNumbers.filter(n => n.canImport);
    setSelectedNumbers(new Set(availableNumbers.map(n => n.id)));
  };

  const clearSelection = () => {
    setSelectedNumbers(new Set());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-white">
                Import Phone Numbers
              </h3>
              <p className="text-gray-400">
                Import existing phone numbers from your provider account
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
              disabled={importing}
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center mb-8">
            <div className={`flex items-center ${step === 'provider' ? 'text-blue-400' : 'text-green-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'provider' ? 'bg-blue-500' : 'bg-green-500'
              }`}>
                {step === 'provider' ? '1' : <FiCheck className="w-4 h-4" />}
              </div>
              <span className="ml-2 text-sm">Select Provider</span>
            </div>
            <div className="flex-1 h-px bg-gray-700 mx-4" />
            <div className={`flex items-center ${
              step === 'credentials' ? 'text-blue-400' : 
              ['numbers', 'importing'].includes(step) ? 'text-green-400' : 'text-gray-500'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'credentials' ? 'bg-blue-500' : 
                ['numbers', 'importing'].includes(step) ? 'bg-green-500' : 'bg-gray-700'
              }`}>
                {['numbers', 'importing'].includes(step) ? <FiCheck className="w-4 h-4" /> : '2'}
              </div>
              <span className="ml-2 text-sm">Enter Credentials</span>
            </div>
            <div className="flex-1 h-px bg-gray-700 mx-4" />
            <div className={`flex items-center ${
              ['numbers', 'importing'].includes(step) ? 'text-blue-400' : 'text-gray-500'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                ['numbers', 'importing'].includes(step) ? 'bg-blue-500' : 'bg-gray-700'
              }`}>
                {step === 'importing' ? <FiLoader className="w-4 h-4 animate-spin" /> : '3'}
              </div>
              <span className="ml-2 text-sm">Select Numbers</span>
            </div>
          </div>

          {/* Step Content */}
          {step === 'provider' && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-white mb-4">
                Choose your phone number provider
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleProviderSelect('twilio')}
                  className="p-6 border-2 border-gray-700 rounded-lg hover:border-blue-500 transition-colors text-left"
                >
                  <div className="flex items-center mb-3">
                    <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                      <FiPhone className="w-6 h-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <h5 className="text-lg font-medium text-white">Twilio</h5>
                      <p className="text-sm text-gray-400">Import from Twilio account</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300">
                    Requires Account SID and Auth Token from your Twilio console
                  </p>
                </button>

                <button
                  disabled={!process.env.NEXT_PUBLIC_ENABLE_TELNYX_PROVIDER}
                  onClick={() => process.env.NEXT_PUBLIC_ENABLE_TELNYX_PROVIDER && handleProviderSelect('telnyx')}
                  className={`p-6 border-2 rounded-lg text-left relative transition-all duration-200 ${
                    process.env.NEXT_PUBLIC_ENABLE_TELNYX_PROVIDER
                      ? 'border-gray-600 hover:border-purple-500 cursor-pointer hover:bg-purple-500/5'
                      : 'border-gray-700 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center mb-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      process.env.NEXT_PUBLIC_ENABLE_TELNYX_PROVIDER
                        ? 'bg-purple-500/20'
                        : 'bg-purple-500/50'
                    }`}>
                      <FiPhone className={`w-6 h-6 ${
                        process.env.NEXT_PUBLIC_ENABLE_TELNYX_PROVIDER
                          ? 'text-purple-400'
                          : 'text-white/50'
                      }`} />
                    </div>
                    <div className="ml-4">
                      <h5 className={`text-lg font-medium ${
                        process.env.NEXT_PUBLIC_ENABLE_TELNYX_PROVIDER
                          ? 'text-white'
                          : 'text-gray-400'
                      }`}>Telnyx</h5>
                      <p className={`text-sm ${
                        process.env.NEXT_PUBLIC_ENABLE_TELNYX_PROVIDER
                          ? 'text-gray-300'
                          : 'text-gray-500'
                      }`}>Import from Telnyx account</p>
                    </div>
                  </div>
                  <p className={`text-sm ${
                    process.env.NEXT_PUBLIC_ENABLE_TELNYX_PROVIDER
                      ? 'text-gray-300'
                      : 'text-gray-500'
                  }`}>
                    Requires API Key from your Telnyx portal
                  </p>
                  {!process.env.NEXT_PUBLIC_ENABLE_TELNYX_PROVIDER && (
                    <div className="absolute top-2 right-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                        Coming Soon
                      </span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'credentials' && selectedProvider && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-white mb-4">
                Enter {selectedProvider === 'twilio' ? 'Twilio' : 'Telnyx'} Credentials
              </h4>

              {selectedProvider === 'twilio' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Account SID
                    </label>
                    <input
                      type="text"
                      value={credentials.accountSid || ''}
                      onChange={(e) => setCredentials({ ...credentials, accountSid: e.target.value })}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Found in your Twilio Console dashboard
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Auth Token
                    </label>
                    <input
                      type="password"
                      value={credentials.authToken || ''}
                      onChange={(e) => setCredentials({ ...credentials, authToken: e.target.value })}
                      placeholder="Your Auth Token"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Click "Show" next to Auth Token in your Twilio Console
                    </p>
                  </div>
                </div>
              )}

              {selectedProvider === 'telnyx' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={credentials.apiKey || ''}
                    onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
                    placeholder="KEYxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Generate an API Key in your Telnyx Portal under API Keys
                  </p>
                </div>
              )}

              <div className="flex items-start p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <div className="flex items-start">
                  <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                    <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-300 font-medium">
                      Credentials Saved Automatically
                    </p>
                    <p className="text-xs text-blue-200/80 mt-1">
                      Your credentials will be securely encrypted and saved for future imports and managing your voice AI agents.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep('provider')}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                  disabled={validatingCredentials}
                >
                  Back
                </button>
                <button
                  onClick={handleCredentialsSubmit}
                  disabled={validatingCredentials || !credentials.accountSid && !credentials.apiKey}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {validatingCredentials ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin mr-2" />
                      Validating...
                    </>
                  ) : (
                    'Validate & Continue'
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'numbers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-medium text-white">
                  Select Numbers to Import
                </h4>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={selectAllAvailable}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Select All Available
                  </button>
                  <span className="text-gray-500">|</span>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-400 hover:text-gray-300"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              {loadingNumbers ? (
                <div className="flex items-center justify-center py-12">
                  <FiLoader className="w-8 h-8 animate-spin text-blue-400" />
                  <span className="ml-3 text-gray-300">Loading phone numbers...</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {importableNumbers.map((number) => (
                    <div
                      key={number.id}
                      className={`p-4 border rounded-lg ${
                        number.canImport
                          ? selectedNumbers.has(number.id)
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-700 hover:border-gray-600'
                          : 'border-gray-800 bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          {number.canImport && (
                            <input
                              type="checkbox"
                              checked={selectedNumbers.has(number.id)}
                              onChange={() => toggleNumberSelection(number.id)}
                              className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 mr-3"
                            />
                          )}
                          <div>
                            <div className="flex items-center">
                              <span className="text-white font-medium">
                                {number.phoneNumber}
                              </span>
                              {number.friendlyName && number.friendlyName !== number.phoneNumber && (
                                <span className="text-gray-400 ml-2">
                                  ({number.friendlyName})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center mt-1 space-x-4">
                              <div className="flex items-center space-x-2">
                                {number.capabilities.voice && (
                                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                                    Voice
                                  </span>
                                )}
                                {number.capabilities.sms && (
                                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                    SMS
                                  </span>
                                )}
                                {number.capabilities.mms && (
                                  <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                                    MMS
                                  </span>
                                )}
                                {number.capabilities.fax && (
                                  <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded">
                                    Fax
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {(() => {
                            const status = number.availabilityStatus || 'available';
                            const message = number.availabilityMessage || 'Available';

                            switch (status) {
                              case 'available':
                                return (
                                  <div className="flex items-center text-green-400">
                                    <FiCheck className="w-4 h-4 mr-1" />
                                    <span className="text-sm">{message}</span>
                                  </div>
                                );
                              case 'already_imported_by_you':
                                return (
                                  <div className="flex items-center text-blue-400">
                                    <FiInfo className="w-4 h-4 mr-1" />
                                    <span className="text-sm">{message}</span>
                                  </div>
                                );
                              case 'already_imported_by_other':
                                return (
                                  <div className="flex items-center text-yellow-400">
                                    <FiAlertCircle className="w-4 h-4 mr-1" />
                                    <span className="text-sm">{message}</span>
                                  </div>
                                );
                              case 'unavailable':
                              default:
                                return (
                                  <div className="flex items-center text-red-400">
                                    <FiAlertCircle className="w-4 h-4 mr-1" />
                                    <span className="text-sm">{message}</span>
                                  </div>
                                );
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary Section */}
              {!loadingNumbers && importableNumbers.length > 0 && (
                <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-white">
                        {importableNumbers.length}
                      </div>
                      <div className="text-xs text-gray-400">Total Numbers</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-green-400">
                        {importableNumbers.filter(n => n.canImport).length}
                      </div>
                      <div className="text-xs text-gray-400">Available</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-yellow-400">
                        {importableNumbers.filter(n => n.availabilityStatus === 'already_imported_by_other').length}
                      </div>
                      <div className="text-xs text-gray-400">Already Taken</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-blue-400">
                        {selectedNumbers.size}
                      </div>
                      <div className="text-xs text-gray-400">Selected</div>
                    </div>
                  </div>

                  {importableNumbers.filter(n => n.canImport).length === 0 && (
                    <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-center">
                        <FiAlertCircle className="w-4 h-4 text-yellow-400 mr-2" />
                        <span className="text-yellow-400 text-sm">
                          No numbers are available for import. All numbers are either already imported or unavailable.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep('credentials')}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedNumbers.size === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import {selectedNumbers.size} Numbers
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="text-center py-12">
              <FiLoader className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-white mb-2">
                Importing Phone Numbers
              </h4>
              <p className="text-gray-400">
                Please wait while we import your selected phone numbers...
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
