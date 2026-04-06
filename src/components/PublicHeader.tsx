'use client';

import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { FaGithub, FaYoutube, FaTwitter, FaDiscord } from 'react-icons/fa';
import Link from 'next/link';
import Logo from './Logo';
import navigationConfig from '../config/dashboard/navigation.json';

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Benefits', href: '/benefits' },
  { name: 'About', href: '/about' },
  { name: 'Careers', href: '/careers' },
  { name: 'Help', href: '/help' },
  { name: 'Contact', href: '/contact' },
  { name: 'Status', href: '/status' },
];

export default function PublicHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Helper to render social icons
  const renderSocialIcons = () => {
    const iconComponents = {
      FaGithub,
      FaYoutube,
      FaTwitter,
      FaDiscord
    };

    return navigationConfig.social.map((item, index) => {
      const IconComponent = iconComponents[item.icon as keyof typeof iconComponents];
      return (
        <a
          key={index}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-gray-400 hover:text-${item.hoverColor} transition-colors duration-200`}
        >
          <IconComponent size={20} />
        </a>
      );
    });
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/30 dark:border-blue-400/20 transition-colors duration-500">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/">
              <Logo />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-center flex-1 space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 font-medium"
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4">
              {renderSocialIcons()}
              
              <Link
                href="https://docs.knotie-ai.pro"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                Docs
              </Link>

              <Link
                href="/partner/login"
                className="inline-flex items-center rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:from-blue-600 hover:to-teal-600 hover:shadow-lg"
              >
                Partner Login
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4">
            <div className="flex flex-col space-y-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 font-medium"
                >
                  {item.name}
                </Link>
              ))}
              
              <Link
                href="https://docs.knotie-ai.pro"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-base font-semibold text-gray-700 transition-colors duration-200 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Docs
              </Link>

              <Link
                href="/partner/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 px-3 py-2 text-center text-base font-semibold text-white shadow-md transition-all duration-200 hover:from-blue-600 hover:to-teal-600"
              >
                Partner Login
              </Link>

              <div className="flex items-center gap-4 pt-4 border-t border-gray-300 dark:border-gray-700 justify-center">
                {renderSocialIcons()}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
