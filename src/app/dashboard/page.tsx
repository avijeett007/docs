'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiArrowRight, FiUsers, FiGlobe } from 'react-icons/fi';
import Link from 'next/link';

export default function DashboardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to partner portal after 5 seconds if no action is taken
    const timer = setTimeout(() => {
      router.push('/partner/login');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-teal-500 bg-clip-text text-transparent">
            Welcome to Knotie AI Pro
          </h1>
          
          <p className="text-xl text-gray-300 mb-12">
            Choose your portal to get started
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Partner Portal */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ scale: 1.05 }}
              className="bg-gray-800/50 backdrop-blur-lg border border-blue-400/20 rounded-xl p-6 hover:border-blue-400/40 transition-all duration-300"
            >
              <FiUsers className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-3">Partner Portal</h3>
              <p className="text-gray-400 mb-6">
                Manage customers, track performance, and grow your AI voice agent business
              </p>
              <Link
                href="/partner/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg font-semibold hover:from-blue-600 hover:to-teal-600 transition-all duration-300"
              >
                Partner Login
                <FiArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Customer Portal */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              whileHover={{ scale: 1.05 }}
              className="bg-gray-800/50 backdrop-blur-lg border border-teal-400/20 rounded-xl p-6 hover:border-teal-400/40 transition-all duration-300"
            >
              <FiGlobe className="w-12 h-12 text-teal-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-3">Customer Portal</h3>
              <p className="text-gray-400 mb-6">
                Access your AI agents, view analytics, and manage your voice AI services
              </p>
              <Link
                href="/whitelabel/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-500 rounded-lg font-semibold hover:from-teal-600 hover:to-blue-600 transition-all duration-300"
              >
                Customer Login
                <FiArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-sm text-gray-500"
          >
            Redirecting to Partner Portal in 5 seconds...
          </motion.p>
        </motion.div>
      </div>

      {/* Background Pattern */}
      <div className="fixed inset-0 z-[-1]">
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
            w-[800px] h-[800px] 
            bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-teal-500/10 
            rounded-full blur-[120px] opacity-50"
        />
      </div>
    </div>
  );
}
