import React from 'react';
import { motion } from 'framer-motion';

interface AdditionalServicesProps {
  showCalendar: boolean;
  onScheduleCall: () => void;
}

export const AdditionalServices: React.FC<AdditionalServicesProps> = ({
  showCalendar,
  onScheduleCall
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto p-6"
    >
      {/* Calendar Section */}
      {showCalendar && (
        <div className="bg-gray-900/50 backdrop-blur-lg rounded-xl p-8 border border-gray-800 shadow-xl mb-8">
          <h3 className="text-2xl font-bold text-white mb-6">Schedule a Demo</h3>
          <div className="aspect-video w-full">
            <iframe
              src={process.env.CALENDAR_EMBED_URL}
              width="100%"
              height="100%"
              frameBorder="0"
              title="Schedule Demo"
            />
          </div>
        </div>
      )}

      {/* Schedule Call Button */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={onScheduleCall}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-blue-500 to-teal-500 text-white hover:from-blue-600 hover:to-teal-600 transition-colors shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Schedule a Call
        </button>
      </div>

      {/* Platform Comparison */}
      <div className="bg-gray-900/50 backdrop-blur-lg rounded-xl p-8 border border-gray-800 shadow-xl mb-8">
        <h3 className="text-2xl font-bold text-white mb-6">Compare with Other Platforms</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="py-4 px-6 text-gray-400">Features</th>
                <th className="py-4 px-6 text-blue-400">Knotie AI</th>
                <th className="py-4 px-6 text-gray-400">Traditional Call Centers</th>
                <th className="py-4 px-6 text-gray-400">Basic AI Solutions</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-gray-800">
                <td className="py-4 px-6">24/7 Availability</td>
                <td className="py-4 px-6">✓</td>
                <td className="py-4 px-6">Limited</td>
                <td className="py-4 px-6">✓</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-4 px-6">Natural Conversations</td>
                <td className="py-4 px-6">✓</td>
                <td className="py-4 px-6">✓</td>
                <td className="py-4 px-6">Limited</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-4 px-6">CRM Integration</td>
                <td className="py-4 px-6">✓</td>
                <td className="py-4 px-6">Limited</td>
                <td className="py-4 px-6">Limited</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-4 px-6">Cost per Agent</td>
                <td className="py-4 px-6">Fixed</td>
                <td className="py-4 px-6">High</td>
                <td className="py-4 px-6">Medium</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-4 px-6">Scalability</td>
                <td className="py-4 px-6">Instant</td>
                <td className="py-4 px-6">Slow</td>
                <td className="py-4 px-6">Medium</td>
              </tr>
              <tr>
                <td className="py-4 px-6">Complimentary Website</td>
                <td className="py-4 px-6">✓</td>
                <td className="py-4 px-6">✗</td>
                <td className="py-4 px-6">✗</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};
