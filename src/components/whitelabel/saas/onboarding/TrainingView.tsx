'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';

interface TrainingViewProps {
  brandName: string;
  businessName: string;
  onComplete: () => void;
}

export default function TrainingView({ brandName, businessName, onComplete }: TrainingViewProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const trainingSteps = [
    {
      title: 'Learning your business details',
      description: `${brandName} is analyzing your website to understand your services and business model.`,
      icon: '🏢',
      duration: 2000
    },
    {
      title: 'Training on your unique voice',
      description: `Customizing ${brandName}'s personality to match your brand and communication style.`,
      icon: '🎯',
      duration: 2500
    },
    {
      title: 'Mastering your professional tone',
      description: `Ensuring ${brandName} represents your business with the perfect level of professionalism.`,
      icon: '💼',
      duration: 2000
    },
    {
      title: 'Setting up appointment booking',
      description: `Configuring ${brandName} to seamlessly schedule appointments and manage your calendar.`,
      icon: '📅',
      duration: 2200
    },
    {
      title: `Finalizing your ${brandName} setup`,
      description: `Putting the finishing touches on your AI receptionist - almost ready!`,
      icon: '✨',
      duration: 1800
    }
  ];

  useEffect(() => {
    const runTraining = async () => {
      for (let i = 0; i < trainingSteps.length; i++) {
        setCurrentStep(i);
        
        // Wait for step duration
        await new Promise(resolve => setTimeout(resolve, trainingSteps[i].duration));
        
        // Mark step as completed
        setCompletedSteps(prev => [...prev, i]);
        
        // Small pause before next step
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Wait a bit before calling onComplete
      setTimeout(() => {
        onComplete();
      }, 1000);
    };

    runTraining();
  }, [brandName, onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="text-6xl mb-4">🤖</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Training your receptionist {brandName}
          </h1>
          <p className="text-xl text-gray-600">
            {brandName} is learning about {businessName} to provide the best service
          </p>
        </motion.div>

        {/* Progress Steps */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Column - Training Steps */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              {brandName} is training on your data
            </h2>
            
            {trainingSteps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-start space-x-4 p-4 rounded-lg transition-all duration-500 ${
                  completedSteps.includes(index)
                    ? 'bg-green-50 border border-green-200'
                    : currentStep === index
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="flex-shrink-0">
                  {completedSteps.includes(index) ? (
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <FiCheck className="text-white text-sm" />
                    </div>
                  ) : currentStep === index ? (
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm">
                      {step.icon}
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className={`font-medium ${
                    completedSteps.includes(index) ? 'text-green-800' :
                    currentStep === index ? 'text-blue-800' : 'text-gray-600'
                  }`}>
                    {step.title}
                  </h3>
                  <p className={`text-sm mt-1 ${
                    completedSteps.includes(index) ? 'text-green-600' :
                    currentStep === index ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right Column - Benefits */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Ready to win you customers
            </h2>
            
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-xl shadow-sm border"
              >
                <div className="text-2xl mb-3">📞</div>
                <h3 className="font-semibold text-gray-900 mb-2">Never miss a call</h3>
                <p className="text-gray-600 text-sm">
                  {brandName} answers every call, 24/7. Your customers always reach a professional voice.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white p-6 rounded-xl shadow-sm border"
              >
                <div className="text-2xl mb-3">📅</div>
                <h3 className="font-semibold text-gray-900 mb-2">Book appointments instantly</h3>
                <p className="text-gray-600 text-sm">
                  Automatically schedule appointments and send confirmations to your calendar.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white p-6 rounded-xl shadow-sm border"
              >
                <div className="text-2xl mb-3">🎯</div>
                <h3 className="font-semibold text-gray-900 mb-2">Trained on your business</h3>
                <p className="text-gray-600 text-sm">
                  {brandName} knows your services, pricing, and policies to provide accurate responses.
                </p>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Training Progress</span>
            <span className="text-sm text-gray-500">
              {Math.round(((completedSteps.length + (currentStep < trainingSteps.length ? 0.5 : 0)) / trainingSteps.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full"
              initial={{ width: '0%' }}
              animate={{ 
                width: `${((completedSteps.length + (currentStep < trainingSteps.length ? 0.5 : 0)) / trainingSteps.length) * 100}%` 
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
