'use client';

import React, { useState, useEffect } from 'react';
import { FiAlertCircle, FiInfo, FiRefreshCw, FiCheckCircle, FiClock, FiMessageSquare, FiTag } from 'react-icons/fi';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface ActionPointAnalyticsProps {
  userId: string;
}

interface Customer {
  id: string;
  name: string;
}

interface ActionItem {
  customer: Customer;
  action: string;
  call_id: string;
}

interface KeyMoment {
  text: string;
  type: string;
  importance: number;
  call_id: string;
}

interface FollowUp {
  call_id: string;
  intent: string;
  outcome: string;
  customer: Customer | string;
}

interface ActionPointsData {
  customer_id: string;
  action_items: ActionItem[];
  key_moments: KeyMoment[];
  follow_up_needed: FollowUp[];
}

const ActionPointAnalytics: React.FC<ActionPointAnalyticsProps> = ({ userId }) => {
  const [actionPointsData, setActionPointsData] = useState<ActionPointsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'action-items' | 'key-moments' | 'follow-ups'>('action-items');
  const { branding } = usePartnerBranding();
  const { primaryColor, secondaryColor } = branding;

  const fetchActionPointsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/customer/action-points');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch action points data');
      }
      
      const data = await response.json();
      setActionPointsData(data);
    } catch (err) {
      console.error('Error fetching action points data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActionPointsData();
  }, []);

  const handleRefresh = () => {
    fetchActionPointsData();
  };

  // Group action items by type
  const groupedActionItems = actionPointsData?.action_items.reduce((acc, item) => {
    const actionType = item.action.toLowerCase().includes('support') 
      ? 'support' 
      : item.action.toLowerCase().includes('sales') 
        ? 'sales' 
        : 'customer_service';
    
    if (!acc[actionType]) {
      acc[actionType] = [];
    }
    
    acc[actionType].push(item);
    return acc;
  }, {} as Record<string, ActionItem[]>) || {};

  // Group key moments by type
  const groupedKeyMoments = actionPointsData?.key_moments.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = [];
    }
    
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, KeyMoment[]>) || {};

  // Group follow-ups by intent
  const groupedFollowUps = actionPointsData?.follow_up_needed.reduce((acc, item) => {
    if (!acc[item.intent]) {
      acc[item.intent] = [];
    }
    
    acc[item.intent].push(item);
    return acc;
  }, {} as Record<string, FollowUp[]>) || {};

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
          <FiAlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
          <p className="text-red-400">{error}</p>
        </div>
      ) : !actionPointsData || (
        !actionPointsData.action_items.length && 
        !actionPointsData.key_moments.length && 
        !actionPointsData.follow_up_needed.length
      ) ? (
        <div className="bg-gray-800/50 rounded-lg p-6 text-center">
          <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-400">No action points data available.</p>
        </div>
      ) : (
        <>
          {/* Tab Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('action-items')}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  activeTab === 'action-items'
                    ? "bg-blue-500 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                )}
                style={activeTab === 'action-items' ? { backgroundColor: primaryColor } : {}}
              >
                <div className="flex items-center">
                  <FiCheckCircle className="mr-2 h-4 w-4" />
                  Action Items
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('key-moments')}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  activeTab === 'key-moments'
                    ? "bg-blue-500 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                )}
                style={activeTab === 'key-moments' ? { backgroundColor: primaryColor } : {}}
              >
                <div className="flex items-center">
                  <FiMessageSquare className="mr-2 h-4 w-4" />
                  Key Moments
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('follow-ups')}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  activeTab === 'follow-ups'
                    ? "bg-blue-500 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                )}
                style={activeTab === 'follow-ups' ? { backgroundColor: primaryColor } : {}}
              >
                <div className="flex items-center">
                  <FiClock className="mr-2 h-4 w-4" />
                  Follow-ups
                </div>
              </button>
            </div>
            
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
              disabled={loading}
            >
              <FiRefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
            </button>
          </div>
          
          {/* Content */}
          <div className="space-y-6">
            {activeTab === 'action-items' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {Object.entries(groupedActionItems).length === 0 ? (
                  <div className="bg-gray-800/50 rounded-lg p-6 text-center">
                    <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-400">No action items available.</p>
                  </div>
                ) : (
                  Object.entries(groupedActionItems).map(([type, items]) => (
                    <div key={type} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                        <FiTag className="mr-2 h-5 w-5" style={{ color: primaryColor }} />
                        {type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} Actions
                      </h4>
                      <div className="space-y-3">
                        {items.map((item, index) => (
                          <div key={index} className="p-3 bg-gray-800/70 rounded-lg">
                            <div className="text-white font-medium mb-1">{item.action}</div>
                            <div className="text-gray-400 text-sm">
                              Customer: {item.customer.name || 'Unknown'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
            
            {activeTab === 'key-moments' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {Object.entries(groupedKeyMoments).length === 0 ? (
                  <div className="bg-gray-800/50 rounded-lg p-6 text-center">
                    <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-400">No key moments available.</p>
                  </div>
                ) : (
                  Object.entries(groupedKeyMoments).map(([type, moments]) => (
                    <div key={type} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                        <FiMessageSquare className="mr-2 h-5 w-5" style={{ color: primaryColor }} />
                        {type.charAt(0).toUpperCase() + type.slice(1)} Moments
                      </h4>
                      <div className="space-y-3">
                        {moments.map((moment, index) => (
                          <div key={index} className="p-3 bg-gray-800/70 rounded-lg">
                            <div className="text-white font-medium mb-1">{moment.text}</div>
                            <div className="text-gray-400 text-sm">
                              Importance: {moment.importance}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
            
            {activeTab === 'follow-ups' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {Object.entries(groupedFollowUps).length === 0 ? (
                  <div className="bg-gray-800/50 rounded-lg p-6 text-center">
                    <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-400">No follow-ups needed.</p>
                  </div>
                ) : (
                  Object.entries(groupedFollowUps).map(([intent, followUps]) => (
                    <div key={intent} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                        <FiClock className="mr-2 h-5 w-5" style={{ color: primaryColor }} />
                        {intent.charAt(0).toUpperCase() + intent.slice(1)} Follow-ups
                      </h4>
                      <div className="space-y-3">
                        {followUps.map((followUp, index) => (
                          <div key={index} className="p-3 bg-gray-800/70 rounded-lg">
                            <div className="text-white font-medium mb-1">
                              {typeof followUp.customer === 'string' 
                                ? followUp.customer 
                                : followUp.customer.name || 'Unknown'}
                            </div>
                            <div className="text-gray-400 text-sm">
                              Intent: {followUp.intent.charAt(0).toUpperCase() + followUp.intent.slice(1)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ActionPointAnalytics;
