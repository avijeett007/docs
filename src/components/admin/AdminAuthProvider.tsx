'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Custom loading spinner implementation
function LoadingSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 z-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
    </div>
  );
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
}

type AdminAuthContextType = {
  user: AdminUser | null;
  signIn: (email: string, password: string) => Promise<{
    error: Error | null;
    data: any;
    mfaRequired?: boolean;
    userId?: string;
  }>;
  verifyMFA: (code: string, isBackupCode: boolean, userId: string) => Promise<{
    error: Error | null;
    data: any;
  }>;
  signOut: () => Promise<void>;
  loading: boolean;
  mfaRequired: boolean;
  setMfaRequired: (required: boolean) => void;
  pendingMFAUserId: string | null;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export default function AdminAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [pendingMFAUserId, setPendingMFAUserId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Check authentication status on mount and route changes
  useEffect(() => {
    checkAuthStatus();
  }, [pathname]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/admin/auth/me', {
        method: 'GET',
        credentials: 'include', // Include cookies
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setMfaRequired(false);
        setPendingMFAUserId(null);
      } else if (response.status === 403) {
        // MFA verification required
        const data = await response.json();
        if (data.mfaRequired) {
          setUser(null);
          setMfaRequired(true);
          setPendingMFAUserId(data.user?.id || null);
          // Redirect to login page to show MFA verification
          if (pathname !== '/mission-control/login') {
            router.push('/mission-control/login');
          }
        } else {
          setUser(null);
          setMfaRequired(false);
          setPendingMFAUserId(null);
          if (pathname !== '/mission-control/login') {
            router.push('/mission-control/login');
          }
        }
      } else {
        setUser(null);
        setMfaRequired(false);
        setPendingMFAUserId(null);
        // Redirect to login if not on login page
        if (pathname !== '/mission-control/login') {
          router.push('/mission-control/login');
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      if (pathname !== '/mission-control/login') {
        router.push('/mission-control/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: new Error(data.error || 'Login failed'),
          data: null
        };
      }

      // Check if MFA is required (server determines enforcement)
      if (data.mfaRequired) {
        setMfaRequired(true);
        setPendingMFAUserId(data.user.id);
        return {
          error: null,
          data: null,
          mfaRequired: true,
          userId: data.user.id
        };
      }

      setUser(data.user);
      return {
        error: null,
        data: data.user
      };

    } catch (error) {
      console.error('Sign in error:', error);
      return {
        error: error instanceof Error ? error : new Error('Unknown error during sign in'),
        data: null
      };
    } finally {
      setLoading(false);
    }
  };

  const verifyMFA = async (code: string, isBackupCode: boolean, userId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code, isBackupCode, userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: new Error(data.error || 'MFA verification failed'),
          data: null
        };
      }

      setUser(data.user);
      setMfaRequired(false);
      setPendingMFAUserId(null);
      return {
        error: null,
        data: data.user
      };

    } catch (error) {
      console.error('MFA verification error:', error);
      return {
        error: error instanceof Error ? error : new Error('Unknown error during MFA verification'),
        data: null
      };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        credentials: 'include', // Include cookies
      });

      setUser(null);
      setMfaRequired(false);
      setPendingMFAUserId(null);
      router.push('/mission-control/login');
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if the API call fails, clear local state and redirect
      setUser(null);
      setMfaRequired(false);
      setPendingMFAUserId(null);
      router.push('/mission-control/login');
    }
  };

  // Redirect logic
  useEffect(() => {
    if (!loading) {
      if (!user && !mfaRequired && pathname !== '/mission-control/login') {
        router.push('/mission-control/login');
      } else if (user && pathname === '/mission-control/login') {
        router.push('/mission-control');
      }
    }
  }, [user, loading, pathname, router, mfaRequired]);

  const value = {
    user,
    signIn,
    verifyMFA,
    signOut,
    loading,
    mfaRequired,
    setMfaRequired,
    pendingMFAUserId,
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
