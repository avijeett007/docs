'use client';

import React, { useState, useEffect } from 'react';
import { FiCheck, FiExternalLink, FiMapPin, FiCalendar, FiLoader, FiAlertCircle } from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface GHLLocation {
  id: string;
  name: string;
  city?: string;
  state?: string;
  timezone: string;
}

interface GHLCalendar {
  id: string;
  name: string;
  description?: string;
  timezone: string;
  isActive: boolean;
  calendarType: string;
  isConfigured?: boolean;
  configuration?: {
    isDefault: boolean;
  };
}

interface GHLIntegrationProps {
  onConfigurationChange?: () => void;
}

export default function GHLIntegration({ onConfigurationChange }: GHLIntegrationProps) {
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [locations, setLocations] = useState<GHLLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [calendars, setCalendars] = useState<GHLCalendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [connectionBroken, setConnectionBroken] = useState(false);
  const [step, setStep] = useState<'connect' | 'location' | 'calendar' | 'complete'>('connect');

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  // Load locations when connected
  useEffect(() => {
    if (isConnected && step === 'location') {
      loadLocations();
    }
  }, [isConnected, step]);

  // Load calendars when location is selected
  useEffect(() => {
    console.log('Calendar useEffect triggered:', { selectedLocation, step });
    if (selectedLocation && step === 'calendar') {
      setError(''); // Clear any previous errors
      console.log('Loading calendars for location:', selectedLocation);
      loadCalendars(selectedLocation);
    }
  }, [selectedLocation, step]);

  const checkConnectionStatus = async () => {
    try {
      setLoading(true);
      setError('');
      setConnectionBroken(false);

      const response = await fetch('/api/whitelabel/integrations/ghl/status');
      const data = await response.json();

      if (data.data?.isConnected) {
        setIsConnected(true);
        setConnectionBroken(false);
        setStep('location');
      } else {
        // Check if there was a connection before (token exists but expired)
        if (data.data?.connectionId) {
          setConnectionBroken(true);
          setIsConnected(false);
          setStep('connect');
          setError('Your GHL connection has expired. Please reconnect to continue using calendar features.');
        } else {
          setIsConnected(false);
          setConnectionBroken(false);
          setStep('connect');
        }
      }
    } catch (error) {
      console.error('Failed to check GHL connection status:', error);
      setError('Failed to check connection status. Please try again.');
      setIsConnected(false);
      setConnectionBroken(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError('');

      const response = await fetch('/api/whitelabel/integrations/ghl/oauth-url?redirectUrl=' +
        encodeURIComponent(`${window.location.origin}/whitelabel/integration?ghl=connected`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && data.oauthUrl) {
        // Redirect to GHL OAuth
        window.location.href = data.oauthUrl;
      } else {
        throw new Error(data.error || 'Failed to generate OAuth URL');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to connect to GHL');
      setIsConnecting(false);
    }
  };

  const loadLocations = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/whitelabel/integrations/ghl/locations');
      const data = await response.json();

      if (data.success && data.locations) {
        console.log('Locations loaded:', data.locations);
        console.log('First location object:', JSON.stringify(data.locations[0], null, 2));
        setLocations(data.locations);
        if (data.locations.length === 1) {
          // Auto-select if only one location
          const locationId = data.locations[0].id;
          console.log('Auto-selecting single location:', locationId);
          console.log('Location object keys:', Object.keys(data.locations[0]));
          setSelectedLocation(locationId);
          setStep('calendar');
          console.log('Step changed to calendar');
        } else {
          console.log('Multiple locations found, showing selection');
        }
      } else {
        throw new Error(data.error || 'Failed to load locations');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const loadCalendars = async (locationId: string) => {
    try {
      console.log('loadCalendars called with locationId:', locationId);
      setLoading(true);
      setError('');

      console.log('Fetching calendars from API...');
      const response = await fetch(`/api/whitelabel/integrations/ghl/calendars?locationId=${locationId}`);
      const data = await response.json();

      console.log('Frontend calendars response:', data);
      console.log('Configured calendars:', data.configured);
      console.log('Configured type:', typeof data.configured);
      console.log('Is configured array?', Array.isArray(data.configured));

      if (data.success && data.calendars) {
        console.log('Setting calendars:', data.calendars);
        setCalendars(data.calendars);

        // Check if any calendar is already configured as default
        const configured = data.configured || [];
        const configuredCalendar = Array.isArray(configured)
          ? configured.find((config: any) => config.isDefault)
          : null;

        if (configuredCalendar) {
          console.log('Found configured default calendar:', configuredCalendar.calendarId);
          setSelectedCalendar(configuredCalendar.calendarId);
          setStep('complete');
        }
      } else {
        throw new Error(data.error || 'Failed to load calendars');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load calendars');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (locationId: string) => {
    setSelectedLocation(locationId);
    setStep('calendar');
  };

  const handleCalendarSelect = async (calendarId: string) => {
    try {
      setLoading(true);
      setError('');
      console.log('Selecting calendar:', calendarId);
      
      const calendar = calendars.find(cal => cal.id === calendarId);
      if (!calendar) return;

      const response = await fetch('/api/whitelabel/integrations/ghl/calendars', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId: selectedLocation,
          calendarId: calendar.id,
          calendarName: calendar.name,
          isDefault: true,
          settings: {
            timezone: calendar.timezone,
            calendarType: calendar.calendarType,
          },
        }),
      });

      const data = await response.json();
      console.log('Calendar configuration response:', data);

      if (data.success) {
        setSelectedCalendar(calendarId);
        setStep('complete');
        onConfigurationChange?.();
      } else {
        console.error('Calendar configuration failed:', data);
        throw new Error(data.error || 'Failed to configure calendar');
      }
    } catch (error) {
      console.error('Calendar configuration error:', error);
      setError(error instanceof Error ? error.message : 'Failed to configure calendar');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/integrations/ghl/disconnect', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setIsConnected(false);
        setStep('connect');
        setLocations([]);
        setCalendars([]);
        setSelectedLocation('');
        setSelectedCalendar('');
        onConfigurationChange?.();
      }
    } catch (error) {
      setError('Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'connect':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700 flex items-center justify-center">
              <FiExternalLink className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {connectionBroken ? 'Reconnect to GoHighLevel' : 'Connect to GoHighLevel'}
            </h3>
            <p className="text-gray-400 mb-6">
              {connectionBroken
                ? 'Your GoHighLevel connection has expired. Please reconnect to continue using calendar features.'
                : 'Connect your GoHighLevel account to enable calendar booking and management'
              }
            </p>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-6 py-3 rounded-lg text-white font-medium flex items-center space-x-2 mx-auto"
              style={{ backgroundColor: primaryColor }}
            >
              {isConnecting ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <FiExternalLink className="h-4 w-4" />
                  <span>{connectionBroken ? 'Reconnect GoHighLevel' : 'Connect GoHighLevel'}</span>
                </>
              )}
            </button>
          </div>
        );

      case 'location':
        return (
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Select Location</h3>
            <p className="text-gray-400 mb-6">
              Choose the GoHighLevel location you want to use for calendar bookings
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <FiLoader className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-3">
                {locations.map((location) => (
                  <button
                    key={location.id}
                    onClick={() => handleLocationSelect(location.id)}
                    className="w-full p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <FiMapPin className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="text-white font-medium">{location.name}</div>
                        {(location.city || location.state) && (
                          <div className="text-gray-400 text-sm">
                            {[location.city, location.state].filter(Boolean).join(', ')}
                          </div>
                        )}
                        <div className="text-gray-500 text-xs">
                          Timezone: {location.timezone}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 'calendar':
        return (
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Select Default Calendar</h3>
            <p className="text-gray-400 mb-6">
              Choose which calendar should be used for booking appointments
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <FiLoader className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Calendar
                  </label>
                  <select
                    value={selectedCalendar || ''}
                    onChange={(e) => setSelectedCalendar(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-700 bg-gray-800 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Choose a calendar...</option>
                    {calendars.filter(cal => cal.isActive).map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.name} ({calendar.calendarType})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCalendar && (
                  <div className="p-4 rounded-lg border border-gray-700 bg-gray-800/50">
                    {(() => {
                      const calendar = calendars.find(cal => cal.id === selectedCalendar);
                      if (!calendar) return null;

                      return (
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <FiCalendar className="h-5 w-5 text-blue-400" />
                            <h3 className="text-white font-medium">{calendar.name}</h3>
                          </div>

                          {calendar.description && (
                            <p className="text-gray-400 text-sm mb-3 leading-relaxed">
                              {calendar.description.replace(/<[^>]*>/g, '').substring(0, 200)}
                              {calendar.description.length > 200 ? '...' : ''}
                            </p>
                          )}

                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Type: {calendar.calendarType}</span>
                            <span>Timezone: {calendar.timezone || 'UTC'}</span>
                          </div>

                          <button
                            onClick={() => handleCalendarSelect(calendar.id)}
                            disabled={loading}
                            className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                          >
                            {loading ? (
                              <>
                                <FiLoader className="h-4 w-4 animate-spin" />
                                <span>Configuring...</span>
                              </>
                            ) : (
                              <>
                                <FiCheck className="h-4 w-4" />
                                <span>Use This Calendar</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'complete':
        const selectedLocationData = locations.find(loc => loc.id === selectedLocation);
        const selectedCalendarData = calendars.find(cal => cal.id === selectedCalendar);
        
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                 style={{ backgroundColor: `${primaryColor}20` }}>
              <FiCheck className="h-8 w-8" style={{ color: primaryColor }} />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">GoHighLevel Connected</h3>
            <p className="text-gray-400 mb-6">
              Your calendar is ready for appointment booking
            </p>
            <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
              <div className="text-sm text-gray-300">
                <div className="mb-2">
                  <span className="text-gray-500">Location:</span> {selectedLocationData?.name}
                </div>
                <div className="mb-3">
                  <span className="text-gray-500">Calendar:</span> {selectedCalendarData?.name}
                </div>
                {selectedCalendarData?.description && (
                  <div className="text-xs text-gray-400 border-t border-gray-700 pt-2">
                    {selectedCalendarData.description.replace(/<[^>]*>/g, '').substring(0, 100)}
                    {selectedCalendarData.description.length > 100 ? '...' : ''}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => setStep('calendar')}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Change Calendar
              </button>
              <button
                onClick={handleDisconnect}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Disconnect GoHighLevel
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-xl border border-gray-700/50 p-8 backdrop-blur-sm hover:border-gray-600/50 transition-all duration-300">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-500/30">
            <FiCalendar className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">GoHighLevel</h3>
            <p className="text-gray-400">Calendar booking and management</p>
          </div>
        </div>
        {isConnected && (
          <div className="flex items-center space-x-3">
            <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span className="text-green-300 text-sm font-medium">Connected</span>
            </div>
          </div>
        )}
        {connectionBroken && (
          <div className="flex items-center space-x-3">
            <div className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
              <span className="text-amber-300 text-sm font-medium">Connection Expired</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center space-x-3 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
            <FiAlertCircle className="h-4 w-4 text-red-400" />
          </div>
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}

      {renderStepContent()}
    </div>
  );
}
