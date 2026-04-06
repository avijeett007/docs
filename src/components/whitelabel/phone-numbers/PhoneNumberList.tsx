'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoreVertical, Upload, Phone, FileText, CheckCircle, AlertCircle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentUploadModal } from './DocumentUploadModal';
import { ReleaseConfirmationModal } from './ReleaseConfirmationModal';
import BusinessVerificationModal from './BusinessVerificationModal';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string;
  countryCode: string;
  region?: string;
  locality?: string;
  type: string;
  status: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
  };
  monthlyRecurringCost: number;
  regulatoryStatus: string;
  verificationStatus: string;
  isImported: boolean;
  activeAgents: number;
  approvedDocuments: number;
  purchasedAt: string;
  createdAt: string;
  releasedAt?: string;
  connectedAgent?: {
    agentName: string | null;
    agentProvider: string;
    agentId: string;
  } | null;
}

export function PhoneNumberList() {
  const { branding } = usePartnerBranding();
  const themeConfig = branding?.themePreference ? getThemeConfig(branding.themePreference as PortalTheme) : getThemeConfig(PortalTheme.MODERN);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [phoneToRelease, setPhoneToRelease] = useState<{ id: string; number: string } | null>(null);
  const [uploadingDocuments, setUploadingDocuments] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [retryingPurchase, setRetryingPurchase] = useState<string | null>(null);
  const [removingNumber, setRemovingNumber] = useState<string | null>(null);
  const [showBusinessVerification, setShowBusinessVerification] = useState(false);
  const [pendingRetryNumber, setPendingRetryNumber] = useState<PhoneNumber | null>(null);

  useEffect(() => {
    fetchPhoneNumbers();
  }, []);

  // Cleanup function to reset all modal states
  useEffect(() => {
    return () => {
      resetAllStates();
    };
  }, []);

  const fetchPhoneNumbers = async () => {
    try {
      const response = await fetch('/api/whitelabel/phone-numbers');
      if (!response.ok) throw new Error('Failed to fetch phone numbers');
      
      const data = await response.json();
      setPhoneNumbers(data.data.phoneNumbers);
    } catch (error) {
      console.error('Error fetching phone numbers:', error);
      toast.error('Failed to load phone numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = (phoneId: string) => {
    setSelectedPhoneId(phoneId);
    setUploadingDocuments(phoneId);
    setShowUploadModal(true);
    setOpenDropdown(null); // Close dropdown
  };

  const handleReleaseNumber = (phoneId: string, phoneNumber: string) => {
    setPhoneToRelease({ id: phoneId, number: phoneNumber });
    setShowReleaseModal(true);
    setOpenDropdown(null); // Close dropdown
  };

  const confirmReleaseNumber = async () => {
    if (!phoneToRelease) return;

    setReleasing(phoneToRelease.id);
    try {
      const response = await fetch(`/api/phone-numbers/${phoneToRelease.id}/release`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to release phone number');
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Phone number released successfully');
        // Update the phone number status in local state instead of removing it
        setPhoneNumbers(prev => prev.map(p =>
          p.id === phoneToRelease.id
            ? { ...p, status: 'released', releasedAt: new Date().toISOString() }
            : p
        ));
      } else {
        toast.error(result.error || 'Failed to release phone number');
      }
    } catch (error) {
      console.error('Error releasing phone number:', error);
      toast.error('Failed to release phone number. Please try again.');
    } finally {
      setReleasing(null);
      setPhoneToRelease(null);
      setShowReleaseModal(false); // Close the modal
    }
  };

  const getStatusBadge = (status: string, isImported?: boolean) => {
    const statusConfig = {
      active: { label: 'Active', variant: 'default' as const, icon: CheckCircle },
      pending: {
        label: isImported ? 'Setup Pending' : 'Purchase Incomplete',
        variant: 'outline' as const,
        icon: AlertCircle
      },
      failed: {
        label: isImported ? 'Setup Failed' : 'Purchase Failed',
        variant: 'destructive' as const,
        icon: XCircle
      },
      suspended: { label: 'Suspended', variant: 'destructive' as const, icon: XCircle },
      released: { label: 'Released', variant: 'secondary' as const, icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const hasAvailableActions = (phoneNumber: PhoneNumber) => {
    // Active numbers have upload and release actions
    if (phoneNumber.status === 'active') return true;
    // Pending numbers have retry/complete/remove actions
    if (phoneNumber.status === 'pending') return true;
    // Failed numbers have retry/remove actions
    if (phoneNumber.status === 'failed') return true;
    // Other statuses only show informational items
    return phoneNumber.status === 'released' || phoneNumber.status === 'suspended';
  };

  const handleRetryPurchase = async (phoneId: string, phoneNumber: string) => {
    setOpenDropdown(null);

    // Get the phone number details to retry purchase
    const phoneRecord = phoneNumbers.find(p => p.id === phoneId);
    if (!phoneRecord) {
      toast.error('Phone number not found');
      return;
    }

    // Check if business verification is needed
    try {
      const response = await fetch(`/api/phone-numbers/bundle?phoneNumber=${encodeURIComponent(phoneRecord.phoneNumber)}&numberType=${phoneRecord.type}`);
      const result = await response.json();

      if (result.skipVerification) {
        // No verification required - proceed directly with retry
        toast.info('No business verification required. Proceeding with purchase...');
      } else if (result.success && result.requiresBundle && !result.hasBundle) {
        // Bundle required but customer doesn't have one - show verification modal
        setPendingRetryNumber(phoneRecord);
        setShowBusinessVerification(true);
        toast.info('Business address verification is required to complete this purchase.');
        return;
      } else if (result.success && result.hasBundle && !result.bundle.canPurchase) {
        // Bundle exists but not approved yet
        toast.warning('Your business verification is still being reviewed. Please wait for approval before completing this purchase.');
        return;
      }
    } catch (error) {
      console.error('Error checking bundle status:', error);
      // Continue with retry if bundle check fails
    }

    // If no bundle needed or bundle is approved, attempt to retry purchase
    setRetryingPurchase(phoneId);

    try {
      const response = await fetch(`/api/phone-numbers/${phoneId}/retry-purchase`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Purchase completed successfully!');
        fetchPhoneNumbers(); // Refresh the list
      } else {
        toast.error(result.error || 'Failed to complete purchase. Please try again.');
      }
    } catch (error) {
      console.error('Error retrying purchase:', error);
      toast.error('Failed to retry purchase. Please try again.');
    } finally {
      setRetryingPurchase(null);
    }
  };

  const handleRemoveNumber = async (phoneId: string, phoneNumber: string) => {
    setRemovingNumber(phoneId);
    setOpenDropdown(null);

    try {
      const response = await fetch(`/api/phone-numbers/${phoneId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove phone number');
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Phone number removed successfully');
        // Remove from local state
        setPhoneNumbers(prev => prev.filter(p => p.id !== phoneId));
      } else {
        toast.error(result.error || 'Failed to remove phone number');
      }
    } catch (error) {
      console.error('Error removing phone number:', error);
      toast.error('Failed to remove phone number. Please try again.');
    } finally {
      setRemovingNumber(null);
    }
  };

  const resetAllStates = () => {
    setShowUploadModal(false);
    setSelectedPhoneId(null);
    setUploadingDocuments(null);
    setShowReleaseModal(false);
    setPhoneToRelease(null);
    setReleasing(null);
    setOpenDropdown(null);
    setRetryingPurchase(null);
    setRemovingNumber(null);
    setShowBusinessVerification(false);
    setPendingRetryNumber(null);
  };

  const getRegulatoryStatusBadge = (status: string) => {
    const statusConfig = {
      approved: { label: 'Verified', variant: 'default' as const },
      pending: { label: 'Pending Verification', variant: 'outline' as const },
      rejected: { label: 'Rejected', variant: 'destructive' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatPhoneType = (type: string) => {
    return type.replace('_', ' ').split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Customer-friendly status display
  const getCustomerFriendlyStatus = (phoneNumber: PhoneNumber) => {
    // If connected to an agent
    if (phoneNumber.connectedAgent) {
      const agentName = phoneNumber.connectedAgent.agentName || 'AI Agent';
      return {
        status: `Connected to ${agentName}`,
        color: 'text-green-400',
        icon: <CheckCircle className="h-4 w-4 text-green-400" />,
        description: 'This number is handling calls with your AI agent'
      };
    }

    // If ready but not connected
    if (phoneNumber.status === 'active' && phoneNumber.regulatoryStatus === 'approved') {
      return {
        status: 'Ready for Calls',
        color: 'text-blue-400',
        icon: <Phone className="h-4 w-4 text-blue-400" />,
        description: 'This number is ready to be connected to an AI agent'
      };
    }

    // If setting up
    if (phoneNumber.status === 'pending' || phoneNumber.regulatoryStatus === 'pending') {
      return {
        status: 'Setting Up',
        color: 'text-yellow-400',
        icon: <RefreshCw className="h-4 w-4 text-yellow-400" />,
        description: 'This number is being configured and will be ready soon'
      };
    }

    // If there's an issue
    if (phoneNumber.status === 'failed' || phoneNumber.regulatoryStatus === 'rejected') {
      return {
        status: 'Needs Attention',
        color: 'text-red-400',
        icon: <AlertCircle className="h-4 w-4 text-red-400" />,
        description: 'This number needs additional setup or documentation'
      };
    }

    // Default
    return {
      status: 'Setting Up',
      color: 'text-gray-400',
      icon: <RefreshCw className="h-4 w-4 text-gray-400" />,
      description: 'This number is being processed'
    };
  };

  const formatCapabilities = (capabilities: any) => {
    const caps = [];
    if (capabilities.voice) caps.push('Voice');
    if (capabilities.sms) caps.push('SMS');
    if (capabilities.mms) caps.push('MMS');
    if (capabilities.fax) caps.push('Fax');
    return caps.join(', ');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-gray-500">Loading phone numbers...</div>
        </CardContent>
      </Card>
    );
  }

  if (phoneNumbers.length === 0) {
    return (
      <Card className={themeConfig.styleClasses.card}>
        <CardContent className="p-8">
          <div className="text-center">
            <Phone
              className="h-12 w-12 mx-auto mb-4 text-gray-400"
            />
            <h3 className="text-lg font-semibold mb-2 text-white">
              No Phone Numbers Yet
            </h3>
            <p className="text-gray-400">
              Buy your first phone number to get started with voice agents
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={themeConfig.styleClasses.card}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Phone
              className="h-5 w-5"
              style={{ color: branding?.primaryColor || '#3b82f6' }}
            />
            Your Phone Numbers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Outbound calling information */}
          <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <h4 className="text-blue-400 font-medium mb-1">About Your Phone Numbers</h4>
                <p className="text-sm text-gray-300 mb-2">
                  Your phone numbers are ready to receive incoming calls from customers.
                  They can be connected to AI agents to handle calls automatically.
                </p>
                <p className="text-sm text-gray-400">
                  <strong>Note:</strong> Outbound calling requires regulatory approval.
                  <button
                    onClick={() => {
                      // Prioritize partner's support email, then business email, then Knotie fallback
                      const emailToUse = branding?.supportEmail || branding?.email || 'support@knotie-ai.pro';
                      window.location.href = `mailto:${emailToUse}?subject=Outbound Calling Setup Request`;
                    }}
                    className="text-blue-400 hover:text-blue-300 underline ml-1"
                  >
                    Contact us for setup
                  </button>
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phoneNumbers.map((phoneNumber) => {
                  const statusInfo = getCustomerFriendlyStatus(phoneNumber);
                  return (
                    <TableRow key={phoneNumber.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{phoneNumber.phoneNumber}</div>
                          {phoneNumber.friendlyName && phoneNumber.friendlyName !== phoneNumber.phoneNumber && (
                            <div className="text-sm text-gray-500">{phoneNumber.friendlyName}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {statusInfo.icon}
                          <span className={`font-medium ${statusInfo.color}`}>
                            {statusInfo.status}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-400">
                          {statusInfo.description}
                        </div>
                      </TableCell>
                    <TableCell className="text-right">
                      {hasAvailableActions(phoneNumber) ? (
                        <DropdownMenu
                          open={openDropdown === phoneNumber.id}
                          onOpenChange={(open) => setOpenDropdown(open ? phoneNumber.id : null)}
                        >
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-white"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-gray-800 border-gray-700"
                        >
                          {/* Show Upload Documents only for active numbers */}
                          {phoneNumber.status === 'active' && (
                            <DropdownMenuItem
                              disabled={uploadingDocuments === phoneNumber.id}
                              onClick={() => handleDocumentUpload(phoneNumber.id)}
                              className="text-white hover:bg-gray-700"
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {uploadingDocuments === phoneNumber.id ? 'Opening...' : 'Upload Documents'}
                            </DropdownMenuItem>
                          )}

                          {/* Show Release Number only for active numbers */}
                          {phoneNumber.status === 'active' && (
                            <DropdownMenuItem
                              disabled={phoneNumber.activeAgents > 0 || releasing === phoneNumber.id}
                              onClick={() => handleReleaseNumber(phoneNumber.id, phoneNumber.phoneNumber)}
                              className={`${
                                phoneNumber.activeAgents > 0
                                  ? 'text-gray-500 cursor-not-allowed'
                                  : 'text-red-400 hover:bg-gray-700'
                              }`}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              {releasing === phoneNumber.id ? 'Releasing...' : 'Release Number'}
                            </DropdownMenuItem>
                          )}

                          {/* Show status info for released numbers */}
                          {phoneNumber.status === 'released' && (
                            <DropdownMenuItem
                              disabled
                              className="text-gray-500 cursor-not-allowed"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Number Released
                            </DropdownMenuItem>
                          )}

                          {/* Show actions for pending numbers */}
                          {phoneNumber.status === 'pending' && (
                            <>
                              <DropdownMenuItem
                                disabled={retryingPurchase === phoneNumber.id}
                                onClick={() => handleRetryPurchase(phoneNumber.id, phoneNumber.phoneNumber)}
                                className="text-blue-400 hover:bg-gray-700"
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {retryingPurchase === phoneNumber.id ? 'Processing...' :
                                 phoneNumber.isImported ? 'Complete Setup' : 'Complete Purchase'}
                              </DropdownMenuItem>

                              {/* Only show Remove option for purchased numbers, not imported */}
                              {!phoneNumber.isImported && (
                                <DropdownMenuItem
                                  disabled={removingNumber === phoneNumber.id}
                                  onClick={() => handleRemoveNumber(phoneNumber.id, phoneNumber.phoneNumber)}
                                  className="text-red-400 hover:bg-gray-700"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  {removingNumber === phoneNumber.id ? 'Removing...' : 'Remove Number'}
                                </DropdownMenuItem>
                              )}
                            </>
                          )}

                          {/* Show actions for failed numbers */}
                          {phoneNumber.status === 'failed' && (
                            <>
                              <DropdownMenuItem
                                disabled={retryingPurchase === phoneNumber.id}
                                onClick={() => handleRetryPurchase(phoneNumber.id, phoneNumber.phoneNumber)}
                                className="text-blue-400 hover:bg-gray-700"
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {retryingPurchase === phoneNumber.id ? 'Processing...' :
                                 phoneNumber.isImported ? 'Retry Setup' : 'Retry Purchase'}
                              </DropdownMenuItem>

                              {/* Only show Remove option for purchased numbers, not imported */}
                              {!phoneNumber.isImported && (
                                <DropdownMenuItem
                                  disabled={removingNumber === phoneNumber.id}
                                  onClick={() => handleRemoveNumber(phoneNumber.id, phoneNumber.phoneNumber)}
                                  className="text-red-400 hover:bg-gray-700"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  {removingNumber === phoneNumber.id ? 'Removing...' : 'Remove Number'}
                                </DropdownMenuItem>
                              )}
                            </>
                          )}

                          {/* Show status info for suspended numbers */}
                          {phoneNumber.status === 'suspended' && (
                            <DropdownMenuItem
                              disabled
                              className="text-amber-500 cursor-not-allowed"
                            >
                              <AlertCircle className="mr-2 h-4 w-4" />
                              Number Suspended
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-gray-500 text-sm">No actions</span>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Document Upload Modal */}
      {selectedPhoneId && (
        <DocumentUploadModal
          key={`upload-${selectedPhoneId}`}
          isOpen={showUploadModal}
          phoneNumberId={selectedPhoneId}
          phoneNumber={phoneNumbers.find(p => p.id === selectedPhoneId)}
          onClose={() => {
            setShowUploadModal(false);
            // Use setTimeout to ensure state updates are processed
            setTimeout(() => {
              setSelectedPhoneId(null);
              setUploadingDocuments(null);
            }, 100);
          }}
          onUploadComplete={() => {
            fetchPhoneNumbers();
            setShowUploadModal(false);
            setSelectedPhoneId(null);
            setUploadingDocuments(null);
          }}
        />
      )}

      {/* Release Confirmation Modal */}
      {phoneToRelease && (
        <ReleaseConfirmationModal
          key={`release-${phoneToRelease.id}`}
          isOpen={showReleaseModal}
          onClose={() => {
            setShowReleaseModal(false);
            // Use setTimeout to ensure state updates are processed
            setTimeout(() => {
              setPhoneToRelease(null);
            }, 100);
          }}
          onConfirm={confirmReleaseNumber}
          phoneNumber={phoneToRelease.number}
          isReleasing={releasing === phoneToRelease.id}
        />
      )}

      {/* Business Verification Modal for Retry Purchase */}
      {pendingRetryNumber && (
        <BusinessVerificationModal
          key={`verification-${pendingRetryNumber.id}`}
          isOpen={showBusinessVerification}
          onClose={() => {
            setShowBusinessVerification(false);
            setTimeout(() => {
              setPendingRetryNumber(null);
            }, 100);
          }}
          onVerificationComplete={() => {
            setShowBusinessVerification(false);
            setPendingRetryNumber(null);
            toast.success('Business verification submitted! You can now complete your purchase once approved.');
            fetchPhoneNumbers(); // Refresh the list
          }}
          phoneNumber={pendingRetryNumber.phoneNumber}
          numberType={pendingRetryNumber.type}
          countryCode={pendingRetryNumber.countryCode}
        />
      )}
    </>
  );
}