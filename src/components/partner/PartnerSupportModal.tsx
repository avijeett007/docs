'use client';

import React from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiHelpCircle, FiMessageSquare, FiMail } from 'react-icons/fi';
import { QRCodeSVG } from 'qrcode.react';

interface PartnerSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PartnerSupportModal({
  isOpen,
  onClose
}: PartnerSupportModalProps) {
  // Support contact information
  const supportInfo = {
    email: 'support@knotie-ai.pro',
    discord: 'https://discord.com/invite/AQCdM68BTr'
  };

  // QR Code data - Discord invite link
  const discordQRData = supportInfo.discord;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/90" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-900 rounded-lg max-w-md w-full border border-gray-800">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/20">
                <FiHelpCircle className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-semibold text-white">
                  Get Partner Support
                </Dialog.Title>
                <p className="text-sm text-gray-400">
                  Scan QR code or use contact details below
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* QR Code Section */}
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white mb-3">
                Join Our Discord Community
              </h3>
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-white rounded-lg">
                  <QRCodeSVG
                    value={discordQRData}
                    size={160}
                    level="M"
                    marginSize={0}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-400">
                Scan with your phone to join our Discord community and get support from our team
              </p>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900 text-gray-400">Or contact us directly</span>
              </div>
            </div>

            {/* Contact Methods */}
            <div className="space-y-3">
              <a
                href={`mailto:${supportInfo.email}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors text-gray-300 hover:text-white"
              >
                <FiMail className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="font-medium">Email Support</div>
                  <div className="text-sm text-gray-400">{supportInfo.email}</div>
                </div>
              </a>

              <a
                href={supportInfo.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors text-gray-300 hover:text-white"
              >
                <FiMessageSquare className="w-5 h-5 text-indigo-400" />
                <div>
                  <div className="font-medium">Discord Community</div>
                  <div className="text-sm text-gray-400">Join our community for support and discussions</div>
                </div>
              </a>
            </div>

            {/* Support Info */}
            <div className="text-center pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-400">
                <strong className="text-gray-300">Community Support:</strong><br />
                Join our Discord for 24/7 community help<br />
                Email support: Monday - Friday, 9:00 AM - 6:00 PM BST
              </p>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
