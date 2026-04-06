import React from 'react';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white shadow">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            {/* Logo */}
            <Link href="/" className="text-xl font-bold text-blue-600">
              Knotie-AI Pro
            </Link>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/" className="text-gray-600 hover:text-blue-600 transition-colors">
                Home
              </Link>
              <Link href="/partners" className="text-gray-600 hover:text-blue-600 transition-colors">
                Partners
              </Link>
              <Link href="/affiliates" className="text-gray-600 hover:text-blue-600 transition-colors">
                Affiliates
              </Link>
            </div>
          </div>

          {/* Right Side - Auth Buttons */}
          <div className="flex items-center space-x-4">
            <Link 
              href="/login" 
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              Log In
            </Link>
            <Link 
              href="/signup" 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
