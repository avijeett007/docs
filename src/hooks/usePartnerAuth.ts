/**
 * Partner Authentication Hook
 * 
 * Provides authentication state and role-based permission checking
 * for the partner portal.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { JWTPayload } from '@/lib/jwt';
import { hasPermission, hasAnyPermission, hasAllPermissions, isAdminOrHigher, isMember, Permission } from '@/lib/rbac';

interface PartnerAuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  partnerId: string | null;
  email: string | null;
  role: string | null;
  isTeamMember: boolean;
  teamMemberId: string | null;
  hasChangedPassword: boolean;
}

interface PartnerAuthHook extends PartnerAuthState {
  // Permission checking functions
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  isAdminOrHigher: () => boolean;
  isMember: () => boolean;
  
  // Authentication actions
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

export function usePartnerAuth(): PartnerAuthHook {
  const router = useRouter();
  const [authState, setAuthState] = useState<PartnerAuthState>({
    isLoading: true,
    isAuthenticated: false,
    partnerId: null,
    email: null,
    role: null,
    isTeamMember: false,
    teamMemberId: null,
    hasChangedPassword: true
  });

  // Function to verify and update authentication state
  const verifyAuth = async (): Promise<JWTPayload | null> => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        return null;
      }

      // Use API endpoint to verify token instead of client-side verification
      const response = await fetch('/api/partner/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.payload;
    } catch (error) {
      console.error('Error verifying partner auth:', error);
      return null;
    }
  };

  // Update auth state from JWT payload
  const updateAuthState = (payload: JWTPayload | null) => {
    if (payload) {
      setAuthState({
        isLoading: false,
        isAuthenticated: true,
        partnerId: payload.partnerId,
        email: payload.email,
        role: payload.role || null,
        isTeamMember: payload.isTeamMember || false,
        teamMemberId: payload.teamMemberId || null,
        hasChangedPassword: payload.hasChangedPassword !== false
      });
    } else {
      setAuthState({
        isLoading: false,
        isAuthenticated: false,
        partnerId: null,
        email: null,
        role: null,
        isTeamMember: false,
        teamMemberId: null,
        hasChangedPassword: true
      });
    }
  };

  // Initial auth check
  useEffect(() => {
    const checkAuth = async () => {
      const payload = await verifyAuth();
      updateAuthState(payload);
    };

    checkAuth();
  }, []);

  // Refresh authentication state
  const refreshAuth = async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    const payload = await verifyAuth();
    updateAuthState(payload);
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('partner_token');
    setAuthState({
      isLoading: false,
      isAuthenticated: false,
      partnerId: null,
      email: null,
      role: null,
      isTeamMember: false,
      teamMemberId: null,
      hasChangedPassword: true
    });
    router.push('/partner/login');
  };

  // Permission checking functions
  const checkPermission = (permission: Permission): boolean => {
    return hasPermission(authState.role, permission, authState.isTeamMember);
  };

  const checkAnyPermission = (permissions: Permission[]): boolean => {
    return hasAnyPermission(authState.role, permissions, authState.isTeamMember);
  };

  const checkAllPermissions = (permissions: Permission[]): boolean => {
    return hasAllPermissions(authState.role, permissions, authState.isTeamMember);
  };

  const checkIsAdminOrHigher = (): boolean => {
    return isAdminOrHigher(authState.role, authState.isTeamMember);
  };

  const checkIsMember = (): boolean => {
    return isMember(authState.role, authState.isTeamMember);
  };

  return {
    ...authState,
    hasPermission: checkPermission,
    hasAnyPermission: checkAnyPermission,
    hasAllPermissions: checkAllPermissions,
    isAdminOrHigher: checkIsAdminOrHigher,
    isMember: checkIsMember,
    logout,
    refreshAuth
  };
}

export default usePartnerAuth;
