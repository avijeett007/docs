'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SimplifiedSignupModal from '@/components/SimplifiedSignupModal';
import Logo from '@/components/Logo';
import NeonContainer from '@/components/NeonContainer';
import toast from 'react-hot-toast';

interface GoogleSignupData {
  id: string;
  email: string;
  name: string;
  picture: string;
  timestamp: number;
}

function GoogleSignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [googleSignupData, setGoogleSignupData] = useState<GoogleSignupData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!searchParams) {
      toast.error('Invalid signup data. Please try again.');
      router.push('/partner/login');
      return;
    }

    const data = searchParams.get('data');

    if (!data) {
      toast.error('Invalid signup data. Please try again.');
      router.push('/partner/login');
      return;
    }

    try {
      // Decode the Google signup data
      const decodedData = JSON.parse(atob(data));
      
      // Validate the data structure
      if (!decodedData.id || !decodedData.email || !decodedData.name) {
        throw new Error('Invalid data structure');
      }

      // Check if data is not too old (24 hours)
      const dataAge = Date.now() - decodedData.timestamp;
      if (dataAge > 24 * 60 * 60 * 1000) {
        throw new Error('Signup data has expired');
      }

      setGoogleSignupData(decodedData);
      setShowSignupModal(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error processing Google signup data:', error);
      toast.error('Invalid or expired signup data. Please try again.');
      router.push('/partner/login');
    }
  }, [searchParams, router]);

  const handleModalClose = () => {
    setShowSignupModal(false);
    router.push('/partner/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <Logo className="mx-auto mb-4" />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
          <p className="text-gray-300 mt-4">Processing your Google signup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
      <NeonContainer className="w-full max-w-md">
        <div className="text-center p-8">
          <Logo className="mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-4">Complete Your Registration</h1>
          <p className="text-gray-300 mb-6">
            Welcome! We just need a few more details to set up your account.
          </p>
          
          {googleSignupData && (
            <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-3">
                {googleSignupData.picture && (
                  <img 
                    src={googleSignupData.picture} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div className="text-left">
                  <p className="text-white font-medium">{googleSignupData.name}</p>
                  <p className="text-gray-400 text-sm">{googleSignupData.email}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowSignupModal(true)}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
          >
            Continue Setup
          </button>
        </div>
      </NeonContainer>

      {/* Signup Modal */}
      <SimplifiedSignupModal
        isOpen={showSignupModal}
        onClose={handleModalClose}
        googleSignupData={googleSignupData || undefined}
      />
    </div>
  );
}

export default function GoogleSignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    }>
      <GoogleSignupContent />
    </Suspense>
  );
}
