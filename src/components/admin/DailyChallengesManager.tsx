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
  FiEye,
  FiEyeOff,
  FiSave
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

export default function DailyChallengesManager() {
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

      // Use the same pattern as other admin components - no auth headers needed
      // The admin authentication is handled via Supabase cookies
      const response = await fetch('/api/admin/challenges', {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // Include cookies for Supabase auth
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Failed to fetch challenges: ${response.status}`);
      }

      const result = await response.json();
      console.log('API Response:', result); // Debug logging

      // The API returns { success: true, data: { challenges: [...], pagination: {...} } }
      const challengesData = result.data?.challenges || result.challenges || [];

      if (!Array.isArray(challengesData)) {
        console.error('Expected challenges to be an array, got:', typeof challengesData, challengesData);
        setChallenges([]);
        toast.error('Invalid data format received from server');
        return;
      }

      setChallenges(challengesData);
    } catch (error) {
      console.error('Error fetching challenges:', error);
      toast.error('Failed to load challenges');
      setChallenges([]); // Ensure challenges is always an array
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChallenge = async (challengeId: string) => {
    if (!confirm('Are you sure you want to delete this challenge?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/challenges/${challengeId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // Include cookies for Supabase auth
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
      const response = await fetch(`/api/admin/challenges/${challengeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies for Supabase auth
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
      <div className="animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-64 mb-6"></div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-800 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Daily Challenges</h2>
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
        {!Array.isArray(challenges) || challenges.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-lg">
            <FiCalendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {!Array.isArray(challenges) ? 'Error Loading Challenges' : 'No Challenges Yet'}
            </h3>
            <p className="text-gray-400 mb-6">
              {!Array.isArray(challenges)
                ? 'There was an error loading the challenges. Please try refreshing the page.'
                : 'Create your first daily challenge to get started.'
              }
            </p>
            <button
              onClick={() => !Array.isArray(challenges) ? window.location.reload() : setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              {!Array.isArray(challenges) ? 'Reload Page' : 'Create First Challenge'}
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

// Challenge creation/edit modal component
const ChallengeModal: React.FC<{
  challenge: DailyChallenge | null;
  onClose: () => void;
  onSave: () => void;
}> = ({ challenge, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: challenge?.title || '',
    description: challenge?.description || '',
    rewardCredits: challenge?.rewardCredits || 50,
    requiresProof: challenge?.requiresProof || false,
    scheduledDate: challenge?.scheduledDate ? new Date(challenge.scheduledDate).toISOString().split('T')[0] : '',
    isActive: challenge?.isActive ?? true
  });

  const [steps, setSteps] = useState(challenge?.steps || [
    {
      id: 'step-1',
      title: '',
      description: '',
      type: 'action',
      estimatedTime: 5,
      notes: '',
      videoUrl: ''
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Challenge title is required');
      return;
    }

    if (steps.some(step => !step.title.trim())) {
      toast.error('All steps must have a title');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        steps: steps.map((step, index) => ({
          ...step,
          id: step.id || `step-${index + 1}`
        })),
        scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate).toISOString() : null
      };

      const url = challenge
        ? `/api/admin/challenges/${challenge.id}`
        : '/api/admin/challenges';

      const method = challenge ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save challenge');
      }

      toast.success(`Challenge ${challenge ? 'updated' : 'created'} successfully`);
      onSave();
    } catch (error) {
      console.error('Error saving challenge:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save challenge');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addStep = () => {
    setSteps([...steps, {
      id: `step-${steps.length + 1}`,
      title: '',
      description: '',
      type: 'action',
      estimatedTime: 5,
      notes: '',
      videoUrl: ''
    }]);
  };

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index));
    }
  };

  const updateStep = (index: number, field: string, value: any) => {
    const updatedSteps = [...steps];
    updatedSteps[index] = { ...updatedSteps[index], [field]: value };
    setSteps(updatedSteps);
  };

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
        className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
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

        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Basic Information</h3>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Challenge Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter challenge title..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 h-20"
                  placeholder="Enter challenge description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Reward Credits
                  </label>
                  <input
                    type="number"
                    value={formData.rewardCredits}
                    onChange={(e) => setFormData({ ...formData, rewardCredits: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.requiresProof}
                    onChange={(e) => setFormData({ ...formData, requiresProof: e.target.checked })}
                    className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                  />
                  Requires Proof
                </label>

                <label className="flex items-center gap-2 text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                  />
                  Active
                </label>
              </div>
            </div>

            {/* Steps Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Challenge Steps</h3>
                <button
                  type="button"
                  onClick={addStep}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                >
                  <FiPlus className="w-4 h-4" />
                  Add Step
                </button>
              </div>

              {steps.map((step, index) => (
                <div key={index} className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-medium">Step {index + 1}</h4>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Step Title *
                      </label>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => updateStep(index, 'title', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                        placeholder="Enter step title..."
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Type
                      </label>
                      <select
                        value={step.type}
                        onChange={(e) => updateStep(index, 'type', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="action">Action</option>
                        <option value="video">Video</option>
                        <option value="reading">Reading</option>
                        <option value="verification">Verification</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={step.description}
                      onChange={(e) => updateStep(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500 h-16"
                      placeholder="Enter step description..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Video URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={step.videoUrl || ''}
                      onChange={(e) => updateStep(index, 'videoUrl', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                      placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      If provided, video will be embedded when partner clicks this step
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Estimated Time (minutes)
                      </label>
                      <input
                        type="number"
                        value={step.estimatedTime}
                        onChange={(e) => updateStep(index, 'estimatedTime', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Notes
                      </label>
                      <input
                        type="text"
                        value={step.notes}
                        onChange={(e) => updateStep(index, 'notes', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                        placeholder="Optional notes..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg font-medium transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FiSave className="w-4 h-4" />
                    {challenge ? 'Update Challenge' : 'Create Challenge'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
};
