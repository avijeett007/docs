'use client';

import React from 'react';
import { Shield, Lock, Server, CheckCircle2 } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';

const securityFeatures = [
  {
    title: 'End-to-End Encryption',
    description: 'All voice communications and data transmissions are protected with industry-standard encryption protocols.',
    icon: Lock
  },
  {
    title: 'SOC 2 Type II Compliant',
    description: 'Our platform adheres to strict security policies and procedures, verified through regular audits.',
    icon: CheckCircle2
  },
  {
    title: 'Secure Infrastructure',
    description: 'Hosted on enterprise-grade cloud infrastructure with multiple layers of security and redundancy.',
    icon: Server
  },
  {
    title: 'Data Protection',
    description: 'Comprehensive data protection measures including regular backups and disaster recovery protocols.',
    icon: Shield
  }
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      <PublicHeader />
      <main className="relative isolate">
        {/* Background */}
        <div
          className="absolute inset-x-0 top-4 -z-10 flex transform-gpu justify-center overflow-hidden blur-3xl"
          aria-hidden="true"
        >
          <div
            className="aspect-[1108/632] w-[69.25rem] flex-none bg-gradient-to-r from-[#80caff] to-[#4f46e5] opacity-20"
            style={{
              clipPath:
                'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
            }}
          />
        </div>

        {/* Content */}
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-16">
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-4">
                Security & Compliance
              </h1>
              <p className="text-lg text-gray-300">
                Your security is our top priority. Learn about our comprehensive security measures and compliance standards.
              </p>
            </div>

            {/* Security Features Grid */}
            <div className="grid md:grid-cols-2 gap-8 mb-16">
              {securityFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <Icon className="h-6 w-6 text-indigo-400" />
                      {feature.title}
                    </h2>
                    <p className="text-gray-300">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Detailed Security Information */}
            <div className="space-y-12">
              <section className="bg-gray-800 rounded-lg p-8 border border-gray-700">
                <h2 className="text-2xl font-semibold mb-6">Data Security</h2>
                <div className="space-y-4 text-gray-300">
                  <p>
                    At Knotie-AI Pro, we implement multiple layers of security to protect your data:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Regular security audits and penetration testing</li>
                    <li>24/7 infrastructure monitoring and threat detection</li>
                    <li>Secure data centers with physical security measures</li>
                    <li>Encrypted data storage and transmission</li>
                  </ul>
                </div>
              </section>

              <section className="bg-gray-800 rounded-lg p-8 border border-gray-700">
                <h2 className="text-2xl font-semibold mb-6">Compliance & Certifications</h2>
                <div className="space-y-4 text-gray-300">
                  <p>
                    We maintain compliance with industry standards and regulations:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>SOC 2 Type II certified</li>
                    <li>GDPR compliant</li>
                    <li>HIPAA compliant (for healthcare integrations)</li>
                    <li>ISO 27001 certified</li>
                  </ul>
                </div>
              </section>

              <section className="bg-gray-800 rounded-lg p-8 border border-gray-700">
                <h2 className="text-2xl font-semibold mb-6">Security Best Practices</h2>
                <div className="space-y-4 text-gray-300">
                  <p>
                    We follow industry best practices for security:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Regular security training for all employees</li>
                    <li>Strict access control and authentication procedures</li>
                    <li>Continuous security monitoring and updates</li>
                    <li>Incident response and disaster recovery plans</li>
                  </ul>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
