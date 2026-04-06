import React from 'react';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center px-4">
      <div className="max-w-2xl w-full bg-white/5 backdrop-blur-lg rounded-2xl p-8 text-center space-y-6">
        <div className="flex justify-center">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        
        <h1 className="text-3xl font-bold text-white">
          Welcome to Knotie AI Pro!
        </h1>
        
        <p className="text-gray-300 text-lg">
          Your partner account has been successfully created. We've sent you an email with your login credentials and next steps.
        </p>

        <div className="space-y-4 text-gray-300">
          <h2 className="text-xl font-semibold">What's Next?</h2>
          <ul className="space-y-2 text-left list-disc list-inside">
            <li>Check your email for login credentials</li>
            <li>Log in to your partner dashboard</li>
            <li>Complete your profile setup</li>
            <li>Start integrating Knotie AI services</li>
          </ul>
        </div>

        <div className="pt-6">
          <Link 
            href="/partner/login" 
            className="inline-flex items-center px-6 py-3 text-base font-medium rounded-lg text-white bg-gradient-to-r from-blue-500 to-teal-500 hover:from-[#2e6da4] hover:to-[#34c759] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2ecc71] transform transition-all duration-200 hover:scale-105"
          >
            Go to Partner Login
          </Link>
        </div>

        <p className="text-sm text-gray-400">
          Need help? Contact our{' '}
          <a href="mailto:support@knotie.ai" className="text-blue-400 hover:text-blue-300">
            support team
          </a>
        </p>
      </div>
    </div>
  );
}
