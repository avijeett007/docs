'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  FiPhone,
  FiPlus,
  FiSearch,
  FiMoreVertical,
  FiTrash2,
  FiUpload,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiDollarSign,
  FiLoader,
  FiDownload
} from 'react-icons/fi';
import { PhoneNumberSearch } from '../whitelabel/phone-numbers/PhoneNumberSearch';
import { DocumentUploadModal } from '../whitelabel/phone-numbers/DocumentUploadModal';
import BusinessVerificationModal from '../whitelabel/phone-numbers/BusinessVerificationModal';
import PhoneNumberImportModal from '../phone-numbers/PhoneNumberImportModal';

interface CustomerPhoneNumberManagementProps {
  customerId: string;
  customerName: string;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string;
  countryCode: string;
  region: string;
  locality: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
  };
  type: string;
  status: string;
  monthlyRecurringCost: number;
  activeAgents: number;
  approvedDocuments: number;
  purchasedAt: string;
  createdAt: string;
  releasedAt?: string;
}

export default function CustomerPhoneNumberManagement({ 
  customerId, 
  customerName 
}: CustomerPhoneNumberManagementProps) {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Document management state
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<PhoneNumber | null>(null);

  // Business verification state
  const [showBusinessVerification, setShowBusinessVerification] = useState(false);
  const [verificationPhoneNumber, setVerificationPhoneNumber] = useState('');

  // Fetch phone numbers for this customer
  const fetchPhoneNumbers = async () => {
    try {
      setLoading(true);

      // Get partner token for authentication
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('No partner token found');
      }

      const response = await fetch(`/api/partner/customers/${customerId}/phone-numbers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch phone numbers');
      }

      const result = await response.json();

      if (result.success) {
        setPhoneNumbers(result.data.phoneNumbers || []);
      } else {
        toast.error(result.message || 'Failed to load phone numbers');
      }
    } catch (error) {
      console.error('Error fetching phone numbers:', error);
      toast.error('Failed to load phone numbers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchPhoneNumbers();
    }
  }, [customerId, refreshKey]);

  const handlePurchaseComplete = () => {
    setShowSearch(false);
    setRefreshKey(prev => prev + 1); // Trigger refresh
    toast.success('Phone number purchased successfully!');
  };

  const handleImportComplete = () => {
    setShowImport(false);
    setRefreshKey(prev => prev + 1); // Trigger refresh
  };

  const handleReleaseNumber = async (phoneNumberId: string, phoneNumber: string) => {
    if (!confirm(`Are you sure you want to release ${phoneNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Get partner token for authentication
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('No partner token found');
      }

      const response = await fetch(`/api/partner/customers/${customerId}/phone-numbers/${phoneNumberId}/release`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to release phone number');
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Phone number released successfully');
        setRefreshKey(prev => prev + 1); // Trigger refresh
      } else {
        toast.error(result.message || 'Failed to release phone number');
      }
    } catch (error) {
      console.error('Error releasing phone number:', error);
      toast.error('Failed to release phone number');
    }
  };

  const handleManageDocuments = (phoneNumberId: string, phoneNumber: string) => {
    const phoneNumberObj = phoneNumbers.find(pn => pn.id === phoneNumberId);
    if (phoneNumberObj) {
      setSelectedPhoneNumber(phoneNumberObj);
      setShowDocumentUpload(true);
    }
  };

  const handleBusinessVerification = (phoneNumber: string, countryCode: string) => {
    setVerificationPhoneNumber(phoneNumber);
    setShowBusinessVerification(true);
  };

  const handleDocumentUploadComplete = () => {
    setShowDocumentUpload(false);
    setSelectedPhoneNumber(null);
    setRefreshKey(prev => prev + 1); // Trigger refresh
    toast.success('Document uploaded successfully!');
  };

  const handleBusinessVerificationComplete = () => {
    setShowBusinessVerification(false);
    setVerificationPhoneNumber('');
    setRefreshKey(prev => prev + 1); // Trigger refresh
    toast.success('Business verification submitted successfully!');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'Active', color: 'bg-green-500', icon: FiCheckCircle },
      pending: { label: 'Pending', color: 'bg-yellow-500', icon: FiAlertCircle },
      suspended: { label: 'Suspended', color: 'bg-red-500', icon: FiXCircle },
      released: { label: 'Released', color: 'bg-gray-500', icon: FiXCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <FiLoader className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-400">Loading phone numbers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Phone Numbers</h3>
          <p className="text-sm text-gray-400">
            Manage phone numbers for {customerName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all"
          >
            <FiDownload className="w-4 h-4" />
            Import Numbers
          </button>
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all"
          >
            <FiPlus className="w-4 h-4" />
            Buy Phone Number
          </button>
        </div>
      </div>

      {/* Phone Numbers List */}
      {phoneNumbers.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/50 rounded-xl">
          <FiPhone className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-white mb-2">No Phone Numbers</h4>
          <p className="text-gray-400 mb-4">
            This customer doesn't have any phone numbers yet.
          </p>
          <p className="text-gray-500 text-sm">Use the buttons above to import existing numbers or buy new ones.</p>
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Phone Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Monthly Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Active Agents
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {phoneNumbers.map((number) => (
                  <tr key={number.id} className="hover:bg-gray-700/30">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FiPhone className="w-4 h-4 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-white">
                            {number.phoneNumber}
                          </div>
                          {number.friendlyName && (
                            <div className="text-sm text-gray-400">
                              {number.friendlyName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {number.locality}, {number.region}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 capitalize">
                      {number.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(number.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div className="flex items-center">
                        <FiDollarSign className="w-3 h-3 mr-1" />
                        {(number.monthlyRecurringCost / 100).toFixed(2)}/mo
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {number.activeAgents}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleManageDocuments(number.id, number.phoneNumber)}
                          className="text-blue-400 hover:text-blue-300 p-1 rounded"
                          title="Upload Documents"
                        >
                          <FiUpload className="w-4 h-4" />
                        </button>

                        {number.countryCode !== 'US' && (
                          <button
                            onClick={() => handleBusinessVerification(number.phoneNumber, number.countryCode)}
                            className="text-green-400 hover:text-green-300 p-1 rounded"
                            title="Business Verification"
                          >
                            <FiCheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        {number.status === 'active' && (
                          <button
                            onClick={() => handleReleaseNumber(number.id, number.phoneNumber)}
                            className="text-red-400 hover:text-red-300 p-1 rounded"
                            title="Release Number"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        )}

                        <button className="text-gray-400 hover:text-white p-1 rounded">
                          <FiMoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Phone Number Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    Buy Phone Number for {customerName}
                  </h3>
                  <p className="text-gray-400">
                    Search and purchase a phone number for this customer
                  </p>
                </div>
                <button
                  onClick={() => setShowSearch(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <FiXCircle className="w-6 h-6" />
                </button>
              </div>
              
              <PhoneNumberSearch 
                onPurchaseComplete={handlePurchaseComplete}
                customerId={customerId}
              />
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {showDocumentUpload && selectedPhoneNumber && (
        <DocumentUploadModal
          isOpen={showDocumentUpload}
          phoneNumberId={selectedPhoneNumber.id}
          phoneNumber={selectedPhoneNumber}
          customerId={customerId}
          onClose={() => {
            setShowDocumentUpload(false);
            setSelectedPhoneNumber(null);
          }}
          onUploadComplete={handleDocumentUploadComplete}
        />
      )}

      {/* Business Verification Modal */}
      {showBusinessVerification && (
        <BusinessVerificationModal
          isOpen={showBusinessVerification}
          onClose={() => {
            setShowBusinessVerification(false);
            setVerificationPhoneNumber('');
          }}
          phoneNumber={verificationPhoneNumber}
          countryCode={selectedPhoneNumber?.countryCode || 'US'}
          numberType={selectedPhoneNumber?.type || 'local'}
          customerId={customerId}
        />
      )}

      {/* Phone Number Import Modal */}
      <PhoneNumberImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImportComplete={handleImportComplete}
        customerId={customerId}
      />
    </div>
  );
}
