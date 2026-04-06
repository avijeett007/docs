'use client';

import React, { useState, useCallback } from 'react';
import { FiX, FiChevronRight, FiChevronLeft, FiUpload, FiCheck, FiAlertCircle, FiGlobe, FiFileText, FiSend } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface PhoneActivationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitComplete: () => void;
}

interface BusinessAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface DocumentFile {
  type: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  file?: File;
}

const SUPPORTED_COUNTRIES = [
  { code: 'AU', name: 'Australia' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'BE', name: 'Belgium' },
  { code: 'IE', name: 'Ireland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PL', name: 'Poland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'ZA', name: 'South Africa' },
];

// Country-specific registration authority mapping
// Twilio uses these to validate business registration numbers
const COUNTRY_REGISTRATION_AUTHORITY: Record<string, { value: string; label: string; numberLabel: string }> = {
  GB: { value: 'UK:CRN', label: 'Companies Registration Number (CRN)', numberLabel: 'CRN Number' },
  US: { value: 'US:EIN', label: 'Employer Identification Number (EIN)', numberLabel: 'EIN Number' },
  CA: { value: 'CA:CBN', label: 'Canadian Business Number (CBN)', numberLabel: 'CBN Number' },
  AU: { value: 'AU:ACN', label: 'Australian Company Number (ACN)', numberLabel: 'ACN Number' },
  NZ: { value: 'NZ:NZBN', label: 'NZ Business Number (NZBN)', numberLabel: 'NZBN Number' },
  DE: { value: 'DE:HRB', label: 'Handelsregister (HRB)', numberLabel: 'HRB Number' },
  FR: { value: 'FR:SIREN', label: 'SIREN Number', numberLabel: 'SIREN Number' },
  IN: { value: 'IN:CIN', label: 'Corporate Identity Number (CIN)', numberLabel: 'CIN Number' },
  SG: { value: 'SG:UEN', label: 'Unique Entity Number (UEN)', numberLabel: 'UEN Number' },
};

const DOCUMENT_TYPES = [
  { value: 'business_registration', label: 'Business Registration Certificate' },
  { value: 'address_proof', label: 'Proof of Address (Utility Bill, Bank Statement)' },
  { value: 'identity_proof', label: 'Government-Issued ID' },
  { value: 'authorization_letter', label: 'Authorization Letter' },
];

const BUSINESS_TYPES = [
  { value: 'corporation', label: 'Corporation' },
  { value: 'llc', label: 'LLC' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'sole_proprietor', label: 'Sole Proprietor' },
  { value: 'non_profit', label: 'Non-Profit' },
  { value: 'government', label: 'Government' },
];

export default function PhoneActivationWizard({ isOpen, onClose, onSubmitComplete }: PhoneActivationWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Country & Business Info
  const [country, setCountry] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessAddress, setBusinessAddress] = useState<BusinessAddress>({
    street: '', city: '', state: '', postalCode: '', country: '',
  });
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
  const [businessRegistrationAuthority, setBusinessRegistrationAuthority] = useState('');
  const [businessWebsite, setBusinessWebsite] = useState('');
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Step 2: Documents
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Step 3: Number type preference
  const [numberType, setNumberType] = useState('mobile');

  const resetForm = useCallback(() => {
    setStep(1);
    setError('');
    setCountry('');
    setBusinessName('');
    setBusinessType('');
    setBusinessAddress({ street: '', city: '', state: '', postalCode: '', country: '' });
    setBusinessRegistrationNumber('');
    setBusinessRegistrationAuthority('');
    setBusinessWebsite('');
    setContactFirstName('');
    setContactLastName('');
    setContactEmail('');
    setContactPhone('');
    setDocuments([]);
    setNumberType('mobile');
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Validate step 1
  const isStep1Valid = () => {
    return country && businessName && contactFirstName && contactLastName &&
      contactEmail && contactPhone && businessAddress.street &&
      businessAddress.city && businessAddress.state && businessAddress.postalCode;
  };

  // Validate step 2
  const isStep2Valid = () => {
    return documents.length > 0;
  };

  const handleCountryChange = (code: string) => {
    setCountry(code);
    setBusinessAddress(prev => ({ ...prev, country: code }));
    // Auto-fill registration authority based on country
    const countryAuth = COUNTRY_REGISTRATION_AUTHORITY[code];
    setBusinessRegistrationAuthority(countryAuth?.value || '');
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setUploadingDoc(true);
    setError('');

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) throw new Error('Not authenticated');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', docType);
      formData.append('folder', 'phone-activation');

      const response = await fetch('/api/partner/phone-activation/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();

      setDocuments(prev => [...prev, {
        type: docType,
        name: file.name,
        url: data.data.url,
        size: file.size,
        mimeType: file.type,
      }]);

      toast.success(`${file.name} uploaded successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/partner/phone-activation/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          country,
          businessName,
          businessType,
          businessAddress,
          businessRegistrationNumber: businessRegistrationNumber || undefined,
          businessRegistrationAuthority: businessRegistrationAuthority || undefined,
          businessWebsite: businessWebsite || undefined,
          contactFirstName,
          contactLastName,
          contactEmail,
          contactPhone,
          documents,
          numberType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Submission failed');
      }

      toast.success('Phone service activation submitted successfully!');
      handleClose();
      onSubmitComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit activation');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const countryName = SUPPORTED_COUNTRIES.find(c => c.code === country)?.name || country;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Activate Phone Service</h2>
            <p className="text-sm text-gray-500 mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center space-x-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex items-center">
                <div className={`flex-1 h-2 rounded-full ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span className={step >= 1 ? 'text-blue-600 font-medium' : ''}>Business Info</span>
            <span className={step >= 2 ? 'text-blue-600 font-medium' : ''}>Documents</span>
            <span className={step >= 3 ? 'text-blue-600 font-medium' : ''}>Review</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1: Country & Business Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FiGlobe className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">Country & Business Information</h3>
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="">Select a country</option>
                  {SUPPORTED_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Business Name & Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Your business name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="">Select type</option>
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Business Registration (for Twilio regulatory compliance) */}
              {country && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-700">
                    Business Registration Details
                    <span className="text-xs text-gray-500 ml-1">(for regulatory compliance)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {COUNTRY_REGISTRATION_AUTHORITY[country]?.numberLabel || 'Registration Number'}
                      </label>
                      <input
                        type="text"
                        value={businessRegistrationNumber}
                        onChange={(e) => setBusinessRegistrationNumber(e.target.value)}
                        placeholder={COUNTRY_REGISTRATION_AUTHORITY[country]?.numberLabel || 'Business registration number'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Registration Authority</label>
                      <input
                        type="text"
                        value={COUNTRY_REGISTRATION_AUTHORITY[country]?.label || businessRegistrationAuthority || 'Other'}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Business Website</label>
                    <input
                      type="url"
                      value={businessWebsite}
                      onChange={(e) => setBusinessWebsite(e.target.value)}
                      placeholder="https://www.yourbusiness.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">Public website or verified social media page</p>
                  </div>
                </div>
              )}

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Address *</label>
                <input
                  type="text"
                  value={businessAddress.street}
                  onChange={(e) => setBusinessAddress(prev => ({ ...prev, street: e.target.value }))}
                  placeholder="Street address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2 text-gray-900"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={businessAddress.city}
                    onChange={(e) => setBusinessAddress(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                  <input
                    type="text"
                    value={businessAddress.state}
                    onChange={(e) => setBusinessAddress(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="State/Region"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                  <input
                    type="text"
                    value={businessAddress.postalCode}
                    onChange={(e) => setBusinessAddress(prev => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="Postal Code"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Information *</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    value={contactFirstName}
                    onChange={(e) => setContactFirstName(e.target.value)}
                    placeholder="First name"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                  <input
                    type="text"
                    value={contactLastName}
                    onChange={(e) => setContactLastName(e.target.value)}
                    placeholder="Last name"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Email address"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Phone number"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              </div>
            </div>
          )}


          {/* Step 2: Upload Documents */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FiFileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">Upload Documents</h3>
              </div>

              <p className="text-sm text-gray-600">
                Upload the required documents for regulatory compliance in {countryName}.
                At least one document is required.
              </p>

              {/* Document upload sections */}
              {DOCUMENT_TYPES.map((docType) => {
                const existingDoc = documents.find(d => d.type === docType.value);
                return (
                  <div key={docType.value} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">{docType.label}</label>
                      {existingDoc && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <FiCheck className="w-3 h-3" /> Uploaded
                        </span>
                      )}
                    </div>

                    {existingDoc ? (
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <FiFileText className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-700 truncate max-w-[200px]">{existingDoc.name}</span>
                          <span className="text-xs text-gray-400">
                            ({(existingDoc.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => removeDocument(documents.indexOf(existingDoc))}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <FiUpload className="w-4 h-4" />
                          <span>{uploadingDoc ? 'Uploading...' : 'Click to upload'}</span>
                        </div>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(e) => handleDocumentUpload(e, docType.value)}
                          disabled={uploadingDoc}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FiSend className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">Review & Submit</h3>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Please review your information before submitting. Once submitted, we&apos;ll process your
                activation and notify you when it&apos;s approved.
              </p>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Country</span>
                  <span className="text-sm font-medium text-gray-900">{countryName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Business Name</span>
                  <span className="text-sm font-medium text-gray-900">{businessName}</span>
                </div>
                {businessType && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Business Type</span>
                    <span className="text-sm font-medium text-gray-900">
                      {BUSINESS_TYPES.find(t => t.value === businessType)?.label || businessType}
                    </span>
                  </div>
                )}
                {businessRegistrationNumber && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Registration Number</span>
                    <span className="text-sm font-medium text-gray-900">{businessRegistrationNumber}</span>
                  </div>
                )}
                {businessRegistrationAuthority && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Registration Authority</span>
                    <span className="text-sm font-medium text-gray-900">
                      {COUNTRY_REGISTRATION_AUTHORITY[country]?.label || businessRegistrationAuthority}
                    </span>
                  </div>
                )}
                {businessWebsite && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Website</span>
                    <span className="text-sm font-medium text-gray-900 truncate max-w-[60%]">{businessWebsite}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Address</span>
                  <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">
                    {businessAddress.street}, {businessAddress.city}, {businessAddress.state} {businessAddress.postalCode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Contact</span>
                  <span className="text-sm font-medium text-gray-900">
                    {contactFirstName} {contactLastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Email</span>
                  <span className="text-sm font-medium text-gray-900">{contactEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Phone</span>
                  <span className="text-sm font-medium text-gray-900">{contactPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Number Type</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">{numberType}</span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <span className="text-sm text-gray-500">Documents ({documents.length})</span>
                  <div className="mt-1 space-y-1">
                    {documents.map((doc, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <FiCheck className="w-3 h-3 text-green-500" />
                        <span>{DOCUMENT_TYPES.find(t => t.value === doc.type)?.label || doc.type}</span>
                        <span className="text-gray-400">— {doc.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Number type preference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Number Type</label>
                <div className="flex gap-3">
                  <label className={`flex-1 flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${numberType === 'mobile' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="numberType" value="mobile" checked={numberType === 'mobile'} onChange={() => setNumberType('mobile')} className="text-blue-600" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Mobile</span>
                      <p className="text-xs text-gray-500">Voice + SMS capable</p>
                    </div>
                  </label>
                  <label className={`flex-1 flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${numberType === 'local' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="numberType" value="local" checked={numberType === 'local'} onChange={() => setNumberType('local')} className="text-blue-600" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Local</span>
                      <p className="text-xs text-gray-500">Voice only (no SMS)</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  <strong>What happens next?</strong> We&apos;ll create a dedicated phone account for your business,
                  submit your documents for verification, and notify you once approved. This usually takes 1-3 business days.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={step === 1 ? handleClose : () => { setStep(step - 1); setError(''); }}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            {step === 1 ? (
              'Cancel'
            ) : (
              <>
                <FiChevronLeft className="w-4 h-4" />
                Back
              </>
            )}
          </button>

          {step < 3 ? (
            <button
              onClick={() => { setStep(step + 1); setError(''); }}
              disabled={(step === 1 && !isStep1Valid()) || (step === 2 && !isStep2Valid())}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <FiChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-1 px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                <>
                  <FiSend className="w-4 h-4" />
                  Submit Activation
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}