'use client';

import React, { useState, useEffect } from 'react';
import { FiLoader, FiTrash2, FiKey, FiAlertCircle, FiUserCheck, FiUser } from 'react-icons/fi';
import { toast } from 'sonner';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  lastLogin?: string;
}

interface TeamMembersListProps {
  customerId: string;
}

export default function TeamMembersList({ customerId }: TeamMembersListProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamMembers();
  }, [customerId]);

  const fetchTeamMembers = async () => {
    if (!customerId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication token not found');
        return;
      }
      
      const response = await fetch(`/api/partner/customers/${customerId}/team-members`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch team members');
      }
      
      const data = await response.json();
      setTeamMembers(data.data || []);
    } catch (err) {
      console.error('Error fetching team members:', err);
      setError(err instanceof Error ? err.message : 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (teamMemberId: string) => {
    if (!confirm('Are you sure you want to reset this team member\'s password?')) {
      return;
    }
    
    setIsResettingPassword(teamMemberId);
    
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication token not found');
        return;
      }
      
      const response = await fetch(`/api/partner/customers/${customerId}/team-members/${teamMemberId}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset password');
      }
      
      toast.success('Password reset email sent successfully');
    } catch (err) {
      console.error('Error resetting password:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsResettingPassword(null);
    }
  };

  const handleDeleteTeamMember = async (teamMemberId: string) => {
    if (!confirm('Are you sure you want to delete this team member? This action cannot be undone.')) {
      return;
    }
    
    setIsDeleting(teamMemberId);
    
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication token not found');
        return;
      }
      
      const response = await fetch(`/api/partner/customers/${customerId}/team-members/${teamMemberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete team member');
      }
      
      // Remove the deleted team member from the state
      setTeamMembers(prev => prev.filter(member => member.id !== teamMemberId));
      toast.success('Team member deleted successfully');
    } catch (err) {
      console.error('Error deleting team member:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete team member');
    } finally {
      setIsDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-700/30 rounded-lg mt-4 flex justify-center items-center h-32">
        <FiLoader className="animate-spin w-6 h-6 text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-gray-700/30 rounded-lg mt-4 text-center">
        <FiAlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (teamMembers.length === 0) {
    return (
      <div className="p-4 bg-gray-700/30 rounded-lg mt-4 text-center">
        <FiUser className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        <p className="text-gray-400">No team members found for this customer</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-700/30 rounded-lg mt-4">
      <h5 className="text-md font-medium text-white mb-3">Team Members</h5>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead>
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Role
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {teamMembers.map((member) => (
              <tr key={member.id}>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="text-sm font-medium text-white">{member.name}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="text-sm text-gray-300">{member.email}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="text-sm text-gray-300 capitalize">{member.role}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    member.status === 'active' ? 'bg-green-100 text-green-800' :
                    member.status === 'pending' ? 'bg-yellow-100 text-amber-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {member.status}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handleResetPassword(member.id)}
                      disabled={isResettingPassword === member.id}
                      className="text-blue-500 hover:text-blue-400 disabled:opacity-50"
                      title="Reset password"
                    >
                      {isResettingPassword === member.id ? (
                        <FiLoader className="h-5 w-5 animate-spin" />
                      ) : (
                        <FiKey className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteTeamMember(member.id)}
                      disabled={isDeleting === member.id}
                      className="text-red-500 hover:text-red-400 disabled:opacity-50"
                      title="Delete team member"
                    >
                      {isDeleting === member.id ? (
                        <FiLoader className="h-5 w-5 animate-spin" />
                      ) : (
                        <FiTrash2 className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
