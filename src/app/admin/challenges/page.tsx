'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiCalendar,
  FiGift,
  FiCheck,
  FiX,
  // FiSave, // Unused
  FiEye,
  FiEyeOff
} from 'react-icons/fi';
import toast from 'react-hot-toast';

interface DailyChallenge {
  id: string;
  title: string;
  description?: string;
  steps: any[];
  rewardCredits: number;
  requiresProof: boolean;
  scheduledDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminChallengesPage() {
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<DailyChallenge | null>(null);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('admin_token') || localStorage.getItem('partner_token');
      
      const response = await fetch('/api/admin/challenges', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch challenges');
      }

      const result = await response.json();
      setChallenges(result.data || []);
    } catch (error) {
      console.error('Error fetching challenges:', error);
      toast.error('Failed to load challenges');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChallenge = async (challengeId: string) => {
    if (!confirm('Are you sure you want to delete this challenge?')) {
      return;
    }

    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('partner_token');
      
      const response = await fetch(`/api/admin/challenges/${challengeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete challenge');
      }

      toast.success('Challenge deleted successfully');
      fetchChallenges();
    } catch (error) {
      console.error('Error deleting challenge:', error);
      toast.error('Failed to delete challenge');
    }
  };

  const handleToggleActive = async (challengeId: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('partner_token');
      
      const response = await fetch(`/api/admin/challenges/${challengeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !isActive })
      });

      if (!response.ok) {
        throw new Error('Failed to update challenge');
      }

      toast.success(`Challenge ${!isActive ? 'activated' : 'deactivated'} successfully`);
      fetchChallenges();
    } catch (error) {
      console.error('Error updating challenge:', error);
      toast.error('Failed to update challenge');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-64 mb-6"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-800 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Daily Challenges</h1>
            <p className="text-gray-400">Manage daily challenges for partner engagement</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            Create Challenge
          </button>
        </div>

        {/* Challenges List */}
        <div className="space-y-4">
          {challenges.length === 0 ? (
            <div className="text-center py-12">
              <FiCalendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Challenges Yet</h3>
              <p className="text-gray-400 mb-6">Create your first daily challenge to get started.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Create First Challenge
              </button>
            </div>
          ) : (
            challenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onEdit={setEditingChallenge}
                onDelete={handleDeleteChallenge}
                onToggleActive={handleToggleActive}
              />
            ))
          )}
        </div>

        {/* Create/Edit Modal */}
        <AnimatePresence>
          {(showCreateModal || editingChallenge) && (
            <ChallengeModal
              challenge={editingChallenge}
              onClose={() => {
                setShowCreateModal(false);
                setEditingChallenge(null);
              }}
              onSave={() => {
                setShowCreateModal(false);
                setEditingChallenge(null);
                fetchChallenges();
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface ChallengeCardProps {
  challenge: DailyChallenge;
  onEdit: (challenge: DailyChallenge) => void;
  onDelete: (challengeId: string) => void;
  onToggleActive: (challengeId: string, isActive: boolean) => void;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  onEdit,
  onDelete,
  onToggleActive
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not scheduled';
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
      className={`bg-gray-800 border rounded-lg p-6 ${
        challenge.isActive ? 'border-green-500/30' : 'border-gray-600'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold text-white">{challenge.title}</h3>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              challenge.isActive 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-gray-600/20 text-gray-400'
            }`}>
              {challenge.isActive ? 'Active' : 'Inactive'}
            </div>
          </div>
          
          {challenge.description && (
            <p className="text-gray-300 mb-3 line-clamp-2">{challenge.description}</p>
          )}
          
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-1">
              <FiCalendar className="w-4 h-4" />
              {formatDate(challenge.scheduledDate)}
            </div>
            <div className="flex items-center gap-1">
              <FiGift className="w-4 h-4" />
              {challenge.rewardCredits} credits
            </div>
            <div className="flex items-center gap-1">
              <FiCheck className="w-4 h-4" />
              {challenge.steps.length} steps
            </div>
            {challenge.requiresProof && (
              <div className="text-yellow-400">Requires Proof</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onToggleActive(challenge.id, challenge.isActive)}
            className={`p-2 rounded-lg transition-colors ${
              challenge.isActive
                ? 'text-green-400 hover:bg-green-500/20'
                : 'text-gray-400 hover:bg-gray-700'
            }`}
            title={challenge.isActive ? 'Deactivate' : 'Activate'}
          >
            {challenge.isActive ? <FiEye className="w-4 h-4" /> : <FiEyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onEdit(challenge)}
            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
            title="Edit"
          >
            <FiEdit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(challenge.id)}
            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
            title="Delete"
          >
            <FiTrash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Placeholder for the modal component
const ChallengeModal: React.FC<{
  challenge: DailyChallenge | null;
  onClose: () => void;
  onSave: () => void;
}> = ({ challenge, onClose, onSave }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {challenge ? 'Edit Challenge' : 'Create Challenge'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        
        <div className="text-center py-8">
          <p className="text-gray-400">Challenge creation form coming soon...</p>
          <button
            onClick={onSave}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
