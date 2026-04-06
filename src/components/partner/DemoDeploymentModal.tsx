import React, { useState, useEffect, useCallback } from 'react';
import {
  FiArrowRight,
  FiCheck,
  FiPlay,
  FiUser,
  FiCalendar,
  FiHeart,
  FiHeadphones,
  FiHome,
  FiInfo,
  FiShoppingCart,
  FiAlertCircle
} from 'react-icons/fi';

// Helper functions for industry-specific labels and placeholders
const getIndustrySpecificLabel = (industry: string, fieldType: string): string => {
  if (fieldType === 'character') {
    switch (industry) {
      case 'Healthcare':
        return 'Patient Name';
      case 'Real Estate':
        return 'Client Name';
      case 'Banking':
        return 'Customer Name';
      case 'Insurance':
        return 'Policyholder Name';
      case 'Education':
        return 'Student Name';
      case 'Retail':
        return 'Customer Name';
      case 'Hospitality':
        return 'Guest Name';
      case 'Fitness':
        return 'Member Name';
      case 'Manufacturing':
        return 'Contact Name';
      default:
        return 'Contact Name';
    }
  }

  if (fieldType === 'business') {
    switch (industry) {
      case 'Healthcare':
        return 'Medical Practice Name';
      case 'Real Estate':
        return 'Real Estate Agency Name';
      case 'Banking':
        return 'Bank Name';
      case 'Insurance':
        return 'Insurance Company Name';
      case 'Education':
        return 'Institution Name';
      case 'Retail':
        return 'Store Name';
      case 'Hospitality':
        return 'Hotel/Restaurant Name';
      case 'Fitness':
        return 'Fitness Center Name';
      case 'Manufacturing':
        return 'Company Name';
      default:
        return 'Business Name';
    }
  }

  if (fieldType === 'address') {
    switch (industry) {
      case 'Healthcare':
        return 'Practice Address';
      case 'Real Estate':
        return 'Agency Address';
      case 'Banking':
        return 'Branch Address';
      case 'Insurance':
        return 'Office Address';
      case 'Education':
        return 'Campus Address';
      case 'Retail':
        return 'Store Address';
      case 'Hospitality':
        return 'Location Address';
      case 'Fitness':
        return 'Facility Address';
      case 'Manufacturing':
        return 'Office Address';
      default:
        return 'Business Address';
    }
  }

  return 'Field';
};

const getIndustrySpecificPlaceholder = (industry: string, fieldType: string): string => {
  if (fieldType === 'character') {
    switch (industry) {
      case 'Healthcare':
        return 'e.g., John Smith';
      case 'Real Estate':
        return 'e.g., Sarah Johnson';
      case 'Banking':
        return 'e.g., Michael Brown';
      case 'Insurance':
        return 'e.g., David Wilson';
      case 'Education':
        return 'e.g., Emily Parker';
      default:
        return 'e.g., John';
    }
  }

  if (fieldType === 'business') {
    switch (industry) {
      case 'Healthcare':
        return 'e.g., City Medical Center';
      case 'Real Estate':
        return 'e.g., Prestige Properties';
      case 'Banking':
        return 'e.g., First National Bank';
      case 'Insurance':
        return 'e.g., Secure Insurance Group';
      case 'Education':
        return 'e.g., Summit University';
      case 'Retail':
        return 'e.g., Urban Styles';
      case 'Hospitality':
        return 'e.g., Grand Plaza Hotel';
      case 'Fitness':
        return 'e.g., Elite Fitness Center';
      case 'Manufacturing':
        return 'e.g., Precision Manufacturing';
      default:
        return 'e.g., Your Business Name';
    }
  }

  if (fieldType === 'address') {
    return 'e.g., 123 Main St, New York, NY 10001';
  }

  return 'e.g., Enter information';
};

const getIndustrySpecificDescription = (industry: string, fieldType: string): string => {
  if (fieldType === 'character') {
    switch (industry) {
      case 'Healthcare':
        return 'For outbound calls, this is the name of the patient being called';
      case 'Real Estate':
        return 'For outbound calls, this is the name of the potential buyer/seller being called';
      case 'Banking':
        return 'For outbound calls, this is the name of the customer being called';
      case 'Insurance':
        return 'For outbound calls, this is the name of the policyholder being called';
      case 'Education':
        return 'For outbound calls, this is the name of the student/applicant being called';
      default:
        return 'For outbound calls, this is the name of the person being called';
    }
  }

  return '';
};

