import React, { useState, useEffect } from 'react';
import { FiCalendar, FiLoader, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface GHLCalendar {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  calendarType: string;
}

interface GHLCalendarSelectorProps {
  customerId: string;
  selectedCalendarId?: string;
  onCalendarSelect: (calendarId: string, calendarName: string) => void;
  disabled?: boolean;
}

export const GHLCalendarSelector: React.FC<GHLCalendarSelectorProps> = ({
  customerId,
  selectedCalendarId,
  onCalendarSelect,
  disabled = false
}) => {
  const [calendars, setCalendars] = useState<GHLCalendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (customerId) {
      loadGHLCalendars();
    }
  }, [customerId]);
  
  const loadGHLCalendars = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const response = await fetch(`/api/partner/customers/${customerId}/ghl/calendars`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load GHL calendars');
      }
      
      const data = await response.json();
      setCalendars(data.calendars || []);
      
    } catch (error: any) {
      console.error('Failed to load GHL calendars:', error);
      setError(error.message);
      toast.error('Failed to load GHL calendars');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCalendarChange = (calendarId: string) => {
    const calendar = calendars.find(cal => cal.id === calendarId);
    if (calendar) {
      onCalendarSelect(calendarId, calendar.name);
    }
  };
  
  if (loading) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">
          Select Calendar
        </label>
        <div className="flex items-center space-x-2 p-3 bg-gray-700/50 rounded-lg">
          <FiLoader className="h-4 w-4 animate-spin text-blue-400" />
          <span className="text-sm text-gray-400">Loading calendars...</span>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">
          Select Calendar
        </label>
        <div className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <FiAlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
          <button
            onClick={loadGHLCalendars}
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
        Select Calendar
      </label>
      
      <div className="relative">
        <select
          value={selectedCalendarId || ''}
          onChange={(e) => handleCalendarChange(e.target.value)}
          disabled={disabled || calendars.length === 0}
          className="w-full px-3 py-2 pl-10 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Choose a calendar...</option>
          {calendars.map((calendar) => (
            <option key={calendar.id} value={calendar.id}>
              {calendar.name} {!calendar.isActive && '(Inactive)'}
            </option>
          ))}
        </select>
        
        <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>
      
      {calendars.length === 0 && !loading && (
        <p className="text-xs text-gray-500">
          No calendars found. Make sure your GHL integration is properly connected.
        </p>
      )}
      
      {selectedCalendarId && (
        <div className="text-xs text-green-400">
          ✓ Calendar selected: {calendars.find(cal => cal.id === selectedCalendarId)?.name}
        </div>
      )}
    </div>
  );
};
