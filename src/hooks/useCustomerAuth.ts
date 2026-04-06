'use client';

import { useState, useEffect } from 'react';
import { hasPermission, hasAnyPermission, hasAllPermissions, isAdminOrHigher, isMember, Permission } from '@/lib/rbac';

interface CustomerAuth {
  isAuthenticated: boolean;
  isLoading: boolean;
  customerId: string;
  email: string;
  partnerId: string;
  role: string | null;
  isTeamMember: boolean;
  teamMemberId: string | null;
  // Impersonation context
  isImpersonating: boolean;
  impersonatedBy?: string;
  impersonationSessionId?: string;
  // Permission checking functions
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  isAdminOrHigher: () => boolean;
  isMember: () => boolean;
}

export function useCustomerAuth(): CustomerAuth {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerId, setCustomerId] = useState('');
  const [email, setEmail] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [teamMemberId, setTeamMemberId] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedBy, setImpersonatedBy] = useState<string | undefined>(undefined);
  const [impersonationSessionId, setImpersonationSessionId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Verify authentication using httpOnly cookies
        const response = await fetch('/api/whitelabel/auth/me', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(true);
          setCustomerId(data.customer?.id);
          setEmail(data.customer?.email);
          setPartnerId(data.partner?.id);
          setRole(data.role || null);
          setIsTeamMember(data.isTeamMember || false);
          setTeamMemberId(data.teamMemberId || null);

          // Check for impersonation context
          if (data.impersonationContext) {
            setIsImpersonating(true);
            setImpersonatedBy(data.impersonationContext.impersonatedBy);
            setImpersonationSessionId(data.impersonationContext.sessionId);
          } else {
            setIsImpersonating(false);
            setImpersonatedBy(undefined);
            setImpersonationSessionId(undefined);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Error verifying authentication:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Permission checking functions
  const checkPermission = (permission: Permission): boolean => {
    return hasPermission(role, permission, isTeamMember);
  };

  const checkAnyPermission = (permissions: Permission[]): boolean => {
    return hasAnyPermission(role, permissions, isTeamMember);
  };

  const checkAllPermissions = (permissions: Permission[]): boolean => {
    return hasAllPermissions(role, permissions, isTeamMember);
  };

  const checkIsAdminOrHigher = (): boolean => {
    return isAdminOrHigher(role, isTeamMember);
  };

  const checkIsMember = (): boolean => {
    return isMember(role, isTeamMember);
  };

  return {
    isAuthenticated,
    isLoading,
    customerId,
    email,
    partnerId,
    role,
    isTeamMember,
    teamMemberId,
    isImpersonating,
    impersonatedBy,
    impersonationSessionId,
    hasPermission: checkPermission,
    hasAnyPermission: checkAnyPermission,
    hasAllPermissions: checkAllPermissions,
    isAdminOrHigher: checkIsAdminOrHigher,
    isMember: checkIsMember
  };
}