interface DemoDeployment {
  id: string;
  status: string;
  deployedAgentId: string | null;
  lastDeployedAt: string | null;
  lastTestedAt: string | null;
  customBusinessName: string | null;
  customCharacterName: string | null;
  // New fields
  customBusinessAddress?: string | null;
  customAgentName?: string | null;
  customVoiceId?: string | null;
}

interface Voice {
  voice_id: string;
  voice_type: string;
  standard_voice_type: string;
  voice_name: string;
  provider: string;
  accent: string;
  gender: string;
  age: string;
  avatar_url: string;
  preview_audio_url: string;
  use_case: string;
}

interface DemoItem {
  id: string;
  name: string;
  industry: string;
  description: string;
  useCases: string[];
  benefits: string[];
  iconName: string;
  color: string;
  demoType: string;
  isOutbound: boolean;
  businessNamePlaceholder?: string;
  characterNamePlaceholder?: string;
  deployment: DemoDeployment | null;
}

interface DemoDeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  demo: DemoItem | null;
  onTest?: (demoId: string) => void;
}

const DemoDeploymentModal: React.FC<DemoDeploymentModalProps> = ({
  isOpen,
  onClose,
  demo,
  onTest
}) => {
  const [step, setStep] = useState<string>('customize'); // 'customize' or 'deploy' or 'success'
  const [deploying, setDeploying] = useState<boolean>(false);
  const [businessName, setBusinessName] = useState<string>('');
  const [businessAddress, setBusinessAddress] = useState<string>('');
  const [characterName, setCharacterName] = useState<string>('');
  const [agentName, setAgentName] = useState<string>('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('11labs-Dorothy');
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [testError, setTestError] = useState<{title: string; message: string} | null>(null);
  const [deployedAgentId, setDeployedAgentId] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState<boolean>(false);

  // Track if inputs have been manually changed
  const [inputsInitialized, setInputsInitialized] = useState(false);

  // Define the loadVoices function with useCallback to avoid dependency issues
  const loadVoices = useCallback(async () => {
    setLoadingVoices(true);
    try {
      // This is a static list for now, but could be fetched from an API
      const voicesList: Voice[] = [
        {
          "voice_id": "11labs-Dorothy",
          "voice_type": "standard",
          "standard_voice_type": "preset",
          "voice_name": "Dorothy",
          "provider": "elevenlabs",
          "accent": "British",
          "gender": "female",
          "age": "Young",
          "avatar_url": "https://retell-utils-public.s3.us-west-2.amazonaws.com/Dorothy.png",
          "preview_audio_url": "https://retell-utils-public.s3.us-west-2.amazonaws.com/Dorothy.mp3",
          "use_case": "Professional narration with British accent"
        },
        {
          "voice_id": "11labs-Anthony",
          "voice_type": "standard",
          "standard_voice_type": "retell",
          "voice_name": "Anthony",
          "provider": "elevenlabs",
          "accent": "British",
          "gender": "male",
          "age": "Middle Aged",
          "avatar_url": "https://retell-utils-public.s3.us-west-2.amazonaws.com/anthony.png",
          "preview_audio_url": "https://retell-utils-public.s3.us-west-2.amazonaws.com/anthony.mp3",
          "use_case": "Authoritative business presentations"
        },
        {
          "voice_id": "11labs-Samad",
          "voice_type": "standard",
          "standard_voice_type": "preset",
          "voice_name": "Samad (en-IN)",
          "provider": "elevenlabs",
          "accent": "Indian",
          "gender": "male",
          "age": "Middle Aged",
          "avatar_url": "https://retell-utils-public.s3.us-west-2.amazonaws.com/samad.png",
          "preview_audio_url": "https://retell-utils-public.s3.us-west-2.amazonaws.com/samad.mp3",
          "use_case": "Technical tutorials with Indian accent"
        },
        {
          "voice_id": "11labs-Steve",
          "voice_type": "standard",
          "standard_voice_type": "retell",
          "voice_name": "Steve",
          "provider": "elevenlabs",
          "accent": "American",
          "gender": "male",
          "age": "Old",
          "avatar_url": "https://retell-utils-public.s3.us-west-2.amazonaws.com/Steve.png",
          "preview_audio_url": "https://retell-utils-public.s3.us-west-2.amazonaws.com/Steve-.mp3",
          "use_case": "Elderly character for storytelling"
        },
        {
          "voice_id": "11labs-Lily",
          "voice_type": "standard",
          "standard_voice_type": "retell",
          "voice_name": "Lily",
          "provider": "elevenlabs",
          "accent": "American",
          "gender": "female",
          "age": "Young",
          "avatar_url": "https://retell-utils-public.s3.us-west-2.amazonaws.com/lily.png",
          "preview_audio_url": "https://retell-utils-public.s3.us-west-2.amazonaws.com/lily.mp3",
          "use_case": "Youthful and energetic content"
        }
      ];

      setVoices(voicesList);

      // Set default voice if one is already selected
      if (demo?.deployment?.customVoiceId) {
        setSelectedVoiceId(demo.deployment.customVoiceId);
      } else {
        // Default to Dorothy
        setSelectedVoiceId('11labs-Dorothy');
      }
    } catch (error: any) {
      console.error('Error loading voices:', error);
    } finally {
      setLoadingVoices(false);
    }
  }, [demo, inputsInitialized]);

  // Reset initialization when modal is closed
  useEffect(() => {
    if (!isOpen) {
      // Reset the initialization flag when modal closes
      setInputsInitialized(false);
    }
  }, [isOpen]);

  // Initialize state when demo changes - only on first render
  useEffect(() => {
    if (demo && !inputsInitialized) {
      // Only set these values on first load
      const initialBusinessName = demo.businessNamePlaceholder || demo.deployment?.customBusinessName || 'Al Shifa Medical Center';
      const initialBusinessAddress = demo.deployment?.customBusinessAddress || '123 Main St, New York, NY 10001';
      const initialCharacterName = demo.characterNamePlaceholder || demo.deployment?.customCharacterName || 'Michael';

      setBusinessName(initialBusinessName);
      setBusinessAddress(initialBusinessAddress);
      setCharacterName(initialCharacterName);
      setAgentName(demo.deployment?.customAgentName || `${demo.name} for ${initialBusinessName}`);
      setStep(demo.deployment?.status === 'DEPLOYED' ? 'success' : 'customize');
      setDeployedAgentId(demo.deployment?.deployedAgentId || null);
      setDeploymentError(null);

      // Mark inputs as initialized
      setInputsInitialized(true);

      // Load available voices
      loadVoices();
    }
  }, [demo, loadVoices, businessName]);

  // Early return if modal is not open or demo is null
  if (!isOpen || !demo) return null;

  // Get icon component based on iconName
  const getIconComponent = () => {
    switch (demo.iconName) {
      case 'FiUser':
        return FiUser;
      case 'FiCalendar':
        return FiCalendar;
      case 'FiHeart':
        return FiHeart;
      case 'FiHeadphones':
        return FiHeadphones;
      case 'FiHome':
        return FiHome;
      case 'FiShoppingCart':
        return FiShoppingCart;
      default:
        return FiUser;
    }
  };

  const IconComponent = getIconComponent();

  // Get color classes based on demo.color
  const getColorClasses = () => {
    switch (demo.color) {
      case 'blue':
        return {
          bg: 'bg-blue-500/20',
          text: 'text-blue-400',
          button: 'bg-blue-600 hover:bg-blue-700',
        };
      case 'red':
        return {
          bg: 'bg-red-500/20',
          text: 'text-red-400',
          button: 'bg-red-600 hover:bg-red-700',
        };
      case 'green':
        return {
          bg: 'bg-green-500/20',
          text: 'text-green-400',
          button: 'bg-green-600 hover:bg-green-700',
        };
      case 'purple':
        return {
          bg: 'bg-purple-500/20',
          text: 'text-purple-400',
          button: 'bg-purple-600 hover:bg-purple-700',
        };
      default:
        return {
          bg: 'bg-gray-500/20',
          text: 'text-gray-400',
          button: 'bg-gray-600 hover:bg-gray-700',
        };
    }
  };

  const colorClasses = getColorClasses();

  const handleCustomize = async () => {
    // Validate inputs
    if (!businessName.trim()) {
      alert('Please enter a business name');
      return;
    }

    if (!businessAddress.trim()) {
      alert('Please enter a business address');
      return;
    }

    if (demo.isOutbound && !characterName.trim()) {
      alert('Please enter a character name');
      return;
    }

    if (!agentName.trim()) {
      alert('Please enter an agent name');
      return;
    }

    try {
      // Get token from localStorage
      const token = localStorage.getItem('partner_token');
      if (!token) {
        alert('You are not logged in. Please log in and try again.');
        return;
      }

      // Save customization
      const response = await fetch(`/api/partner/demos/${demo.id}/customize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          businessName,
          businessAddress,
          characterName,
          agentName,
          voiceId: selectedVoiceId
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to customize demo');
      }

      // Move to deployment step
      setStep('deploy');
    } catch (error: any) {
      console.error('Error customizing demo:', error);
      alert(error?.message || 'Failed to customize demo');
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setDeploymentError(null);

    try {
      // Get token from localStorage
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setDeploymentError('You are not logged in. Please log in and try again.');
        setDeploying(false);
        return;
      }

      // Deploy the demo
      const response = await fetch(`/api/partner/demos/${demo.id}/deploy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to deploy demo');
      }

      const data = await response.json();
      setDeployedAgentId(data.deployment.deployedAgentId);
      setStep('success');
    } catch (error: any) {
      console.error('Error deploying demo:', error);
      setDeploymentError(error?.message || 'Failed to deploy demo');
    } finally {
      setDeploying(false);
    }
  };

  const handleTest = async () => {
    // Reset any previous errors
    setTestError(null);

    if (!deployedAgentId && !demo.deployment?.deployedAgentId) {
      setTestError({
        title: 'No Agent Found',
        message: 'No deployed agent was found for this demo. Please deploy the demo first.'
      });
      return;
    }

    if (onTest) {
      onTest(demo.id);
    } else {
      try {
        // Get token from localStorage
        const token = localStorage.getItem('partner_token');
        if (!token) {
          setTestError({
            title: 'Authentication Required',
            message: 'You are not logged in. Please log in and try again.'
          });
          return;
        }

        // Connect to the demo
        const response = await fetch(`/api/partner/demos/${demo.id}/connect`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.log('Error response data:', errorData);

          // Use the structured error data from our enhanced API
          if (errorData.title && errorData.message) {
            setTestError({
              title: errorData.title,
              message: errorData.message
            });
          } else if (errorData.error === 'quota_exceeded') {
            setTestError({
              title: 'Usage Limit Reached',
              message: 'Your Retell account has reached its usage limit. Please upgrade your plan to continue using the demo.'
            });
          } else if (errorData.error === 'invalid_api_key') {
            setTestError({
              title: 'Invalid API Key',
              message: 'Your Retell API key appears to be invalid. Please check your settings and update your API key.'
            });
          } else if (errorData.error === 'agent_not_found') {
            setTestError({
              title: 'Agent Not Found',
              message: 'The AI agent for this demo could not be found. It may have been deleted from your Retell account.'
            });
          } else if (errorData.error === 'retell_error') {
            setTestError({
              title: 'Retell Service Error',
              message: errorData.message || 'There was an error with the Retell service. Please try again later.'
            });
          } else {
            throw new Error(errorData.error || 'Failed to connect to demo');
          }
          return;
        }

        const data = await response.json();
        // Handle connection data (e.g., open web call interface)
        console.log('Connection data:', data);

        // Clear any previous errors
        setTestError(null);

        // Show success message and close modal
        alert(`Starting web call with the deployed agent for ${businessName}...`);
        onClose();
      } catch (error: any) {
        console.error('Error connecting to demo:', error);

        // Check if the error message contains specific Retell errors
        const errorMsg = error?.message || '';

        if (errorMsg.includes('quota') || errorMsg.includes('Trial over') || errorMsg.includes('add payment')) {
          setTestError({
            title: 'Usage Limit Reached',
            message: 'Your Retell account has reached its usage limit. Please upgrade your plan to continue using the demo.'
          });
        } else if (errorMsg.includes('API key') || errorMsg.includes('Invalid API')) {
          setTestError({
            title: 'Invalid API Key',
            message: 'Your Retell API key appears to be invalid. Please check your settings and update your API key.'
          });
        } else if (errorMsg.includes('agent not found') || errorMsg.includes('AGENT_NOT_FOUND')) {
          setTestError({
            title: 'Agent Not Found',
            message: 'The AI agent for this demo could not be found. It may have been deleted from your Retell account.'
          });
        } else if (errorMsg.includes('Forbidden')) {
          setTestError({
            title: 'Access Denied',
            message: 'Your Retell account has reached its usage limit. Please upgrade your plan to continue using the demo.'
          });
        } else {
          setTestError({
            title: 'Connection Error',
            message: 'Failed to connect to the demo. Please try again later.'
          });
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-2xl w-full border border-gray-700 shadow-xl flex flex-col max-h-[90vh]">
        {/* Header - Fixed at the top */}
        <div className="px-8 py-6 border-b border-gray-700 flex items-center gap-4 flex-shrink-0">
          <div className={`w-12 h-12 rounded-full ${colorClasses.bg} flex items-center justify-center`}>
            <IconComponent className={`w-6 h-6 ${colorClasses.text}`} />
          </div>
          <h3 className="text-2xl font-semibold text-white">
            {step === 'customize' ? `Customize ${demo.name}` :
             step === 'deploy' ? `Deploy ${demo.name}` :
             `${demo.name} Deployed!`}
          </h3>
        </div>

        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-grow" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4B5563 #1F2937' }}>
        {step === 'customize' && (
          <div className="px-8 py-6">
            <p className="text-gray-300 mb-6 text-base leading-relaxed">
              Customize this demo to match your client's business. This information will be used in the AI agent's responses.
            </p>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-5 mb-8 flex items-start gap-3">
              <FiInfo className="text-blue-400 mt-1 flex-shrink-0 w-5 h-5" />
              <div>
                <p className="text-sm text-blue-300 font-medium">New Customization Options Available!</p>
                <p className="text-xs text-blue-200 mt-2 leading-relaxed">
                  You can now customize the business address, agent name, and voice for your demo.
                  These options help create a more personalized experience for your customers.
                </p>
              </div>
            </div>

            <div className="space-y-6 mb-8">
              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-gray-300 mb-2">
                  {getIndustrySpecificLabel(demo.industry, 'business')}
                </label>
                <input
                  type="text"
                  id="businessName"
                  value={businessName}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setBusinessName(newValue);
                    // Update agent name when business name changes
                    if (demo) {
                      setAgentName(`${demo.name} for ${newValue}`);
                    }
                  }}
                  placeholder={getIndustrySpecificPlaceholder(demo.industry, 'business')}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <p className="text-xs text-gray-400 mt-2">This name will be used when the AI agent introduces itself</p>
              </div>

              <div>
                <label htmlFor="businessAddress" className="block text-sm font-medium text-gray-300 mb-1">
                  {getIndustrySpecificLabel(demo.industry, 'address')}
                </label>
                <input
                  type="text"
                  id="businessAddress"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder={getIndustrySpecificPlaceholder(demo.industry, 'address')}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">The address will be used in the agent's responses</p>
              </div>

              <div>
                <label htmlFor="agentName" className="block text-sm font-medium text-gray-300 mb-1">Agent Name</label>
                <input
                  type="text"
                  id="agentName"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g., Medical Receptionist for City Medical Center"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">This will be the name of the agent in your Retell dashboard (DO NOT DELETE will be added)</p>
              </div>

              {demo.isOutbound && (
                <div>
                  <label htmlFor="characterName" className="block text-sm font-medium text-gray-300 mb-1">
                    {getIndustrySpecificLabel(demo.industry, 'character')}
                  </label>
                  <input
                    type="text"
                    id="characterName"
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    placeholder={getIndustrySpecificPlaceholder(demo.industry, 'character')}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {getIndustrySpecificDescription(demo.industry, 'character')}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Select Voice</label>
                {loadingVoices ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto pr-2">
                    {voices.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {voices.map((voice) => (
                          <div
                            key={voice.voice_id}
                            className={`p-3 rounded-lg border transition-all cursor-pointer ${selectedVoiceId === voice.voice_id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-700 hover:border-gray-500'}`}
                            onClick={() => setSelectedVoiceId(voice.voice_id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm text-white">
                                  {voice.voice_name.charAt(0)}
                                </div>
                                <div>
                                  <h5 className="text-white font-medium">{voice.voice_name}</h5>
                                  <p className="text-xs text-gray-400">{voice.accent} {voice.gender}, {voice.age}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const audio = new Audio(voice.preview_audio_url);
                                  audio.play();
                                }}
                                className="p-1.5 rounded-full bg-gray-600 text-gray-300 hover:bg-gray-500"
                                aria-label="Play preview"
                              >
                                <FiPlay className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-center py-4">No voices available</p>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">Click on a voice to select it, and click the play button to hear a preview</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-center"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomize}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <FiArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'deploy' && (
          <div className="px-8 py-6">
            <p className="text-gray-300 mb-6 text-base leading-relaxed">
              This will deploy the {demo.name} demo to your Retell account using your API key.
              Once deployed, you can test and showcase this demo to your clients.
            </p>

            <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Demo Details:</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-xs">•</span>
                  <span><span className="text-gray-300">{getIndustrySpecificLabel(demo.industry, 'business')}:</span> {businessName}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xs">•</span>
                  <span><span className="text-gray-300">{getIndustrySpecificLabel(demo.industry, 'address')}:</span> {businessAddress}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xs">•</span>
                  <span><span className="text-gray-300">Agent Name:</span> {agentName} (DO NOT DELETE)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xs">•</span>
                  <span><span className="text-gray-300">Voice:</span> {voices.find(v => v.voice_id === selectedVoiceId)?.voice_name || selectedVoiceId}</span>
                </li>
                {demo.isOutbound && (
                  <li className="flex items-start gap-2">
                    <span className="text-xs">•</span>
                    <span><span className="text-gray-300">{getIndustrySpecificLabel(demo.industry, 'character')}:</span> {characterName}</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-xs">•</span>
                  <span><span className="text-gray-300">Type:</span> {demo.industry} Voice AI</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xs">•</span>
                  <span><span className="text-gray-300">Languages:</span> English, Spanish</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xs">•</span>
                  <span><span className="text-gray-300">Use Case:</span> {demo.useCases[0]}</span>
                </li>
              </ul>
            </div>

            {deploymentError && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
                <p className="text-red-400">{deploymentError}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => setStep('customize')}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-center"
                disabled={deploying}
              >
                Back
              </button>
              <button
                onClick={handleDeploy}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                disabled={deploying}
              >
                {deploying ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    <span>Deploying...</span>
                  </>
                ) : (
                  <>
                    <span>Deploy Demo</span>
                    <FiArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="px-8 py-8">
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                <FiCheck className="w-8 h-8 text-green-400" />
              </div>

              <p className="text-gray-300 mb-8 text-center text-base leading-relaxed max-w-md mx-auto">
                The {demo.name} demo has been successfully deployed to your Retell account.
                You can now test and showcase this demo to your clients.
              </p>

              {testError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-5 mb-6 w-full">
                  <div className="flex items-start gap-3">
                    <FiAlertCircle className="text-red-400 mt-1 flex-shrink-0 w-5 h-5" />
                    <div>
                      <p className="text-sm font-medium text-red-300">{testError.title}</p>
                      <p className="text-xs text-red-200 mt-2 leading-relaxed">{testError.message}</p>

                      {testError.title === 'Usage Limit Reached' && (
                        <a
                          href="https://app.retellai.com/billing"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-block text-xs text-blue-400 hover:text-blue-300 underline"
                        >
                          Upgrade your Retell plan →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onClose}
                  className="px-5 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-center font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleTest}
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <span>Test Demo</span>
                  <FiArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default DemoDeploymentModal;
