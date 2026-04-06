import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LiveStatsData {
  totalMembers: number;
  waitlistCount: number;
  partnerCount: number;
  recentMembers: Array<{
    name: string;
    type: 'waitlist' | 'partner';
    joinedAt: string;
    action: string;
  }>;
  lastUpdated: string;
}

interface LiveStatsContextType {
  liveStats: LiveStatsData | null;
  isLoading: boolean;
  error: string | null;
  refreshStats: () => Promise<void>;
  getTotalCount: () => number; // Base count (137) + live count
}

const LiveStatsContext = createContext<LiveStatsContextType | undefined>(undefined);

interface LiveStatsProviderProps {
  children: ReactNode;
  baseCount?: number;
}

export const LiveStatsProvider: React.FC<LiveStatsProviderProps> = ({ 
  children, 
  baseCount = 137 
}) => {
  const [liveStats, setLiveStats] = useState<LiveStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/public/live-stats');
      const result = await response.json();
      
      if (result.success) {
        setLiveStats(result.data);
      } else {
        throw new Error('Failed to fetch live stats');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch live stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalCount = () => {
    if (!liveStats) return baseCount;
    return baseCount + liveStats.totalMembers;
  };

  useEffect(() => {
    // Fetch immediately
    fetchLiveStats();

    // Then fetch every 3 minutes (180 seconds)
    const interval = setInterval(fetchLiveStats, 180000);

    return () => clearInterval(interval);
  }, []);

  const value: LiveStatsContextType = {
    liveStats,
    isLoading,
    error,
    refreshStats: fetchLiveStats,
    getTotalCount
  };

  return (
    <LiveStatsContext.Provider value={value}>
      {children}
    </LiveStatsContext.Provider>
  );
};

export const useLiveStats = () => {
  const context = useContext(LiveStatsContext);
  if (context === undefined) {
    throw new Error('useLiveStats must be used within a LiveStatsProvider');
  }
  return context;
};

// Hook for components that just need the count
export const useLiveCount = () => {
  const { getTotalCount } = useLiveStats();
  return getTotalCount();
};
