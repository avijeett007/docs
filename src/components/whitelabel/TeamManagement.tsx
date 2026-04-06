import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiMail, FiUser, FiUserCheck, FiAlertCircle, FiLoader } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { getThemeConfig, PortalTheme } from '@/lib/portalThemes';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Permission } from '@/lib/rbac';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  isDeleting?: boolean;
}

interface TeamManagementProps {
  customerId: string;
}

export default function TeamManagement({ customerId }: TeamManagementProps) {
  const { branding } = usePartnerBranding();
  const themeConfig = getThemeConfig((branding.themePreference as PortalTheme) || PortalTheme.MODERN);
  const { hasPermission, isTeamMember } = useCustomerAuth();

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'member'
  });
  const [maxTeamMembers, setMaxTeamMembers] = useState(0);
  const [isTeamMembersEnabled, setIsTeamMembersEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if user has permission to manage team (only applies to team members)
  const canManageTeam = hasPermission(Permission.MANAGE_TEAM);

  // Fetch team members and settings
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch team members
        const teamResponse = await fetch('/api/whitelabel/team-members');
        if (teamResponse.ok) {
          const teamData = await teamResponse.json();
          setTeamMembers(teamData.data || []);
        }

        // Fetch customer features to get team member settings
        const featuresResponse = await fetch('/api/whitelabel/customer/features');
        if (featuresResponse.ok) {
          const featuresData = await featuresResponse.json();
          console.log('Customer features data:', featuresData);
          setMaxTeamMembers(featuresData.maxTeamMembers || 0);
          setIsTeamMembersEnabled(featuresData.enableTeamMembers || false);

          // Log the team member settings
          console.log('Team member settings:', {
            maxTeamMembers: featuresData.maxTeamMembers,
            enableTeamMembers: featuresData.enableTeamMembers
          });
        }
      } catch (error) {
        console.error('Error fetching team data:', error);
        toast.error('Failed to load team information');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [customerId]);

  // Handle invite form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setInviteForm(prev => ({ ...prev, [name]: value }));
  };

  // Handle invite form submission
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isTeamMembersEnabled) {
      toast.error('Team members feature is not enabled for your account');
      return;
    }

    if (teamMembers.length >= maxTeamMembers) {
      toast.error(`You can only have up to ${maxTeamMembers} team members`);
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/whitelabel/team-members', {
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
      // Set loading state for this specific member
      setTeamMembers(prev =>
        prev.map(member =>
          member.id === id ? { ...member, isDeleting: true } : member
        )
      );

      const response = await fetch(`/api/whitelabel/team-members/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setTeamMembers(prev => prev.filter(member => member.id !== id));
        toast.success('Team member removed successfully');
      } else {
        // Reset loading state
        setTeamMembers(prev =>
          prev.map(member =>
            member.id === id ? { ...member, isDeleting: false } : member
          )
        );

        const error = await response.json();
        toast.error(error.message || 'Failed to remove team member');
      }
    } catch (error) {
      console.error('Error removing team member:', error);
      toast.error('An error occurred while removing the team member');

      // Reset loading state
      setTeamMembers(prev =>
        prev.map(member =>
          member.id === id ? { ...member, isDeleting: false } : member
        )
      );
    }
  };

  // Check if user has permission to access team management
  if (!canManageTeam) {
    return (
      <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-6`}
           style={{ borderColor: `${branding.primaryColor}40` }}>
        <h2 className="text-lg font-semibold mb-4">Team Management</h2>
        <div className="bg-gray-800/50 rounded-lg p-6 text-center">
          <FiAlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-white">Access Denied</h3>
          <p className="mt-2 text-gray-400">
            You don't have permission to access team management. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  if (!isTeamMembersEnabled) {
    return (
      <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-6`}
           style={{ borderColor: `${branding.primaryColor}40` }}>
        <h2 className="text-lg font-semibold mb-4">Team Management</h2>
        <div className="bg-gray-800/50 rounded-lg p-6 text-center">
          <FiAlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-white">Team Members Not Available</h3>
          <p className="mt-2 text-gray-400">
            The team members feature is not enabled for your account. Please contact your service provider to enable this feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-6`}
         style={{ borderColor: `${branding.primaryColor}40` }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Team Management</h2>
        <button
          onClick={() => setShowInviteModal(true)}
          disabled={teamMembers.length >= maxTeamMembers}
          className="flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: `${branding.primaryColor}20`,
            color: branding.primaryColor,
            opacity: teamMembers.length >= maxTeamMembers ? 0.5 : 1
          }}
        >
          <FiPlus className="mr-1" />
          Invite Member
        </button>
      </div>

      {teamMembers.length >= maxTeamMembers && (
        <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-800 rounded-lg flex items-center text-amber-400 text-sm">
          <FiAlertCircle className="mr-2 flex-shrink-0" />
          <span>You have reached your team member limit ({maxTeamMembers})</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <FiLoader className="animate-spin w-6 h-6 text-blue-500" />
        </div>
      ) : teamMembers.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-6 text-center">
          <FiUser className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-white">No team members yet</h3>
          <p className="mt-2 text-gray-400">
            Invite team members to collaborate with you on your account.
          </p>
          <button
            onClick={() => setShowInviteModal(true)}
            className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: `${branding.primaryColor}20`,
              color: branding.primaryColor
            }}
          >
            <FiPlus className="mr-2" />
            Invite Team Member
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead>
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {teamMembers.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">{member.name}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-300">{member.email}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-300 capitalize">{member.role}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      member.status === 'active' ? 'bg-green-100 text-green-800' :
                      member.status === 'pending' ? 'bg-yellow-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRemoveTeamMember(member.id)}
                      disabled={member.isDeleting}
                      className="text-red-500 hover:text-red-400 disabled:opacity-50"
                    >
                      {member.isDeleting ? (
                        <FiLoader className="h-5 w-5 animate-spin" />
                      ) : (
                        <FiTrash2 className="h-5 w-5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                  className="px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  {isSubmitting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
