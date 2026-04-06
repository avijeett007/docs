'use client';

import { useState, useEffect } from 'react';
import {
  FiX, FiUser, FiGlobe, FiMail, FiPhone, FiMessageSquare,
  FiMic, FiSettings, FiCalendar, FiFileText, FiLink,
  FiCheckCircle, FiXCircle, FiClock, FiDollarSign, FiMapPin
} from 'react-icons/fi';

interface ProspectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospectId: string | null;
}

interface ProspectDetails {
  id: string;
  businessName: string;
  businessWebsite: string | null;
  hasNoWebsite: boolean;
  websiteAnalysis: any;
  // Business Lookup Data
  businessLookupData: any;
  businessRating: number | null;
  businessPhone: string | null;
  businessAddress: string | null;
  businessTypes: string[] | null;
  businessReviewsCount: number | null;
  businessWebsiteVerified: boolean;
  businessLookupTimestamp: string | null;
  businessCountry: string | null;
  businessPlaceId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  serviceCategories: any;
  knowledgeBaseFiles: any;
  knowledgeBaseUrls: any;
  greetingText: string | null;
  voiceType: string | null;
  selectedVoiceId: string | null;
  voicePreviewCount: number;
  informationSettings: any;
  meetingUrl: string | null;
  smsEnabled: boolean;
  callTransferEnabled: boolean;
  transferNumber: string | null;
  deploymentSettings: any;
  selectedPricingPlan: string | null;
  billingModel: string | null;
  currentStep: number;
  completedSteps: any;
  isCompleted: boolean;
  convertedToCustomerId: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
  voiceDetails: any;
}

export default function ProspectDetailsModal({ isOpen, onClose, prospectId }: ProspectDetailsModalProps) {
  const [prospect, setProspect] = useState<ProspectDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    if (isOpen && prospectId) {
      fetchProspectDetails();
    }
  }, [isOpen, prospectId]);

  const fetchProspectDetails = async () => {
    if (!prospectId) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch(`/api/partner/prospects/${prospectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch prospect details');
      }

      const data = await response.json();
      setProspect(data.prospect);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prospect details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStepName = (step: number) => {
    const steps = [
      'Business Info',
      'Website Verification', 
      'Contact Details',
      'Service Categories',
      'Knowledge Base',
      'Greeting Setup',
      'Information Collection',
      'Communication Settings',
      'Summary & Deploy'
    ];
    return steps[step - 1] || 'Unknown';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Prospect Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <FiXCircle className="mx-auto text-6xl text-red-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Error Loading Details</h3>
              <p className="text-gray-300">{error}</p>
            </div>
          ) : prospect ? (
            <div className="space-y-8">
              {/* Progress Overview */}
              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <FiClock className="w-5 h-5 mr-2" />
                  Onboarding Progress
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Current Step</label>
                    <p className="text-white">{prospect.currentStep}/9 - {getStepName(prospect.currentStep)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                    <div className="flex items-center">
                      {prospect.isCompleted ? (
                        <>
                          <FiCheckCircle className="w-4 h-4 text-green-400 mr-2" />
                          <span className="text-green-400">Completed</span>
                        </>
                      ) : prospect.convertedToCustomerId ? (
                        <>
                          <FiCheckCircle className="w-4 h-4 text-blue-400 mr-2" />
                          <span className="text-blue-400">Converted to Customer</span>
                        </>
                      ) : (
                        <>
                          <FiClock className="w-4 h-4 text-yellow-400 mr-2" />
                          <span className="text-yellow-400">In Progress</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Started</label>
                    <p className="text-white">{formatDate(prospect.createdAt)}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${(prospect.currentStep / 9) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Basic Information */}
              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <FiUser className="w-5 h-5 mr-2" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Business Name</label>
                    <p className="text-white">{prospect.businessName || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Website</label>
                    <p className="text-white">
                      {prospect.hasNoWebsite ? 'No website' : (prospect.businessWebsite || 'Not provided')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Contact Name</label>
                    <p className="text-white">
                      {prospect.firstName || prospect.lastName
                        ? `${prospect.firstName || ''} ${prospect.lastName || ''}`.trim()
                        : 'Not provided'
                      }
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <p className="text-white">{prospect.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                    <p className="text-white">{prospect.phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {/* Business Intelligence */}
              {(prospect.businessLookupData || prospect.businessRating || prospect.businessPhone || prospect.businessAddress) && (
                <div className="bg-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <FiMapPin className="w-5 h-5 mr-2" />
                    Business Intelligence
                    <span className="ml-2 px-2 py-1 bg-green-600 text-xs rounded-full">Google Places Data</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {prospect.businessAddress && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Business Address</label>
                        <p className="text-white">{prospect.businessAddress}</p>
                      </div>
                    )}
                    {prospect.businessPhone && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Business Phone</label>
                        <p className="text-white">{prospect.businessPhone}</p>
                      </div>
                    )}
                    {prospect.businessRating && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Google Rating</label>
                        <p className="text-white flex items-center">
                          <span className="text-yellow-400 mr-1">⭐</span>
                          {prospect.businessRating}/5
                          {prospect.businessReviewsCount && (
                            <span className="text-gray-400 ml-2">({prospect.businessReviewsCount} reviews)</span>
                          )}
                        </p>
                      </div>
                    )}
                    {prospect.businessTypes && prospect.businessTypes.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Business Categories</label>
                        <div className="flex flex-wrap gap-1">
                          {prospect.businessTypes.slice(0, 3).map((type: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">
                              {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          ))}
                          {prospect.businessTypes.length > 3 && (
                            <span className="px-2 py-1 bg-gray-600 text-white rounded text-xs">
                              +{prospect.businessTypes.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {prospect.businessWebsiteVerified && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Website Status</label>
                        <p className="text-green-400 flex items-center">
                          <FiCheckCircle className="w-4 h-4 mr-1" />
                          Verified via Google Places
                        </p>
                      </div>
                    )}
                    {prospect.businessLookupTimestamp && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Data Last Updated</label>
                        <p className="text-gray-400 text-sm">
                          {new Date(prospect.businessLookupTimestamp).toLocaleDateString()} at{' '}
                          {new Date(prospect.businessLookupTimestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Business Insights */}
                  {prospect.businessLookupData && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <h4 className="text-md font-medium text-white mb-3">Business Insights</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {prospect.businessLookupData.priceLevel && (
                          <div className="text-center p-3 bg-gray-600 rounded">
                            <FiDollarSign className="w-5 h-5 mx-auto text-green-400 mb-1" />
                            <p className="text-xs text-gray-300">Price Level</p>
                            <p className="text-white font-medium">
                              {'$'.repeat(prospect.businessLookupData.priceLevel)}/$$$$
                            </p>
                          </div>
                        )}
                        {prospect.businessLookupData.photos && prospect.businessLookupData.photos.length > 0 && (
                          <div className="text-center p-3 bg-gray-600 rounded">
                            <FiFileText className="w-5 h-5 mx-auto text-blue-400 mb-1" />
                            <p className="text-xs text-gray-300">Photos Available</p>
                            <p className="text-white font-medium">{prospect.businessLookupData.photos.length}</p>
                          </div>
                        )}
                        {prospect.businessLookupData.reviews && prospect.businessLookupData.reviews.length > 0 && (
                          <div className="text-center p-3 bg-gray-600 rounded">
                            <FiMessageSquare className="w-5 h-5 mx-auto text-purple-400 mb-1" />
                            <p className="text-xs text-gray-300">Recent Reviews</p>
                            <p className="text-white font-medium">{prospect.businessLookupData.reviews.length}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Customer Reviews */}
                  {prospect.businessLookupData?.reviews && prospect.businessLookupData.reviews.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <h4 className="text-md font-medium text-white mb-3 flex items-center">
                        <FiMessageSquare className="w-4 h-4 mr-2" />
                        Recent Customer Reviews
                      </h4>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {(showAllReviews ? prospect.businessLookupData.reviews : prospect.businessLookupData.reviews.slice(0, 3)).map((review: any, index: number) => (
                          <div key={index} className="bg-gray-600 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <span className="text-yellow-400 mr-1">
                                  {'⭐'.repeat(review.rating || 5)}
                                </span>
                                <span className="text-gray-300 text-sm">
                                  {review.rating || 5}/5
                                </span>
                              </div>
                              {review.time && (
                                <span className="text-gray-400 text-xs">
                                  {new Date(review.time).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-200 text-sm leading-relaxed">
                              {typeof review.text === 'object' && review.text?.text
                                ? review.text.text
                                : typeof review.text === 'string'
                                ? review.text
                                : 'No review text available'}
                            </p>
                            {review.author_name && (
                              <p className="text-gray-400 text-xs mt-2">
                                - {review.author_name}
                              </p>
                            )}
                          </div>
                        ))}
                        {prospect.businessLookupData.reviews.length > 3 && (
                          <div className="text-center">
                            <button
                              onClick={() => setShowAllReviews(!showAllReviews)}
                              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                            >
                              {showAllReviews
                                ? 'Show less reviews'
                                : `+${prospect.businessLookupData.reviews.length - 3} more reviews available`
                              }
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Google Business Listing Link */}
                      {prospect.businessLookupData?.place_id && (
                        <div className="mt-3 pt-3 border-t border-gray-600">
                          <a
                            href={`https://www.google.com/maps/place/?q=place_id:${prospect.businessLookupData.place_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-400 hover:text-blue-300 text-sm transition-colors"
                          >
                            <FiLink className="w-4 h-4 mr-2" />
                            View Google Business Listing
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Business Photos */}
                  {prospect.businessLookupData?.photos && prospect.businessLookupData.photos.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <h4 className="text-md font-medium text-white mb-3 flex items-center">
                        <FiFileText className="w-4 h-4 mr-2" />
                        Business Photos ({prospect.businessLookupData.photos.length})
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {prospect.businessLookupData.photos.slice(0, 8).map((photo: any, index: number) => {
                          // Handle different photo reference formats
                          const photoRef = photo.photo_reference || photo.name || photo.photoReference;
                          return (
                            <div key={index} className="relative aspect-square bg-gray-600 rounded-lg overflow-hidden">
                              {photoRef ? (
                                <img
                                  src={`/api/whitelabel/business-lookup/photo?photo_reference=${photoRef}&maxwidth=200`}
                                  alt={`Business photo ${index + 1}`}
                                  className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const fallback = target.nextElementSibling as HTMLElement;
                                    if (fallback) {
                                      fallback.classList.remove('hidden');
                                    }
                                  }}
                                  onLoad={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    const fallback = target.nextElementSibling as HTMLElement;
                                    if (fallback) {
                                      fallback.classList.add('hidden');
                                    }
                                  }}
                                />
                              ) : null}
                              <div className="absolute inset-0 flex items-center justify-center bg-gray-600">
                                <FiFileText className="w-8 h-8 text-gray-400" />
                              </div>
                            </div>
                          );
                        })}
                        {prospect.businessLookupData.photos.length > 8 && (
                          <div className="aspect-square bg-gray-600 rounded-lg flex items-center justify-center">
                            <div className="text-center">
                              <FiFileText className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                              <p className="text-xs text-gray-400">
                                +{prospect.businessLookupData.photos.length - 8} more
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Service Categories */}
              {prospect.serviceCategories && (
                <div className="bg-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <FiSettings className="w-5 h-5 mr-2" />
                    {typeof prospect.serviceCategories === 'object' && !Array.isArray(prospect.serviceCategories) &&
                    (prospect.serviceCategories as Record<string, unknown>).industry
                      ? 'Lead Qualification'
                      : 'Service Categories'}
                  </h3>
                  {Array.isArray(prospect.serviceCategories) ? (
                    <div className="flex flex-wrap gap-2">
                      {prospect.serviceCategories.map((category: string, index: number) => (
                        <span key={index} className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm">
                          {category}
                        </span>
                      ))}
                    </div>
                  ) : typeof prospect.serviceCategories === 'object' && prospect.serviceCategories !== null ? (
                    /* OpenClaw / JSON object format: { industry, primaryChallenge, revenueRange } */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Boolean((prospect.serviceCategories as Record<string, unknown>).industry) && (
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Industry</label>
                          <p className="text-white text-sm">{String((prospect.serviceCategories as Record<string, unknown>).industry)}</p>
                        </div>
                      )}
                      {Boolean((prospect.serviceCategories as Record<string, unknown>).primaryChallenge) && (
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Primary Challenge</label>
                          <p className="text-white text-sm">{String((prospect.serviceCategories as Record<string, unknown>).primaryChallenge)}</p>
                        </div>
                      )}
                      {Boolean((prospect.serviceCategories as Record<string, unknown>).revenueRange) && (
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Revenue Range</label>
                          <p className="text-white text-sm">{String((prospect.serviceCategories as Record<string, unknown>).revenueRange)}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No service data available</p>
                  )}
                </div>
              )}

              {/* Voice Configuration */}
              {(prospect.greetingText || prospect.selectedVoiceId || prospect.voiceType) && (
                <div className="bg-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <FiMic className="w-5 h-5 mr-2" />
                    Voice Configuration
                  </h3>
                  <div className="space-y-4">
                    {prospect.greetingText && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Greeting Text</label>
                        <p className="text-white bg-gray-800 p-3 rounded border">{prospect.greetingText}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {prospect.voiceType && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Voice Type</label>
                          <p className="text-white capitalize">{prospect.voiceType}</p>
                        </div>
                      )}
                      {prospect.selectedVoiceId && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Selected Voice ID</label>
                          <p className="text-white font-mono text-sm">{prospect.selectedVoiceId}</p>
                        </div>
                      )}
                    </div>
                    {prospect.voiceDetails && (
                      <div className="bg-gray-800 p-4 rounded">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Voice Details (Cartesia)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Name:</span>
                            <span className="text-white ml-2">{prospect.voiceDetails.name || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Gender:</span>
                            <span className="text-white ml-2 capitalize">{prospect.voiceDetails.gender || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Language:</span>
                            <span className="text-white ml-2">{prospect.voiceDetails.language || 'Unknown'}</span>
                          </div>
                        </div>
                        {prospect.voiceDetails.description && (
                          <div className="mt-2">
                            <span className="text-gray-400">Description:</span>
                            <p className="text-white mt-1">{prospect.voiceDetails.description}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Voice Preview Count</label>
                      <p className="text-white">{prospect.voicePreviewCount} previews played</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Knowledge Base */}
              {(prospect.knowledgeBaseFiles || prospect.knowledgeBaseUrls) && (
                <div className="bg-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <FiFileText className="w-5 h-5 mr-2" />
                    Knowledge Base
                  </h3>
                  <div className="space-y-4">
                    {prospect.knowledgeBaseFiles && Array.isArray(prospect.knowledgeBaseFiles) && prospect.knowledgeBaseFiles.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Uploaded Files</label>
                        <div className="space-y-2">
                          {prospect.knowledgeBaseFiles.map((file: any, index: number) => (
                            <div key={index} className="bg-gray-800 p-3 rounded flex items-center">
                              <FiFileText className="w-4 h-4 text-blue-400 mr-2" />
                              <span className="text-white">{file.name || `File ${index + 1}`}</span>
                              {file.size && <span className="text-gray-400 ml-2">({file.size})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {prospect.knowledgeBaseUrls && Array.isArray(prospect.knowledgeBaseUrls) && prospect.knowledgeBaseUrls.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Website URLs</label>
                        <div className="space-y-2">
                          {prospect.knowledgeBaseUrls.map((url: string, index: number) => (
                            <div key={index} className="bg-gray-800 p-3 rounded flex items-center">
                              <FiLink className="w-4 h-4 text-green-400 mr-2" />
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                                {url}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Information Collection Settings */}
              {prospect.informationSettings && (
                <div className="bg-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <FiMessageSquare className="w-5 h-5 mr-2" />
                    Information Collection
                  </h3>
                  <div className="space-y-3">
                    {prospect.informationSettings.selectedFields && Array.isArray(prospect.informationSettings.selectedFields) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Fields to Collect</label>
                        <div className="flex flex-wrap gap-2">
                          {prospect.informationSettings.selectedFields.map((field: string, index: number) => (
                            <span key={index} className="px-3 py-1 bg-green-600 text-white rounded-full text-sm">
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {prospect.informationSettings.customFields && Array.isArray(prospect.informationSettings.customFields) && prospect.informationSettings.customFields.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Custom Fields</label>
                        <div className="space-y-2">
                          {prospect.informationSettings.customFields.map((field: any, index: number) => (
                            <div key={index} className="bg-gray-800 p-3 rounded">
                              <div className="text-white font-medium">{field.label || field.name}</div>
                              {field.type && <div className="text-gray-400 text-sm">Type: {field.type}</div>}
                              {field.required && <div className="text-yellow-400 text-sm">Required</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Communication Settings */}
              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <FiPhone className="w-5 h-5 mr-2" />
                  Communication Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {prospect.meetingUrl && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-1">Meeting/Appointment URL</label>
                      <a href={prospect.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 break-all">
                        {prospect.meetingUrl}
                      </a>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">SMS Notifications</label>
                    <div className="flex items-center">
                      {prospect.smsEnabled ? (
                        <>
                          <FiCheckCircle className="w-4 h-4 text-green-400 mr-2" />
                          <span className="text-green-400">Enabled</span>
                        </>
                      ) : (
                        <>
                          <FiXCircle className="w-4 h-4 text-red-400 mr-2" />
                          <span className="text-red-400">Disabled</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Call Transfer</label>
                    <div className="flex items-center">
                      {prospect.callTransferEnabled ? (
                        <>
                          <FiCheckCircle className="w-4 h-4 text-green-400 mr-2" />
                          <span className="text-green-400">Enabled</span>
                        </>
                      ) : (
                        <>
                          <FiXCircle className="w-4 h-4 text-red-400 mr-2" />
                          <span className="text-red-400">Disabled</span>
                        </>
                      )}
                    </div>
                  </div>
                  {prospect.transferNumber && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-1">Transfer Number</label>
                      <p className="text-white">{prospect.transferNumber}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing & Deployment */}
              {(prospect.selectedPricingPlan || prospect.billingModel || prospect.deploymentSettings) && (
                <div className="bg-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <FiDollarSign className="w-5 h-5 mr-2" />
                    Pricing & Deployment
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {prospect.selectedPricingPlan && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Selected Plan</label>
                        <p className="text-white capitalize">{prospect.selectedPricingPlan}</p>
                      </div>
                    )}
                    {prospect.billingModel && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Billing Model</label>
                        <p className="text-white capitalize">{prospect.billingModel.replace('_', ' ')}</p>
                      </div>
                    )}
                  </div>
                  {prospect.deploymentSettings && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Deployment Settings</label>
                      <div className="bg-gray-800 p-3 rounded">
                        <pre className="text-white text-sm overflow-x-auto">
                          {JSON.stringify(prospect.deploymentSettings, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Website Analysis */}
              {prospect.websiteAnalysis && (
                <div className="bg-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <FiGlobe className="w-5 h-5 mr-2" />
                    Website Analysis
                  </h3>
                  <div className="bg-gray-800 p-4 rounded">
                    <pre className="text-white text-sm overflow-x-auto">
                      {JSON.stringify(prospect.websiteAnalysis, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
