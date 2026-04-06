import { useState, useEffect, useCallback } from 'react';
import { ChallengeWithProgress, PartnerChallengeProgress } from '@/services/ChallengeService';

interface UseDailyChallengesReturn {
  currentChallenge: ChallengeWithProgress | null;
  isLoading: boolean;
  error: string | null;
  startChallenge: (challengeId: string) => Promise<void>;
  completeStep: (challengeId: string, stepId: string) => Promise<void>;
  completeChallenge: (challengeId: string, proofSubmitted?: string) => Promise<void>;
  refreshChallenge: () => Promise<void>;
}

export const useDailyChallenges = (partnerId?: string): UseDailyChallengesReturn => {
  const [currentChallenge, setCurrentChallenge] = useState<ChallengeWithProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentChallenge = useCallback(async () => {
    if (!partnerId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/partner/challenges/current', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch current challenge');
      }

      setCurrentChallenge(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching current challenge:', err);
    } finally {
      setIsLoading(false);
    }
  }, [partnerId]);

  const startChallenge = useCallback(async (challengeId: string) => {
    try {
      setError(null);

      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/partner/challenges/${challengeId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start challenge');
      }

      // Refresh current challenge to get updated progress
      await fetchCurrentChallenge();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  }, [fetchCurrentChallenge]);

  const completeStep = useCallback(async (challengeId: string, stepId: string) => {
    try {
      setError(null);

      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/partner/challenges/${challengeId}/step`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stepId })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to complete step');
      }

      // Update current challenge with new progress
      if (currentChallenge && currentChallenge.partnerProgress) {
        const updatedProgress: PartnerChallengeProgress = {
          ...currentChallenge.partnerProgress,
          completedSteps: result.data.completedSteps,
          updatedAt: new Date()
        };

        setCurrentChallenge({
          ...currentChallenge,
          partnerProgress: updatedProgress
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  }, [currentChallenge]);

  const completeChallenge = useCallback(async (challengeId: string, proofSubmitted?: string) => {
    try {
      setError(null);

      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/partner/challenges/${challengeId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ proofSubmitted })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to complete challenge');
      }

      // Refresh current challenge to get updated progress
      await fetchCurrentChallenge();

      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  }, [fetchCurrentChallenge]);

  const refreshChallenge = useCallback(async () => {
    await fetchCurrentChallenge();
  }, [fetchCurrentChallenge]);

  useEffect(() => {
    fetchCurrentChallenge();
  }, [fetchCurrentChallenge]);

  // Listen for challenge completion events to refresh challenge state
  useEffect(() => {
    const handleChallengeCompleted = () => {
      console.log('Challenge completed, refreshing challenge state...');
      fetchCurrentChallenge();
    };

    window.addEventListener('challengeCompleted', handleChallengeCompleted);
    return () => window.removeEventListener('challengeCompleted', handleChallengeCompleted);
  }, [fetchCurrentChallenge]);

  return {
    currentChallenge,
    isLoading,
    error,
    startChallenge,
    completeStep,
    completeChallenge,
    refreshChallenge
  };
};

interface UseChallengeHistoryReturn {
  challenges: any[];
  summary: {
    totalChallenges: number;
    completed: number;
    inProgress: number;
    totalCreditsEarned: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  isLoading: boolean;
  error: string | null;
  fetchHistory: (page?: number, status?: string) => Promise<void>;
}

export const useChallengeHistory = (partnerId?: string): UseChallengeHistoryReturn => {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalChallenges: 0,
    completed: 0,
    inProgress: 0,
    totalCreditsEarned: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (page = 1, status?: string) => {
    if (!partnerId) return;

    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });

      if (status) {
        params.append('status', status);
      }

      const response = await fetch(`/api/partner/challenges/history?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch challenge history');
      }

      setChallenges(result.data.challenges);
      setSummary(result.data.summary);
      setPagination(result.data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching challenge history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    challenges,
    summary,
    pagination,
    isLoading,
    error,
    fetchHistory
  };
};
