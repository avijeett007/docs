'use client';

import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiClock, FiCalendar } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { subDays } from 'date-fns';

interface ActionPoint {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed' | 'overdue';
  due_date: string;
  call_id: string;
  call_date: string;
  priority: 'low' | 'medium' | 'high';
}

interface DateRange {
  label: string;
  days: number;
}

interface WhitelabelActionPointAnalyticsProps {
  selectedDateRange: DateRange;
}

const WhitelabelActionPointAnalytics: React.FC<WhitelabelActionPointAnalyticsProps> = ({ selectedDateRange }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPoints, setActionPoints] = useState<ActionPoint[]>([]);
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;

  const fetchActionPoints = async () => {
    setLoading(true);
    setError(null);

    try {
      const endDate = new Date().toISOString();
      const startDate = subDays(new Date(), selectedDateRange.days).toISOString();

      const response = await fetch(`/api/whitelabel/action-points?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch action points');
      }

      const data = await response.json();
      setActionPoints(data);
    } catch (err) {
      console.error('Error fetching action points:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActionPoints();
  }, [selectedDateRange.days]); // Only re-fetch when the actual days value changes

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mb-4" style={{ borderColor: primaryColor }}></div>
        <p className="text-gray-400 text-sm">Loading action points for {selectedDateRange.label.toLowerCase()}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
        <FiAlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!actionPoints || actionPoints.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-6 text-center">
        <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-gray-400">No action points available.</p>
      </div>
    );
  }

  // Group action points by status
  const pendingPoints = actionPoints.filter(point => point.status === 'pending');
  const completedPoints = actionPoints.filter(point => point.status === 'completed');
  const overduePoints = actionPoints.filter(point => point.status === 'overdue');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-gray-400 text-sm">Pending</div>
            <FiClock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-semibold text-white">
            {pendingPoints.length}
          </div>
          <div className="mt-1 text-sm text-gray-400">
            Action points awaiting completion
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-gray-400 text-sm">Completed</div>
            <FiCheckCircle className="w-5 h-5" style={{ color: primaryColor }} />
          </div>
          <div className="text-2xl font-semibold text-white">
            {completedPoints.length}
          </div>
          <div className="mt-1 text-sm text-gray-400">
            Action points successfully completed
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-gray-400 text-sm">Overdue</div>
            <FiAlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-semibold text-white">
            {overduePoints.length}
          </div>
          <div className="mt-1 text-sm text-gray-400">
            Action points past due date
          </div>
        </motion.div>
      </div>

      {/* Action Points List */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-4">Recent Action Points</h3>
        
        <div className="space-y-4">
          {actionPoints.slice(0, 5).map((point, index) => (
            <motion.div
              key={point.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-gray-700/30 rounded-lg p-4 border border-gray-700/50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    {point.status === 'completed' ? (
                      <FiCheckCircle className="w-5 h-5 mr-2" style={{ color: primaryColor }} />
                    ) : point.status === 'overdue' ? (
                      <FiAlertCircle className="w-5 h-5 mr-2 text-red-500" />
                    ) : (
                      <FiClock className="w-5 h-5 mr-2 text-amber-500" />
                    )}
                    <h4 className="text-white font-medium">{point.title}</h4>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">{point.description}</p>
                  
                  <div className="flex items-center mt-3 text-xs text-gray-400">
                    <div className="flex items-center mr-4">
                      <FiCalendar className="w-3 h-3 mr-1" />
                      <span>Due: {new Date(point.due_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center">
                      <span>Priority: </span>
                      <span className={`ml-1 ${
                        point.priority === 'high' ? 'text-red-400' : 
                        point.priority === 'medium' ? 'text-amber-400' : 
                        'text-green-400'
                      }`}>
                        {point.priority.charAt(0).toUpperCase() + point.priority.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="ml-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    point.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                    point.status === 'overdue' ? 'bg-red-500/20 text-red-400' : 
                    'bg-yellow-500/20 text-amber-400'
                  }`}>
                    {point.status.charAt(0).toUpperCase() + point.status.slice(1)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {actionPoints.length > 5 && (
          <div className="mt-4 text-center">
            <button 
              className="px-4 py-2 text-sm rounded-lg"
              style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
            >
              View All Action Points
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhitelabelActionPointAnalytics;
