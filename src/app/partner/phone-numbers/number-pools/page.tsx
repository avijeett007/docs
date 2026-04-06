'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  FiPlus,
  FiLayers,
  FiSearch,
  FiX,
  FiTrash2,
  FiSave,
  FiEdit2,
  FiLock,
  FiRefreshCw,
} from 'react-icons/fi';
import PartnerLayout from '@/components/partner/PartnerLayout';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';

type PoolLimitInfo = {
  allowed: boolean;
  currentCount: number;
  limit: number | null;
  remaining: number | null;
  message?: string;
};

type PoolPhoneNumber = {
  id: string;
  phoneNumber: string;
  friendlyName?: string | null;
  provider: string;
  status: string;
  assignedAt?: string;
};

type NumberPool = {
  id: string;
  name: string;
  description?: string | null;
  campaignId?: string | null;
  createdAt: string;
  updatedAt: string;
  phoneNumberCount: number;
  phoneNumbers: PoolPhoneNumber[];
};

type ManagePhoneNumberOption = {
  id: string;
  phoneNumber: string;
  friendlyName?: string | null;
  provider: string;
  status: string;
  assignedToThisPool: boolean;
};

type CreatePhoneNumberOption = {
  id: string;
  phoneNumber: string;
  friendlyName?: string | null;
  provider: string;
  status: string;
};

const defaultUpgradeData = {
  title: '',
  message: '',
  featureDescription: '',
};

export default function NumberPoolsPage() {
  const router = useRouter();

  const [partnerName, setPartnerName] = useState('Partner');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [pools, setPools] = useState<NumberPool[]>([]);
  const [limitInfo, setLimitInfo] = useState<PoolLimitInfo | null>(null);
  const [isFreeForeverPartner, setIsFreeForeverPartner] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingPool, setCreatingPool] = useState(false);
  const [createPoolName, setCreatePoolName] = useState('');
  const [createPoolDescription, setCreatePoolDescription] = useState('');
  const [createSearchTerm, setCreateSearchTerm] = useState('');
  const [createPhoneNumbersLoading, setCreatePhoneNumbersLoading] = useState(false);
  const [createPhoneNumbers, setCreatePhoneNumbers] = useState<CreatePhoneNumberOption[]>([]);
  const [selectedPhoneNumberIds, setSelectedPhoneNumberIds] = useState<Set<string>>(new Set());

  const [selectedPool, setSelectedPool] = useState<NumberPool | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageName, setManageName] = useState('');
  const [manageDescription, setManageDescription] = useState('');
  const [manageSearchTerm, setManageSearchTerm] = useState('');
  const [manageLoading, setManageLoading] = useState(false);
  const [savingManageChanges, setSavingManageChanges] = useState(false);
  const [deletingPool, setDeletingPool] = useState(false);
  const [managePhoneNumbers, setManagePhoneNumbers] = useState<ManagePhoneNumberOption[]>([]);
  const [initialAssignedIds, setInitialAssignedIds] = useState<Set<string>>(new Set());
  const [currentAssignedIds, setCurrentAssignedIds] = useState<Set<string>>(new Set());

  const [showFreeForeverUpgrade, setShowFreeForeverUpgrade] = useState(false);
  const [freeForeverUpgradeData, setFreeForeverUpgradeData] = useState(defaultUpgradeData);

  const initializePage = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadPools(), loadPartnerTierState()]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }

    const storedPartnerName = localStorage.getItem('partner_name');
    if (storedPartnerName) {
      setPartnerName(storedPartnerName);
    }

    void initializePage();
  }, [initializePage, router]);

  const loadPartnerTierState = async () => {
    try {
      const freeForever = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();
      setIsFreeForeverPartner(freeForever);
    } catch {
      setIsFreeForeverPartner(false);
    }
  };

  const loadPools = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/number-pools', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch number pools');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch number pools');
      }

      setPools(data.data?.pools || []);
      setLimitInfo(data.data?.limitInfo || null);
    } catch (error) {
      toast.error('Failed to load number pools');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadPools(), loadPartnerTierState()]);
    } finally {
      setRefreshing(false);
    }
  };

  const loadCreatePhoneNumbers = async () => {
    try {
      setCreatePhoneNumbersLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/phone-numbers?page=1&limit=500&search=&provider=all&status=all&assignment=all&ownership=all&customerId=all', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load phone numbers');
      }

      const data = await response.json();
      const numbers = (data.phoneNumbers || []).map((number: any) => ({
        id: number.id,
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        provider: number.provider,
        status: number.status,
      }));

      setCreatePhoneNumbers(numbers);
    } catch {
      toast.error('Failed to load phone numbers');
    } finally {
      setCreatePhoneNumbersLoading(false);
    }
  };

  const createModalFilteredNumbers = useMemo(() => {
    const term = createSearchTerm.trim().toLowerCase();
    if (!term) return createPhoneNumbers;

    return createPhoneNumbers.filter((number) =>
      number.phoneNumber.toLowerCase().includes(term) ||
      (number.friendlyName || '').toLowerCase().includes(term)
    );
  }, [createPhoneNumbers, createSearchTerm]);

  const manageModalFilteredNumbers = useMemo(() => {
    const term = manageSearchTerm.trim().toLowerCase();
    if (!term) return managePhoneNumbers;

    return managePhoneNumbers.filter((number) =>
      number.phoneNumber.toLowerCase().includes(term) ||
      (number.friendlyName || '').toLowerCase().includes(term)
    );
  }, [managePhoneNumbers, manageSearchTerm]);

  const openCreateModal = async () => {
    if (isFreeForeverPartner) {
      const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('number_pools');
      setFreeForeverUpgradeData(upgradeMessage);
      setShowFreeForeverUpgrade(true);
      return;
    }

    if (limitInfo?.limit !== null && typeof limitInfo?.remaining === 'number' && limitInfo.remaining <= 0) {
      toast.error(limitInfo.message || 'Number pool limit reached');
      return;
    }

    setCreatePoolName('');
    setCreatePoolDescription('');
    setCreateSearchTerm('');
    setSelectedPhoneNumberIds(new Set());
    setShowCreateModal(true);
    await loadCreatePhoneNumbers();
  };

  const closeCreateModal = () => {
    if (creatingPool) return;
    setShowCreateModal(false);
  };

  const toggleCreateSelection = (phoneNumberId: string) => {
    setSelectedPhoneNumberIds((prev) => {
      const next = new Set(prev);
      if (next.has(phoneNumberId)) {
        next.delete(phoneNumberId);
      } else {
        next.add(phoneNumberId);
      }
      return next;
    });
  };

  const handleCreatePool = async () => {
    const trimmedName = createPoolName.trim();
    if (!trimmedName) {
      toast.error('Pool name is required');
      return;
    }

    try {
      setCreatingPool(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/partner/number-pools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: trimmedName,
          description: createPoolDescription || null,
          phoneNumberIds: Array.from(selectedPhoneNumberIds),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 403 && data.code === 'NUMBER_POOL_LIMIT_REACHED') {
          toast.error(data.error || 'Number pool limit reached');
          await loadPools();
          setShowCreateModal(false);
          return;
        }

        toast.error(data.error || 'Failed to create number pool');
        return;
      }

      toast.success('Number pool created successfully');
      setShowCreateModal(false);
      await loadPools();
    } catch {
      toast.error('Failed to create number pool');
    } finally {
      setCreatingPool(false);
    }
  };

  const openManageModal = async (pool: NumberPool) => {
    setSelectedPool(pool);
    setManageName(pool.name);
    setManageDescription(pool.description || '');
    setManageSearchTerm('');
    setShowManageModal(true);
    await loadManagePool(pool.id);
  };

  const closeManageModal = () => {
    if (savingManageChanges || deletingPool) return;
    setShowManageModal(false);
    setSelectedPool(null);
    setManagePhoneNumbers([]);
    setInitialAssignedIds(new Set());
    setCurrentAssignedIds(new Set());
  };

  const loadManagePool = async (poolId: string) => {
    try {
      setManageLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/number-pools/${poolId}/phone-numbers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load number pool details');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load number pool details');
      }

      const allNumbers = data.data?.allPhoneNumbers || [];
      const assignedIds = new Set<string>(
        allNumbers.filter((number: ManagePhoneNumberOption) => number.assignedToThisPool).map((number: ManagePhoneNumberOption) => number.id)
      );

      setManagePhoneNumbers(allNumbers);
      setInitialAssignedIds(assignedIds);
      setCurrentAssignedIds(new Set(assignedIds));
    } catch {
      toast.error('Failed to load number pool details');
    } finally {
      setManageLoading(false);
    }
  };

  const toggleManageSelection = (phoneNumberId: string) => {
    setCurrentAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(phoneNumberId)) {
        next.delete(phoneNumberId);
      } else {
        next.add(phoneNumberId);
      }
      return next;
    });
  };

  const saveManageChanges = async () => {
    if (!selectedPool) return;

    const nextName = manageName.trim();
    if (!nextName) {
      toast.error('Pool name is required');
      return;
    }

    const adds = Array.from(currentAssignedIds).filter((id) => !initialAssignedIds.has(id));
    const removes = Array.from(initialAssignedIds).filter((id) => !currentAssignedIds.has(id));
    const needsMetaUpdate = nextName !== selectedPool.name || (manageDescription || '') !== (selectedPool.description || '');

    if (!needsMetaUpdate && adds.length === 0 && removes.length === 0) {
      toast('No changes to save');
      return;
    }

    try {
      setSavingManageChanges(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const requests: Promise<Response>[] = [];

      if (needsMetaUpdate) {
        requests.push(
          fetch(`/api/partner/number-pools/${selectedPool.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: nextName,
              description: manageDescription || null,
            }),
          })
        );
      }

      if (adds.length > 0) {
        requests.push(
          fetch(`/api/partner/number-pools/${selectedPool.id}/phone-numbers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ phoneNumberIds: adds }),
          })
        );
      }

      if (removes.length > 0) {
        requests.push(
          fetch(`/api/partner/number-pools/${selectedPool.id}/phone-numbers`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ phoneNumberIds: removes }),
          })
        );
      }

      const responses = await Promise.all(requests);
      const failedResponse = responses.find((response) => !response.ok);

      if (failedResponse) {
        const failedData = await failedResponse.json().catch(() => null);
        throw new Error(failedData?.error || 'Failed to save number pool changes');
      }

      toast.success('Number pool updated successfully');
      closeManageModal();
      await loadPools();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save number pool changes');
    } finally {
      setSavingManageChanges(false);
    }
  };

  const deleteSelectedPool = async () => {
    if (!selectedPool) return;

    const confirmed = window.confirm(`Delete number pool "${selectedPool.name}"? This removes all pool mappings.`);
    if (!confirmed) return;

    try {
      setDeletingPool(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/number-pools/${selectedPool.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete number pool');
      }

      toast.success('Number pool deleted successfully');
      closeManageModal();
      await loadPools();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete number pool');
    } finally {
      setDeletingPool(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  const poolUsageLabel = useMemo(() => {
    if (!limitInfo) return 'Loading limits...';
    if (limitInfo.limit === null) return `${limitInfo.currentCount} pools (unlimited plan)`;
    return `${limitInfo.currentCount}/${limitInfo.limit} pools used`;
  }, [limitInfo]);

  if (loading) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-300">Loading number pools...</span>
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Number Pool</h1>
            <p className="text-gray-400">Group phone numbers into reusable pools for campaign routing.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              disabled={refreshing}
            >
              <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiPlus />
              Create Number Pool
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-xs text-gray-400">Pool Usage</p>
            <p className="text-lg font-semibold text-white mt-1">{poolUsageLabel}</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-xs text-gray-400">Total Pools</p>
            <p className="text-lg font-semibold text-white mt-1">{pools.length}</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-xs text-gray-400">Mapped Numbers</p>
            <p className="text-lg font-semibold text-white mt-1">
              {pools.reduce((sum, pool) => sum + pool.phoneNumberCount, 0)}
            </p>
          </div>
        </div>

        {isFreeForeverPartner && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
            <FiLock className="text-amber-400 w-5 h-5 mt-0.5" />
            <div>
              <p className="text-amber-200 font-medium">Number Pool is a paid-plan feature</p>
              <p className="text-amber-300/80 text-sm mt-1">
                Free Forever partners can preview this section. Click <strong>Create Number Pool</strong> to book a call and upgrade.
              </p>
            </div>
          </div>
        )}

        <div className="bg-gray-800/50 rounded-xl overflow-hidden">
          {pools.length === 0 ? (
            <div className="py-16 px-8 text-center">
              <FiLayers className="w-14 h-14 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Number Pools yet</h3>
              <p className="text-gray-400 mb-6">Create your first pool to organize numbers for upcoming campaign routing.</p>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FiPlus />
                Create Number Pool
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {pools.map((pool) => (
                <div key={pool.id} className="p-5 hover:bg-gray-700/25 transition-colors">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-white font-semibold text-lg">{pool.name}</h3>
                      <p className="text-gray-400 text-sm mt-1">{pool.description || 'No description'}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                        <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                          {pool.phoneNumberCount} numbers
                        </span>
                        <span className="px-2 py-1 rounded-full bg-gray-700 text-gray-300">
                          Created {new Date(pool.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => openManageModal(pool)}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      <FiEdit2 />
                      Manage Pool
                    </button>
                  </div>

                  {pool.phoneNumbers.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pool.phoneNumbers.slice(0, 6).map((number) => (
                        <span key={number.id} className="px-2 py-1 rounded bg-gray-900 text-gray-300 text-xs">
                          {number.phoneNumber}
                        </span>
                      ))}
                      {pool.phoneNumbers.length > 6 && (
                        <span className="px-2 py-1 rounded bg-gray-900 text-gray-400 text-xs">
                          +{pool.phoneNumbers.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-white text-lg font-semibold">Create Number Pool</h2>
              <button onClick={closeCreateModal} className="text-gray-400 hover:text-white">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Pool Name</label>
                  <input
                    value={createPoolName}
                    onChange={(e) => setCreatePoolName(e.target.value)}
                    placeholder="e.g. Weekend Support"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Description (optional)</label>
                  <input
                    value={createPoolDescription}
                    onChange={(e) => setCreatePoolDescription(e.target.value)}
                    placeholder="Short summary for this pool"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-gray-800/60 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-200">Assign to Campaign (Coming Soon)</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      A number pool can be assigned to only one campaign. Campaign assignment will be enabled once campaign feature is completed.
                    </p>
                  </div>
                  <FiLock className="text-gray-500" />
                </div>
                <select disabled className="mt-3 w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed">
                  <option>Campaign integration is disabled</option>
                </select>
              </div>

              <div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                  <h3 className="text-sm font-medium text-gray-200">Select Phone Numbers</h3>
                  <div className="relative w-full md:w-64">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      value={createSearchTerm}
                      onChange={(e) => setCreateSearchTerm(e.target.value)}
                      placeholder="Search numbers"
                      className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                    />
                  </div>
                </div>

                <div className="border border-gray-800 rounded-lg overflow-hidden">
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-800">
                    {createPhoneNumbersLoading ? (
                      <div className="p-6 text-center text-gray-400">Loading phone numbers...</div>
                    ) : createModalFilteredNumbers.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">No phone numbers found</div>
                    ) : (
                      createModalFilteredNumbers.map((number) => {
                        const isSelected = selectedPhoneNumberIds.has(number.id);
                        return (
                          <label key={number.id} className="flex items-center gap-3 p-3 hover:bg-gray-800/60 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCreateSelection(number.id)}
                              className="rounded border-gray-600 bg-gray-900 text-blue-500"
                            />
                            <div className="flex-1">
                              <p className="text-white text-sm">{number.phoneNumber}</p>
                              <p className="text-gray-500 text-xs">
                                {number.friendlyName || 'No friendly name'} • {number.provider}
                              </p>
                            </div>
                            <span className="text-xs text-gray-500">{number.status}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-400">
                  {selectedPhoneNumberIds.size} number(s) selected
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-2">
              <button
                onClick={closeCreateModal}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
                disabled={creatingPool}
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePool}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={creatingPool}
              >
                {creatingPool ? <FiRefreshCw className="animate-spin" /> : <FiSave />}
                {creatingPool ? 'Creating...' : 'Create Pool'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showManageModal && selectedPool && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-white text-lg font-semibold">Manage Number Pool</h2>
              <button onClick={closeManageModal} className="text-gray-400 hover:text-white">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {manageLoading ? (
                <div className="py-12 text-center text-gray-400">Loading pool details...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Pool Name</label>
                      <input
                        value={manageName}
                        onChange={(e) => setManageName(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Description</label>
                      <input
                        value={manageDescription}
                        onChange={(e) => setManageDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-gray-800/60 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-200">Assign to Campaign (Coming Soon)</h3>
                        <p className="text-xs text-gray-400 mt-1">One number pool can be assigned to one campaign once campaign feature ships.</p>
                      </div>
                      <FiLock className="text-gray-500" />
                    </div>
                    <select disabled className="mt-3 w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed">
                      <option>Campaign integration is disabled</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                      <h3 className="text-sm font-medium text-gray-200">Pool Membership</h3>
                      <div className="relative w-full md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          value={manageSearchTerm}
                          onChange={(e) => setManageSearchTerm(e.target.value)}
                          placeholder="Search numbers"
                          className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                        />
                      </div>
                    </div>

                    <div className="border border-gray-800 rounded-lg overflow-hidden">
                      <div className="max-h-72 overflow-y-auto divide-y divide-gray-800">
                        {manageModalFilteredNumbers.length === 0 ? (
                          <div className="p-6 text-center text-gray-500">No phone numbers found</div>
                        ) : (
                          manageModalFilteredNumbers.map((number) => {
                            const assigned = currentAssignedIds.has(number.id);
                            return (
                              <label key={number.id} className="flex items-center gap-3 p-3 hover:bg-gray-800/60 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={assigned}
                                  onChange={() => toggleManageSelection(number.id)}
                                  className="rounded border-gray-600 bg-gray-900 text-blue-500"
                                />
                                <div className="flex-1">
                                  <p className="text-white text-sm">{number.phoneNumber}</p>
                                  <p className="text-gray-500 text-xs">
                                    {number.friendlyName || 'No friendly name'} • {number.provider}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">{number.status}</p>
                                  {number.assignedToThisPool && (
                                    <p className="text-[11px] text-green-400">Currently assigned</p>
                                  )}
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-400 flex items-center gap-3">
                      <span>{currentAssignedIds.size} number(s) selected in this pool</span>
                      <span className="text-gray-600">•</span>
                      <span>{Math.max(0, Array.from(currentAssignedIds).filter((id) => !initialAssignedIds.has(id)).length)} to add</span>
                      <span>{Math.max(0, Array.from(initialAssignedIds).filter((id) => !currentAssignedIds.has(id)).length)} to remove</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-800 flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-between">
              <button
                onClick={deleteSelectedPool}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                disabled={savingManageChanges || deletingPool || manageLoading}
              >
                {deletingPool ? <FiRefreshCw className="animate-spin" /> : <FiTrash2 />}
                Delete Pool
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={closeManageModal}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
                  disabled={savingManageChanges || deletingPool}
                >
                  Cancel
                </button>
                <button
                  onClick={saveManageChanges}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  disabled={savingManageChanges || deletingPool || manageLoading}
                >
                  {savingManageChanges ? <FiRefreshCw className="animate-spin" /> : <FiSave />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FreeForeverUpgradeModal
        isOpen={showFreeForeverUpgrade}
        onClose={() => setShowFreeForeverUpgrade(false)}
        title={freeForeverUpgradeData.title}
        message={freeForeverUpgradeData.message}
        featureDescription={freeForeverUpgradeData.featureDescription}
      />
    </PartnerLayout>
  );
}
