'use client';

import React, { useState, useEffect } from 'react';
import { OnboardingProgress, ONBOARDING_STEPS } from '@/types/onboarding';

export default function OnboardingTestPage() {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/partner/onboarding/progress');
      const data = await response.json();
      
      if (data.success) {
        setProgress(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch progress');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error fetching progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProgress = async () => {
    try {
      const response = await fetch('/api/partner/onboarding/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'refresh' })
      });
      
      const data = await response.json();
      if (data.success) {
        setProgress(data.data);
        console.log('Progress refreshed:', data.data);
      }
    } catch (err) {
      console.error('Error refreshing progress:', err);
    }
  };

  const completeOnboarding = async () => {
    try {
      const response = await fetch('/api/partner/onboarding/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'complete' })
      });
      
      const data = await response.json();
      console.log('Completion result:', data);
      
      if (data.success) {
        alert(`Onboarding completed! ${data.message}`);
        fetchProgress(); // Refresh progress
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Error completing onboarding:', err);
      alert('Network error');
    }
  };

  useEffect(() => {
    fetchProgress();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Onboarding Test Page</h1>
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Onboarding Test Page</h1>
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-300">
            Error: {error}
          </div>
          <button
            onClick={fetchProgress}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Onboarding Test Page</h1>
        
        {/* Progress Overview */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Current Progress</h2>
          {progress && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Completed Steps:</span>
                <span className="font-bold text-green-400">{progress.completedSteps}/{progress.totalSteps}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Progress:</span>
                <span className="font-bold text-blue-400">{progress.progressPercentage}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Next Step:</span>
                <span className="font-bold text-yellow-400">
                  {progress.nextStep ? `Step ${progress.nextStep}` : 'All Complete!'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Is Complete:</span>
                <span className={`font-bold ${progress.isComplete ? 'text-green-400' : 'text-red-400'}`}>
                  {progress.isComplete ? 'Yes' : 'No'}
                </span>
              </div>
              {progress.completedAt && (
                <div className="flex items-center justify-between">
                  <span>Completed At:</span>
                  <span className="font-bold text-green-400">
                    {new Date(progress.completedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step Details */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Step Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ONBOARDING_STEPS.map((step, index) => {
              const stepKey = [
                'step1_customizePod',
                'step2_onboardCustomer', 
                'step3_importAgent',
                'step4_reviewAnalytics',
                'step5_completeWhitelabel',
                'step6_setupPayments'
              ][index];
              
              const isCompleted = progress?.[stepKey as keyof OnboardingProgress] as boolean;
              
              return (
                <div
                  key={step.id}
                  className={`p-4 rounded-lg border ${
                    isCompleted 
                      ? 'bg-green-500/20 border-green-500/30 text-green-300' 
                      : 'bg-gray-700/50 border-gray-600/30 text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{step.title}</h3>
                    <span className={`text-sm px-2 py-1 rounded ${
                      isCompleted ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'
                    }`}>
                      {isCompleted ? 'Complete' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-sm opacity-80">{step.description}</p>
                  <p className="text-xs mt-2 opacity-60">
                    Target: {step.targetPage} | Est: {step.estimatedTime}min
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="flex gap-4">
            <button
              onClick={refreshProgress}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Refresh Progress
            </button>
            {progress?.isComplete && (
              <button
                onClick={completeOnboarding}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
              >
                Claim Completion Reward
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
