'use client';

import React, { useState, useEffect, Suspense } from 'react';
import {
  Building2,
  Handshake,
  Code2,
  Users,
  Rocket,
  Mail,
  Phone,
  Building,
  Globe,
  BookOpen,
  CheckCircle2,
  X
} from 'lucide-react';
import { Dialog } from '@headlessui/react';
import { useSearchParams } from 'next/navigation';
import PartnerHeader from '@/components/PartnerHeader';
import Footer from '@/components/Footer';
import PhoneInput from 'react-phone-input-2';
import PricingSection from '@/components/PricingSection';
import 'react-phone-input-2/lib/style.css';

interface PartnerType {
  icon: React.ElementType;
  title: string;
  description: string;
  benefits: string[];
  isActive?: boolean;
}

const partnerTypes: PartnerType[] = [
  {
    icon: Building2,
    title: "Technology Partners",
    description: "Integrate your technology solutions with our platform to create powerful, unified experiences for customers.",
    benefits: [
      "API integration support",
      "Joint product development",
      "Technical documentation",
      "Co-marketing opportunities"
    ],
    isActive: false
  },
  {
    icon: Handshake,
    title: "Business Partners",
    description: "Perfect for agencies and consultants. Resell our platform under your brand, manage multiple clients, and grow your business with our comprehensive partner tools.",
    benefits: [
      "Dedicated dashboard for each client",
      "Centralized partner portal for account management",
      "Custom pricing control and markup options",
      "White-label branding capabilities"
    ],
    isActive: true
  },
  {
    icon: Rocket,
    title: "Founding Partners",
    description: "Join us at the ground level and shape the future of AI-powered business communication.",
    benefits: [
      "Early access to features",
      "Strategic input opportunities",
      "Premium support",
      "Enhanced revenue sharing"
    ],
    isActive: false
  },
  {
    icon: Code2,
    title: "Developer Partners",
    description: "Build innovative solutions and extensions on our platform to serve unique business needs.",
    benefits: [
      "Developer SDK access",
      "Technical support",
      "Testing environments",
      "Developer community access"
    ],
    isActive: false
  }
];

// Dropdown options
const expertiseOptions = [
  "Digital Marketing",
  "Lead Generation",
  "Sales Automation",
  "CRM Implementation",
  "Business Consulting",
  "Marketing Strategy",
  "Social Media Management",
  "Email Marketing",
  "Content Marketing",
  "SEO Services",
  "Web Development",
  "Other"
];

const areaOfBusinessOptions = [
  "Marketing Agency",
  "Digital Agency",
  "Business Consulting",
  "Sales Agency",
  "IT Services",
  "Professional Services",
  "Marketing Technology",
  "Business Services",
  "Other"
];

const learningSourceOptions = [
  "LinkedIn",
  "Google Search",
  "Referral",
  "Social Media",
  "Email Campaign",
  "Conference/Event",
  "Partner Network",
  "Industry Publication",
  "Other"
];

const popularCountries = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "India",
  "Singapore",
  "Germany",
  "France",
  "Netherlands",
  "United Arab Emirates",
  // Add more popular countries here
];

const allCountries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Austria", "Azerbaijan", 
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", 
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", 
  "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", 
  "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "East Timor", 
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Fiji", "Finland", 
  "Gabon", "Gambia", "Georgia", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", 
  "Haiti", "Honduras", "Hungary", "Iceland", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", 
  "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", 
  "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Macedonia", "Madagascar", 
  "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", 
  "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", 
  "Nauru", "Nepal", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "Norway", "Oman", "Pakistan", 
  "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", 
  "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", 
  "Samoa", "San Marino", "Sao Tome and pricipe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", 
  "Sierra Leone", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", 
  "Spain", "Sri Lanka", "Sudan", "Suriname", "Swaziland", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", 
  "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", 
  "Uganda", "Ukraine", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", 
  "Zambia", "Zimbabwe"
].filter(country => !popularCountries.includes(country)).sort();

interface PartnerFormData {
  businessName: string;
  contactName: string;
  businessAddress: string;
  emailAddress: string;
  phoneNumber: string;
  areaOfBusiness: string;
  customAreaOfBusiness: string;
  expertise: string;
  customExpertise: string;
  learningSource: string;
  partnershipType: string;
  country: string;
  logo?: File;
}

interface AnimationPosition {
  x: number;
  y: number;
}

