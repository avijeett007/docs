'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  FiAward as FiTrophy,
  FiClock,
  FiCheck,
  FiGift,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import { useChallengeHistory } from '@/hooks/useDailyChallenges';

interface ChallengeHistoryProps {
  partnerId: string;
  className?: string;
}

export const ChallengeHistory: React.FC<ChallengeHistoryProps> = ({
  partnerId,
  className = ''
}) => {
  const { 
    challenges, 
    summary, 
    pagination, 
    isLoading, 
    error, 
    fetchHistory 
  } = useChallengeHistory(partnerId);

  if (isLoading) {
    return <ChallengeHistorySkeleton className={className} />;
  }

  if (error) {
    return (
      <div className={`bg-red-900/20 border border-red-500/30 rounded-lg p-6 ${className}`}>
        <div className="text-red-400 text-sm">
          Error loading challenge history: {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 rounded-lg border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">Challenge History</h2>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-2xl font-bold text-white">{summary.totalChallenges}</div>
            <div className="text-sm text-gray-400">Total Challenges</div>
          </div>
          <div className="bg-green-500/20 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-400">{summary.completed}</div>
            <div className="text-sm text-gray-400">Completed</div>
          </div>
          <div className="bg-blue-500/20 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-400">{summary.inProgress}</div>
            <div className="text-sm text-gray-400">In Progress</div>
          </div>
          <div className="bg-yellow-500/20 rounded-lg p-3">
            <div className="text-2xl font-bold text-yellow-400">{summary.totalCreditsEarned}</div>
            <div className="text-sm text-gray-400">Credits Earned</div>
          </div>
        </div>
      </div>

      {/* Challenge List */}
      <div className="p-6">
        {challenges.length === 0 ? (
          <div className="text-center py-8">
            <FiTrophy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">No Challenges Yet</h3>
            <p className="text-gray-400">
              Complete your first daily challenge to see your history here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {challenges.map((challenge, index) => (
              <ChallengeHistoryCard
                key={challenge.id}
                challenge={challenge}
                index={index}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-700">
            <div className="text-sm text-gray-400">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchHistory(pagination.page - 1)}
                disabled={!pagination.hasPrev}
                className="flex items-center gap-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <FiChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <button
                onClick={() => fetchHistory(pagination.page + 1)}
                disabled={!pagination.hasNext}
                className="flex items-center gap-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Next
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ChallengeHistoryCardProps {
  challenge: any;
  index: number;
}

const ChallengeHistoryCard: React.FC<ChallengeHistoryCardProps> = ({
  challenge,
  index
}) => {
  const getStatusIcon = () => {
    switch (challenge.status) {
      case 'completed':
        return <FiCheck className="w-5 h-5 text-green-400" />;
      case 'in_progress':
        return <FiClock className="w-5 h-5 text-blue-400" />;
      default:
        return <FiClock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (challenge.status) {
      case 'completed':
        return 'border-green-500/30 bg-green-500/10';
      case 'in_progress':
        return 'border-blue-500/30 bg-blue-500/10';
      default:
        return 'border-gray-600 bg-gray-800/50';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`border rounded-lg p-4 ${getStatusColor()}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className="flex-shrink-0 mt-1">
            {getStatusIcon()}
          </div>
          
          <div className="flex-1">
            <h4 className="text-white font-medium mb-1">
              {challenge.challenge.title}
            </h4>
            {challenge.challenge.description && (
              <p className="text-gray-300 text-sm mb-2 line-clamp-2">
                {challenge.challenge.description}
              </p>
            )}
            
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-1">
                <FiCalendar className="w-3 h-3" />
                {formatDate(challenge.challenge.scheduledDate)}
              </div>
              <div className="flex items-center gap-1">
                <FiCheck className="w-3 h-3" />
                {challenge.completedSteps}/{challenge.challenge.totalSteps} steps
              </div>
              {challenge.creditsAwarded > 0 && (
                <div className="flex items-center gap-1 text-yellow-400">
                  <FiGift className="w-3 h-3" />
                  {challenge.creditsAwarded} credits
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className={`text-sm font-medium ${
            challenge.status === 'completed' ? 'text-green-400' :
            challenge.status === 'in_progress' ? 'text-blue-400' : 'text-gray-400'
          }`}>
            {challenge.status === 'completed' ? 'Completed' :
             challenge.status === 'in_progress' ? 'In Progress' : 'Not Started'}
          </div>
          {challenge.completedAt && (
            <div className="text-xs text-gray-400 mt-1">
              {formatDate(challenge.completedAt)}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const ChallengeHistorySkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-gray-900 rounded-lg border border-gray-700 ${className}`}>
    <div className="p-6 border-b border-gray-700">
      <div className="h-6 bg-gray-600 rounded w-48 mb-4"></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-3">
            <div className="h-8 bg-gray-600 rounded w-12 mb-2"></div>
            <div className="h-4 bg-gray-600 rounded w-20"></div>
          </div>
        ))}
      </div>
    </div>
    <div className="p-6">
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border border-gray-600 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="w-5 h-5 bg-gray-600 rounded mt-1"></div>
              <div className="flex-1">
                <div className="h-5 bg-gray-600 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-600 rounded w-full mb-2"></div>
                <div className="flex gap-4">
                  <div className="h-4 bg-gray-600 rounded w-20"></div>
                  <div className="h-4 bg-gray-600 rounded w-16"></div>
                  <div className="h-4 bg-gray-600 rounded w-24"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
