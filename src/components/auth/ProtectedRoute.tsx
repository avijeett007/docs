/**
 * Protected Route Component
 * 
 * Provides route-level protection based on user roles and permissions.
 * Can be used to wrap pages or components that require specific access levels.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Permission } from '@/lib/rbac';
import { FiLock, FiArrowLeft } from 'react-icons/fi';

interface ProtectedRouteProps {
  children: React.ReactNode;
  hasPermission: (permission: Permission) => boolean;
  requiredPermission: Permission;
  fallbackPath?: string;
  showAccessDenied?: boolean;
  customAccessDeniedComponent?: React.ComponentType;
}

interface AccessDeniedProps {
  onGoBack: () => void;
  fallbackPath?: string;
}

function AccessDenied({ onGoBack, fallbackPath }: AccessDeniedProps) {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <div className="mb-6">
          <FiLock className="mx-auto h-16 w-16 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-gray-400 mb-6">
          You don't have permission to access this page. Please contact your administrator if you believe this is an error.
        </p>
        <button
          onClick={onGoBack}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiArrowLeft className="mr-2" />
          {fallbackPath ? 'Go to Dashboard' : 'Go Back'}
        </button>
      </div>
    </div>
  );
}

export function ProtectedRoute({
  children,
  hasPermission,
  requiredPermission,
  fallbackPath = '/dashboard',
  showAccessDenied = true,
  customAccessDeniedComponent: CustomAccessDenied
}: ProtectedRouteProps) {
  const router = useRouter();

  // Check if user has required permission
  const userHasPermission = hasPermission(requiredPermission);

  const handleGoBack = () => {
    if (fallbackPath) {
      router.push(fallbackPath);
    } else {
      router.back();
    }
  };

  // If user doesn't have permission
  if (!userHasPermission) {
    if (!showAccessDenied) {
      // Redirect silently
      router.push(fallbackPath);
      return null;
    }

    // Show access denied component
    if (CustomAccessDenied) {
      return <CustomAccessDenied />;
    }

    return <AccessDenied onGoBack={handleGoBack} fallbackPath={fallbackPath} />;
  }

  // User has permission, render children
  return <>{children}</>;
}

/**
 * Higher-order component for protecting pages
 */
export function withPermission<T extends object>(
  Component: React.ComponentType<T>,
  requiredPermission: Permission,
  options?: {
    fallbackPath?: string;
    showAccessDenied?: boolean;
    customAccessDeniedComponent?: React.ComponentType;
  }
) {
  return function ProtectedComponent(props: T & { hasPermission: (permission: Permission) => boolean }) {
    const { hasPermission, ...componentProps } = props;

    return (
      <ProtectedRoute
        hasPermission={hasPermission}
        requiredPermission={requiredPermission}
        fallbackPath={options?.fallbackPath}
        showAccessDenied={options?.showAccessDenied}
        customAccessDeniedComponent={options?.customAccessDeniedComponent}
      >
        <Component {...(componentProps as T)} />
      </ProtectedRoute>
    );
  };
}

/**
 * Partner Portal Protected Route
 * Specifically for partner portal pages
 */
interface PartnerProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission: Permission;
  fallbackPath?: string;
  showAccessDenied?: boolean;
}

export function PartnerProtectedRoute({
  children,
  requiredPermission,
  fallbackPath = '/partner/dashboard',
  showAccessDenied = true
}: PartnerProtectedRouteProps) {
  // This would need to be imported from the partner auth hook
  // For now, we'll create a placeholder that can be updated
  const hasPermission = (permission: Permission): boolean => {
    // This should be replaced with actual partner auth hook
    console.warn('PartnerProtectedRoute: hasPermission not implemented');
    return true;
  };

  return (
    <ProtectedRoute
      hasPermission={hasPermission}
      requiredPermission={requiredPermission}
      fallbackPath={fallbackPath}
      showAccessDenied={showAccessDenied}
    >
      {children}
    </ProtectedRoute>
  );
}

/**
 * Whitelabel Portal Protected Route
 * Specifically for whitelabel portal pages
 */
interface WhitelabelProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission: Permission;
  fallbackPath?: string;
  showAccessDenied?: boolean;
}

export function WhitelabelProtectedRoute({
  children,
  requiredPermission,
  fallbackPath = '/whitelabel/dashboard',
  showAccessDenied = true
}: WhitelabelProtectedRouteProps) {
  // This would need to be imported from the customer auth hook
  // For now, we'll create a placeholder that can be updated
  const hasPermission = (permission: Permission): boolean => {
    // This should be replaced with actual customer auth hook
    console.warn('WhitelabelProtectedRoute: hasPermission not implemented');
    return true;
  };

  return (
    <ProtectedRoute
      hasPermission={hasPermission}
      requiredPermission={requiredPermission}
      fallbackPath={fallbackPath}
      showAccessDenied={showAccessDenied}
    >
      {children}
    </ProtectedRoute>
  );
}

export default ProtectedRoute;