interface SubmitFormData extends Omit<PartnerFormData, 'customAreaOfBusiness' | 'customExpertise'> {
  customAreaOfBusiness?: string;
  customExpertise?: string;
}

function PartnersPageContent() {
  const searchParams = useSearchParams();
  const urlPartnerId = searchParams?.get('partnerId');
  const urlStep = searchParams?.get('step');

  const [currentStep, setCurrentStep] = useState(
    urlStep === 'payment' ? 2 : urlStep === 'pricing' ? 2 : 1
  ); // Step 1: Form, Step 2: Pricing
  const [partnerId, setPartnerId] = useState<string>(urlPartnerId || '');
  const [isPartnerFormOpen, setIsPartnerFormOpen] = useState(false);
  const [formData, setFormData] = useState<PartnerFormData>({
    businessName: '',
    contactName: '',
    businessAddress: '',
    emailAddress: '',
    phoneNumber: '',
    areaOfBusiness: '',
    customAreaOfBusiness: '',
    expertise: '',
    customExpertise: '',
    learningSource: '',
    partnershipType: 'Business',
    country: ''
  });
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showCustomAreaOfBusiness, setShowCustomAreaOfBusiness] = useState(false);
  const [showCustomExpertise, setShowCustomExpertise] = useState(false);
  const [animationPosition, setAnimationPosition] = useState<AnimationPosition>({ x: 0, y: 0 });

  // Background animation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPosition({
        x: Math.random() * 100 - 50,
        y: Math.random() * 100 - 50,
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Handle URL parameters for quick signup flow
  useEffect(() => {
    if (urlPartnerId && urlStep === 'pricing') {
      // Partner created via quick signup, show pricing selection
      setCurrentStep(2);
      setPartnerId(urlPartnerId);
    } else if (urlPartnerId && urlStep === 'payment') {
      // Partner created with pre-selected plan, show payment step
      setCurrentStep(2);
      setPartnerId(urlPartnerId);
    }
  }, [urlPartnerId, urlStep]);

  const validateForm = (): string | null => {
    // Required fields validation
    const requiredFields = {
      businessName: 'Business Name',
      contactName: 'Contact Name',
      businessAddress: 'Business Address',
      emailAddress: 'Email Address',
      phoneNumber: 'Phone Number',
      areaOfBusiness: 'Area of Business',
      expertise: 'Expertise',
      learningSource: 'Learning Source',
      country: 'Country'
    };

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!formData[field as keyof typeof formData]) {
        return `${label} is required`;
      }
    }

    // Business email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.emailAddress)) {
      return 'Please enter a valid email address';
    }

    // Validate custom fields if "Other" is selected
    if (formData.areaOfBusiness === 'Other' && !formData.customAreaOfBusiness) {
      return 'Please specify your Area of Business';
    }

    if (formData.expertise === 'Other' && !formData.customExpertise) {
      return 'Please specify your Expertise';
    }

    // Phone number validation (basic check for minimum length)
    if (formData.phoneNumber.replace(/\D/g, '').length < 10) {
      return 'Please enter a valid phone number';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      // Handle custom fields
      const finalAreaOfBusiness = formData.areaOfBusiness === 'Other' 
        ? formData.customAreaOfBusiness 
        : formData.areaOfBusiness;
        
      const finalExpertise = formData.expertise === 'Other'
        ? formData.customExpertise
        : formData.expertise;

      // Create a new object with the fields we want to submit
      const fieldsToSubmit: SubmitFormData = {
        ...formData,
        areaOfBusiness: finalAreaOfBusiness,
        expertise: finalExpertise,
      };

      // Now we can safely delete the optional properties
      delete fieldsToSubmit.customAreaOfBusiness;
      delete fieldsToSubmit.customExpertise;

      // Create FormData and append all fields
      const submitFormData = new FormData();
      Object.entries(fieldsToSubmit).forEach(([key, value]) => {
        if (value !== undefined) {
          submitFormData.append(key, value);
        }
      });

      // Append logo if selected
      if (selectedLogo) {
        submitFormData.append('logo', selectedLogo);
      }

      /**
       * Capture referral ID for internal tracking purposes:
       * 1. Pass to Stripe checkout sessions as metadata
       * 2. Track conversions when users upgrade to paid plans
       * 3. Rewardful handles lead tracking automatically via client-side JS
       * Note: We don't store this in database since Rewardful manages lead attribution
       */
      const { getReferralId } = await import('@/lib/referral-tracking');
      const referralId = getReferralId();
      if (referralId) {
        submitFormData.append('referralId', referralId);
      }

      // Submit partner info
      const response = await fetch('/api/partners/register', {
        method: 'POST',
        body: submitFormData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit partner application');
      }

      // Store partner ID and move to pricing step
      setPartnerId(data.data.partnerId);
      setCurrentStep(2);
      
    } catch (err) {
      setError('Failed to submit partner application. Please try again.');
    }
  };

  const handlePaymentComplete = async (planId: string, billingInterval: 'monthly' | 'yearly') => {
    try {
      if (!partnerId) {
        throw new Error('Partner ID is missing. Please try registering again.');
      }

      // Call the API to set password and send welcome email
      const response = await fetch('/api/partners/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerId,
          planId,
          billingInterval,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete partner setup');
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete partner setup. Please contact support.';
      setError(errorMessage);
      setCurrentStep(1); // Go back to registration step
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedLogo(file);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800">
      <PartnerHeader />
      
      <main className="container mx-auto px-4 py-8">
        {currentStep === 1 ? (
          <>
            {/* Hero Section */}
            <div className="container mx-auto px-4 pt-12 pb-16 text-center relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-teal-500/10 blur-3xl" />
              <h1 className="text-5xl font-bold mb-6 relative">
                <span className="text-white">Partner With Us</span>
                <span className="block text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text mt-2">
                  Build the Future Together
                </span>
              </h1>
              <p className="text-xl text-white max-w-2xl mx-auto">
                Join our ecosystem of innovators and leaders who are transforming business communication through AI-powered solutions.
              </p>
            </div>

            {/* Partner Types Section */}
            <section className="py-16">
              <h2 className="text-3xl font-bold text-center text-white mb-12">Choose Your Partnership Path</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {partnerTypes.map((type, index) => (
                  <div
                    key={index}
                    className={`
                      p-6 rounded-xl backdrop-blur-sm transition-all duration-300 cursor-pointer
                      flex flex-col h-full
                      ${type.isActive 
                        ? 'bg-gradient-to-b from-blue-600/20 to-purple-600/20 border-2 border-blue-400/30' 
                        : 'bg-gray-900/50 border border-gray-800 hover:border-blue-400/30'
                      }
                    `}
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        partnershipType: type.title.split(' ')[0]
                      }));
                      setIsPartnerFormOpen(true);
                    }}
                  >
                    <type.icon className="w-12 h-12 text-blue-400 mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">{type.title}</h3>
                    <p className="text-gray-400 mb-4 text-sm leading-relaxed">{type.description}</p>
                    <ul className="space-y-2 mb-6 flex-grow">
                      {type.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-start text-sm text-gray-300">
                          <CheckCircle2 className="w-4 h-4 text-teal-500 mr-2 flex-shrink-0 mt-0.5" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData(prev => ({
                          ...prev,
                          partnershipType: type.title.split(' ')[0]
                        }));
                        setIsPartnerFormOpen(true);
                      }}
                      className="w-full py-3 px-4 rounded-lg font-semibold transition-all duration-300 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl mt-auto"
                    >
                      Apply Now
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Partner Application Form */}
            <Dialog
              open={isPartnerFormOpen}
              onClose={() => setIsPartnerFormOpen(false)}
              className="fixed inset-0 z-50 overflow-y-auto"
            >
              <div className="flex items-center justify-center min-h-screen px-4">
                <Dialog.Overlay className="fixed inset-0 bg-black/70" />
                
                <div className="relative bg-gray-900 rounded-xl max-w-3xl w-full p-6 overflow-y-auto max-h-[90vh]">
                  <div className="flex justify-between items-center mb-6">
                    <Dialog.Title className="text-2xl font-bold text-white">
                      Partner Application
                    </Dialog.Title>
                    <button
                      onClick={() => setIsPartnerFormOpen(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">Business Name</label>
                        <input
                          type="text"
                          name="businessName"
                          required
                          value={formData.businessName}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-blue-500/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-400"
                          placeholder="Enter your business name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">Contact Name</label>
                        <input
                          type="text"
                          name="contactName"
                          required
                          value={formData.contactName}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-blue-500/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-400"
                          placeholder="Enter contact person's name"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-2 text-white">Business Address</label>
                        <input
                          type="text"
                          name="businessAddress"
                          required
                          value={formData.businessAddress}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-blue-500/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-400"
                          placeholder="Enter your business address"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">Business Email</label>
                        <input
                          type="email"
                          name="emailAddress"
                          required
                          value={formData.emailAddress}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-blue-500/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-400"
                          placeholder="Enter your business email"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">Phone Number</label>
                        <PhoneInput
                          country={'us'}
                          value={formData.phoneNumber}
                          onChange={(phone) => setFormData(prev => ({ ...prev, phoneNumber: phone }))}
                          inputClass="!w-full !px-4 !py-3 !rounded-lg !bg-gray-800 !border !border-blue-500/20 focus:!border-blue-500 focus:!ring-1 focus:!ring-blue-500 !text-white !placeholder-gray-400"
                          buttonClass="!bg-gray-800 !border !border-blue-500/20"
                          dropdownClass="!bg-gray-800 !text-white"
                          containerClass="!bg-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">Area of Business</label>
                        <select
                          name="areaOfBusiness"
                          required
                          value={formData.areaOfBusiness}
                          onChange={(e) => {
                            const value = e.target.value;
                            setShowCustomAreaOfBusiness(value === 'Other');
                            handleInputChange(e);
                          }}
                          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-blue-500/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                        >
                          <option value="">Select area of business</option>
                          {areaOfBusinessOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        {showCustomAreaOfBusiness && (
                          <input
                            type="text"
                            name="customAreaOfBusiness"
                            value={formData.customAreaOfBusiness}
                            onChange={handleInputChange}
                            placeholder="Please specify your area of business"
                            className="mt-2 w-full px-4 py-3 rounded-lg bg-gray-800 border border-blue-500/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-400"
                            required
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">Expertise</label>
                        <select
                          name="expertise"
                          required
                          value={formData.expertise}
                          onChange={(e) => {
                            const value = e.target.value;
                            setShowCustomExpertise(value === 'Other');
                            handleInputChange(e);
                          }}
                          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-blue-500/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                        >
                          <option value="">Select expertise</option>
                          {expertiseOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        {showCustomExpertise && (
                          <input
                            type="text"
                            name="customExpertise"
                            value={formData.customExpertise}
                            onChange={handleInputChange}
                            placeholder="Please specify your expertise"
                            className="mt-2 w-full px-4 py-3 rounded-lg bg-gray-800 border border-blue-500/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-400"
                            required
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">How did you learn about us?</label>
                        <select
                          name="learningSource"
                          required
                          value={formData.learningSource}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-blue-500/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                        >
                          <option value="">Select source</option>
                          {learningSourceOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">Partnership Type</label>
                        <select
                          name="partnershipType"
                          required
                          value={formData.partnershipType}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-blue-500/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                        >
                          {partnerTypes.map((type) => (
                            <option 
                              key={type.title} 
                              value={type.title.split(' ')[0]}
                              disabled={!type.isActive}
                            >
                              {type.title} {!type.isActive && '(Coming Soon)'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">Country</label>
                        <select
                          name="country"
                          required
                          value={formData.country}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-blue-500/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                        >
                          <option value="">Select country</option>
                          <optgroup label="Popular Countries">
                            {popularCountries.map((country) => (
                              <option key={country} value={country}>{country}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Other Countries">
                            {allCountries.map((country) => (
                              <option key={country} value={country}>{country}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">Company Logo</label>
                        <div className="mt-1 flex items-center space-x-4">
                          <input
                            type="file"
                            name="logo"
                            accept="image/*"
                            onChange={handleLogoChange}
                            className="block w-full text-sm text-gray-300
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-full file:border-0
                              file:text-sm file:font-semibold
                              file:bg-blue-500 file:text-white
                              hover:file:bg-blue-600"
                          />
                          {selectedLogo && (
                            <span className="text-sm text-gray-300">
                              {selectedLogo.name}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-400">
                          Upload your company logo (PNG, JPG, or SVG)
                        </p>
                      </div>
                    </div>

                    {error && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
                        {error}
                      </div>
                    )}

                    <div className="flex justify-end gap-3 mt-8">
                      <button
                        type="button"
                        onClick={() => setIsPartnerFormOpen(false)}
                        className="px-6 py-3 bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-300"
                      >
                        Submit Application
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </Dialog>
          </>
        ) : (
          <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <PricingSection 
                isPartnerFlow={true}
                partnerId={partnerId}
                onSubscribe={handlePaymentComplete}
              />
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function PartnersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <PartnersPageContent />
    </Suspense>
  );
}
