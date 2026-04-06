'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiMail, FiUser, FiUserCheck } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { useRouter } from 'next/navigation';
import { usePartnerAuth } from '@/hooks/usePartnerAuth';
import { Permission } from '@/lib/rbac';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function TeamManagementPage() {
  const router = useRouter();
  const { hasPermission } = usePartnerAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'member'
  });
  const [maxTeamMembers, setMaxTeamMembers] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partnerName, setPartnerName] = useState('Partner');

  // Free Forever Upgrade Modal state
  const [showFreeForeverUpgrade, setShowFreeForeverUpgrade] = useState(false);
  const [freeForeverUpgradeData, setFreeForeverUpgradeData] = useState({
    title: '',
    message: '',
    featureDescription: '',
  });

  // Fetch team members and partner info
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch partner info
        const partnerResponse = await fetch('/api/partner/profile');
        if (partnerResponse.ok) {
          const partnerData = await partnerResponse.json();
          setMaxTeamMembers(partnerData.data.maxTeamMembers || 2);
          setPartnerName(partnerData.data.businessName || 'Partner');
        }

        // Fetch team members
        const response = await fetch('/api/partner/team-members');
        if (response.ok) {
          const data = await response.json();
          setTeamMembers(data.data);
        } else {
          toast.error('Failed to fetch team members');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('An error occurred while fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle invite team member button click
  const handleInviteTeamMemberClick = async () => {
    try {
      // Check if user is on free forever plan first
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();

      if (shouldShowFreeForeverUpgrade) {
        // Show free forever upgrade modal
        const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('team_members');
        setFreeForeverUpgradeData(upgradeMessage);
        setShowFreeForeverUpgrade(true);
        return;
      }

      // Proceed with team member invitation
      setShowInviteModal(true);
    } catch (error) {
      console.error('Error checking team member access:', error);
      // Fallback: allow team member invitation if check fails
      setShowInviteModal(true);
    }
  };

  // Handle invite form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setInviteForm(prev => ({ ...prev, [name]: value }));
  };

  // Handle invite form submission
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (teamMembers.length >= maxTeamMembers) {
      toast.error(`You can only have up to ${maxTeamMembers} team members. Please upgrade your subscription to add more.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/partner/team-members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(inviteForm)
      });

      if (response.ok) {
        const data = await response.json();
        setTeamMembers(prev => [data.data, ...prev]);
        setInviteForm({
          name: '',
          email: '',
          role: 'member'
        });
        setShowInviteModal(false);
        toast.success('Team member invited successfully');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to invite team member');
      }
    } catch (error) {
      console.error('Error inviting team member:', error);
      toast.error('An error occurred while inviting the team member');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle team member removal
  const handleRemoveTeamMember = async (id: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    try {
      const response = await fetch(`/api/partner/team-members/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setTeamMembers(prev => prev.filter(member => member.id !== id));
        toast.success('Team member removed successfully');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to remove team member');
      }
    } catch (error) {
      console.error('Error removing team member:', error);
      toast.error('An error occurred while removing the team member');
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    router.push('/partner/login');
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute
      hasPermission={hasPermission}
      requiredPermission={Permission.MANAGE_TEAM}
      fallbackPath="/partner/dashboard"
    >
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Team Management</h1>
          <button
            onClick={handleInviteTeamMemberClick}
            disabled={teamMembers.length >= maxTeamMembers}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiPlus className="mr-2" />
            Invite Team Member
          </button>
        </div>

        {teamMembers.length >= maxTeamMembers && (
          <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
            <p className="text-amber-300">
              You have reached your team member limit ({maxTeamMembers}).
              Please upgrade your subscription to add more team members.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <FiUser className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-white">No team members yet</h3>
            <p className="mt-2 text-gray-400">
              Invite team members to collaborate with you on your Knotie AI account.
            </p>
            <button
              onClick={handleInviteTeamMemberClick}
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiPlus className="mr-2" />
              Invite Team Member
            </button>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {teamMembers.map((member) => (
                  <tr key={member.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{member.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">{member.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300 capitalize">{member.role}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.status === 'active' ? 'bg-green-100 text-green-800' :
                        member.status === 'pending' ? 'bg-yellow-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleRemoveTeamMember(member.id)}
                        className="text-red-500 hover:text-red-400"
                      >
                        <FiTrash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Invite Team Member</h2>
            <form onSubmit={handleInviteSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={inviteForm.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={inviteForm.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-1">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  value={inviteForm.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Free Forever Upgrade Modal */}
      <FreeForeverUpgradeModal
        isOpen={showFreeForeverUpgrade}
        onClose={() => setShowFreeForeverUpgrade(false)}
        title={freeForeverUpgradeData.title}
        message={freeForeverUpgradeData.message}
        featureDescription={freeForeverUpgradeData.featureDescription}
      />
      </PartnerLayout>
    </ProtectedRoute>
  );
}
