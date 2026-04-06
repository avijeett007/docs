/**
 * Role-Based Access Control (RBAC) System
 * 
 * This module defines roles, permissions, and utility functions for
 * controlling access to features in both partner and whitelabel portals.
 */

// Define available roles
export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin', 
  MEMBER = 'member'
}

// Define available permissions
export enum Permission {
  // Team management permissions
  MANAGE_TEAM = 'manage_team',
  VIEW_TEAM = 'view_team',
  
  // Settings permissions
  MANAGE_SETTINGS = 'manage_settings',
  VIEW_SETTINGS = 'view_settings',
  
  // Analytics permissions
  VIEW_ANALYTICS = 'view_analytics',
  VIEW_ADVANCED_ANALYTICS = 'view_advanced_analytics',
  
  // Agent management permissions
  MANAGE_AGENTS = 'manage_agents',
  VIEW_AGENTS = 'view_agents',
  
  // Customer management permissions (partner portal)
  MANAGE_CUSTOMERS = 'manage_customers',
  VIEW_CUSTOMERS = 'view_customers',
  
  // Billing permissions
  MANAGE_BILLING = 'manage_billing',
  VIEW_BILLING = 'view_billing',
  
  // Knowledge base permissions
  MANAGE_KNOWLEDGE_BASE = 'manage_knowledge_base',
  VIEW_KNOWLEDGE_BASE = 'view_knowledge_base',
  
  // Integration permissions
  MANAGE_INTEGRATIONS = 'manage_integrations',
  VIEW_INTEGRATIONS = 'view_integrations'
}

// Define role-permission mappings
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: [
    // Owners have all permissions
    Permission.MANAGE_TEAM,
    Permission.VIEW_TEAM,
    Permission.MANAGE_SETTINGS,
    Permission.VIEW_SETTINGS,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    Permission.MANAGE_AGENTS,
    Permission.VIEW_AGENTS,
    Permission.MANAGE_CUSTOMERS,
    Permission.VIEW_CUSTOMERS,
    Permission.MANAGE_BILLING,
    Permission.VIEW_BILLING,
    Permission.MANAGE_KNOWLEDGE_BASE,
    Permission.VIEW_KNOWLEDGE_BASE,
    Permission.MANAGE_INTEGRATIONS,
    Permission.VIEW_INTEGRATIONS
  ],
  
  [UserRole.ADMIN]: [
    // Admins have all permissions (same as owner for now)
    Permission.MANAGE_TEAM,
    Permission.VIEW_TEAM,
    Permission.MANAGE_SETTINGS,
    Permission.VIEW_SETTINGS,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    Permission.MANAGE_AGENTS,
    Permission.VIEW_AGENTS,
    Permission.MANAGE_CUSTOMERS,
    Permission.VIEW_CUSTOMERS,
    Permission.MANAGE_BILLING,
    Permission.VIEW_BILLING,
    Permission.MANAGE_KNOWLEDGE_BASE,
    Permission.VIEW_KNOWLEDGE_BASE,
    Permission.MANAGE_INTEGRATIONS,
    Permission.VIEW_INTEGRATIONS
  ],
  
  [UserRole.MEMBER]: [
    // Members have limited permissions - no team or settings management
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_AGENTS,
    Permission.VIEW_AGENTS,
    Permission.VIEW_CUSTOMERS,
    Permission.VIEW_BILLING,
    Permission.MANAGE_KNOWLEDGE_BASE,
    Permission.VIEW_KNOWLEDGE_BASE,
    Permission.MANAGE_INTEGRATIONS,
    Permission.VIEW_INTEGRATIONS
  ]
};

/**
 * Check if a role has a specific permission
 * Root account owners (non-team members) always have all permissions
 */
export function hasPermission(role: string | undefined | null, permission: Permission, isTeamMember: boolean = false): boolean {
  // Root account owners (non-team members) have all permissions
  if (!isTeamMember) {
    return true;
  }

  // Team members are subject to role-based restrictions
  if (!role) return false;

  // Normalize role to enum value
  const userRole = role.toLowerCase() as UserRole;

  // If role is not recognized, default to member permissions
  if (!Object.values(UserRole).includes(userRole)) {
    return ROLE_PERMISSIONS[UserRole.MEMBER].includes(permission);
  }

  return ROLE_PERMISSIONS[userRole].includes(permission);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: string | undefined | null, permissions: Permission[], isTeamMember: boolean = false): boolean {
  return permissions.some(permission => hasPermission(role, permission, isTeamMember));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: string | undefined | null, permissions: Permission[], isTeamMember: boolean = false): boolean {
  return permissions.every(permission => hasPermission(role, permission, isTeamMember));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: string | undefined | null): Permission[] {
  if (!role) return [];
  
  const userRole = role.toLowerCase() as UserRole;
  
  if (!Object.values(UserRole).includes(userRole)) {
    return ROLE_PERMISSIONS[UserRole.MEMBER];
  }
  
  return ROLE_PERMISSIONS[userRole];
}

/**
 * Check if a role is admin or higher (owner/admin)
 * Root account owners (non-team members) are always considered admin or higher
 */
export function isAdminOrHigher(role: string | undefined | null, isTeamMember: boolean = false): boolean {
  // Root account owners (non-team members) are always admin or higher
  if (!isTeamMember) {
    return true;
  }

  // Team members are subject to role-based restrictions
  if (!role) return false;

  const userRole = role.toLowerCase() as UserRole;
  return userRole === UserRole.ADMIN || userRole === UserRole.OWNER;
}

/**
 * Check if a role is owner
 */
export function isOwner(role: string | undefined | null): boolean {
  if (!role) return false;
  
  const userRole = role.toLowerCase() as UserRole;
  return userRole === UserRole.OWNER;
}

/**
 * Check if a role is member
 * Root account owners (non-team members) are never considered just members
 */
export function isMember(role: string | undefined | null, isTeamMember: boolean = false): boolean {
  // Root account owners (non-team members) are never just members
  if (!isTeamMember) {
    return false;
  }

  // Team members are subject to role-based restrictions
  if (!role) return true; // Default to member if no role

  const userRole = role.toLowerCase() as UserRole;
  return userRole === UserRole.MEMBER;
}

/**
 * Get user-friendly role name
 */
export function getRoleDisplayName(role: string | undefined | null): string {
  if (!role) return 'Member';
  
  const userRole = role.toLowerCase() as UserRole;
  
  switch (userRole) {
    case UserRole.OWNER:
      return 'Owner';
    case UserRole.ADMIN:
      return 'Admin';
    case UserRole.MEMBER:
      return 'Member';
    default:
      return 'Member';
  }
}

/**
 * Utility type for components that need role checking
 */
export interface RoleAware {
  role?: string | null;
}

/**
 * Permission constants for easy reference
 */
export const PERMISSIONS = Permission;
export const ROLES = UserRole;
