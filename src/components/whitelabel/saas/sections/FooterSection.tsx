'use client';

import { motion } from 'framer-motion';
import { FiMail, FiPhone, FiMapPin, FiTwitter, FiLinkedin, FiFacebook, FiInstagram } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import Image from 'next/image';

interface FooterSectionProps {
  branding: PartnerBranding;
  getTranslation: (key: string, fallback?: string) => string;
}

export default function FooterSection({ branding, getTranslation }: FooterSectionProps) {
  const currentYear = new Date().getFullYear();

  // Map logoSize setting to Tailwind height classes
  const getLogoSizeClass = () => {
    switch (branding.logoSize) {
      case 'small':
        return 'h-8'; // 32px
      case 'medium':
        return 'h-12'; // 48px
      case 'large':
        return 'h-16'; // 64px
      case 'extra-large':
        return 'h-20'; // 80px
      default:
        return 'h-12'; // Default to medium (48px)
    }
  };

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Company Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="col-span-2 md:col-span-1"
          >
            {/* Logo */}
            {branding.logo && (
              <div className="mb-4">
                <Image
                  src={branding.logo}
                  alt={`${branding.businessName} Logo`}
                  width={40}
                  height={40}
                  className={`${getLogoSizeClass()} w-auto mx-auto lg:mx-0 border rounded-md`}
                />
              </div>
            )}

            <h3 className="text-lg font-semibold mb-4">
              {branding.businessName}
            </h3>

            <p className="text-gray-400 mb-4 text-sm">
              {branding.portalSlogan || 'Powered by advanced AI technology to transform your business communications.'}
            </p>

            {/* Contact Info - Only show if enabled and has contact information */}
            {branding.showContactInfo !== false && (branding.supportEmail || branding.companyPhone || branding.companyAddress) && (
              <div className="space-y-2 text-sm">
                {branding.supportEmail && (
                  <div className="flex items-center space-x-2">
                    <FiMail className="text-gray-400" size={14} />
                    <a
                      href={`mailto:${branding.supportEmail}`}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {branding.supportEmail}
                    </a>
                  </div>
                )}

                {branding.companyPhone && (
                  <div className="flex items-center space-x-2">
                    <FiPhone className="text-gray-400" size={14} />
                    <a
                      href={`tel:${branding.companyPhone}`}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {branding.companyPhone}
                    </a>
                  </div>
                )}

                {branding.companyAddress && (
                  <div className="flex items-start space-x-2">
                    <FiMapPin className="text-gray-400 mt-0.5" size={14} />
                    <span className="text-gray-400">
                      {branding.companyAddress}
                    </span>
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Quick Links - Only show if enabled */}
          {branding.showQuickLinks !== false && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <h4 className="text-lg font-semibold mb-4">{getTranslation('footer.quickLinks', 'Quick Links')}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button
                    onClick={() => window.location.href = '/platform/onboarding/1'}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {getTranslation('footer.getStarted', 'Get Started')}
                  </button>
                </li>
                <li>
                  <a href="#features" className="text-gray-400 hover:text-white transition-colors">
                    {getTranslation('footer.features', 'Features')}
                  </a>
                </li>
                <li>
                  <a href="#testimonials" className="text-gray-400 hover:text-white transition-colors">
                    {getTranslation('footer.testimonials', 'Testimonials')}
                  </a>
                </li>
                {branding.statusPageUrl && (
                  <li>
                    <a
                      href={branding.statusPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {getTranslation('footer.status', 'Status')}
                    </a>
                  </li>
                )}
              </ul>
            </motion.div>
          )}

          {/* Legal - Only show if enabled and has content */}
          {branding.showLegal !== false && (branding.privacyPolicyUrl || branding.termsOfServiceUrl) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <h4 className="text-lg font-semibold mb-4">{getTranslation('footer.legal', 'Legal')}</h4>
              <ul className="space-y-2 text-sm">
                {branding.privacyPolicyUrl && (
                  <li>
                    <a
                      href={branding.privacyPolicyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {getTranslation('footer.privacyPolicy', 'Privacy Policy')}
                    </a>
                  </li>
                )}
                {branding.termsOfServiceUrl && (
                  <li>
                    <a
                      href={branding.termsOfServiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {getTranslation('footer.termsOfService', 'Terms of Service')}
                    </a>
                  </li>
                )}
              </ul>
            </motion.div>
          )}

          {/* Social Media - Only show if enabled and has social links */}
          {branding.showSocialMedia !== false && (branding.twitterUrl || branding.linkedinUrl || branding.facebookUrl || branding.instagramUrl) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <h4 className="text-lg font-semibold mb-4">{getTranslation('footer.followUs', 'Follow Us')}</h4>
              <div className="flex space-x-4">
                {branding.twitterUrl && (
                  <a
                    href={branding.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Follow us on Twitter"
                  >
                    <FiTwitter size={20} />
                  </a>
                )}
                {branding.linkedinUrl && (
                  <a
                    href={branding.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Follow us on LinkedIn"
                  >
                    <FiLinkedin size={20} />
                  </a>
                )}
                {branding.facebookUrl && (
                  <a
                    href={branding.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Follow us on Facebook"
                  >
                    <FiFacebook size={20} />
                  </a>
                )}
                {branding.instagramUrl && (
                  <a
                    href={branding.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Follow us on Instagram"
                  >
                    <FiInstagram size={20} />
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="border-t border-gray-800 mt-8 pt-8 text-center"
        >
          <p className="text-gray-400 text-sm">
            © {currentYear} {branding.businessName}. {getTranslation('footer.allRightsReserved', 'All rights reserved.')}
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
