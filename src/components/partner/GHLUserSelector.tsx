import React, { useState, useEffect } from 'react';
import { FiUser, FiLoader, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface GHLUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  role?: string;
}

interface GHLUserSelectorProps {
  customerId: string;
  selectedUserId?: string;
  onUserSelect: (userId: string, userName: string) => void;
  disabled?: boolean;
}

export const GHLUserSelector: React.FC<GHLUserSelectorProps> = ({
  customerId,
  selectedUserId,
  onUserSelect,
  disabled = false
}) => {
  const [users, setUsers] = useState<GHLUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customerId) {
      loadGHLUsers();
    }
  }, [customerId]);

  const loadGHLUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/partner/customers/${customerId}/ghl/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load GHL users');
      }

      const data = await response.json();
      setUsers(data.users || []);

    } catch (error: any) {
      console.error('Failed to load GHL users:', error);
      setError(error.message);
      toast.error('Failed to load GHL staff users');
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      onUserSelect(userId, user.name);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">
          Select Staff Member
        </label>
        <div className="flex items-center space-x-2 p-3 bg-gray-700/50 rounded-lg">
          <FiLoader className="h-4 w-4 animate-spin text-blue-400" />
          <span className="text-sm text-gray-400">Loading staff members...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">
          Select Staff Member
        </label>
        <div className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <FiAlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
          <button
            onClick={loadGHLUsers}
            className="ml-auto text-xs text-blue-400 hover:text-blue-300"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">
        Select Staff Member
      </label>

      <div className="relative">
        <select
          value={selectedUserId || ''}
          onChange={(e) => handleUserChange(e.target.value)}
          disabled={disabled || users.length === 0}
          className="w-full px-3 py-2 pl-10 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Choose a staff member...</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} {user.email ? `(${user.email})` : ''}
            </option>
          ))}
        </select>

        <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>

      {users.length === 0 && !loading && (
        <p className="text-xs text-gray-500">
          No staff members found. Make sure your GHL integration is properly connected.
        </p>
      )}

      {selectedUserId && (
        <div className="text-xs text-green-400">
          ✓ Staff member selected: {users.find(u => u.id === selectedUserId)?.name}
        </div>
      )}
    </div>
  );
};

