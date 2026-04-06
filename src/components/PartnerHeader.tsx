'use client';

import React from 'react';
import Logo from './Logo';
import Link from 'next/link';

export default function PartnerHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/50 backdrop-blur-lg border-b border-blue-400/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Home Link */}
          <Link href="/">
            <Logo />
          </Link>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            <Link
              href="/partner/login"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 text-white hover:from-blue-600 hover:to-teal-600 transition-all duration-300"
            >
              Partner Login
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
