'use client';

import React, { useState, useEffect } from 'react';
import { format, parseISO, startOfToday, addWeeks, isToday } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Calendar as CalendarIcon } from 'lucide-react';
import './calendar.css';

interface Slot {
  time: string;
  formattedTime: string;
}

interface DaySlots {
  [key: string]: {
    slots: string[];
  };
}

interface CalendarBookingProps {
  onBookingComplete: (date: string, time: string) => void;
  userId: string;
}

export function CalendarBooking({ onBookingComplete, userId }: CalendarBookingProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [availableSlots, setAvailableSlots] = useState<DaySlots>({});
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailableSlots = async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = startOfToday().getTime();
      const endDate = addWeeks(startDate, 2).getTime();

      const response = await fetch(`/api/calendar/slots?userId=${userId}&start=${startDate}&end=${endDate}`);
      if (!response.ok) {
        throw new Error('Failed to fetch available slots');
      }

      const data = await response.json();
      setAvailableSlots(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableSlots();
  }, [userId]);

  const getAvailableTimesForDate = (selectedDate: Date): Slot[] => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const slots = availableSlots[dateKey]?.slots || [];
    
    return slots.map(slot => ({
      time: slot,
      formattedTime: format(parseISO(slot), 'h:mm a')
    }));
  };

  const handleDateSelect = (newDate: Date | undefined) => {
    setDate(newDate);
    setSelectedTime('');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleBooking = async () => {
    if (date && selectedTime) {
      try {
        setError(null);
        console.log('Attempting to book appointment at:', '/api/appointments/book');
        const response = await fetch('/api/appointments/book', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            selectedSlot: selectedTime,
            userId,
          }),
          cache: 'no-store',
        });

        console.log('Booking response status:', response.status);
        
        if (!response.ok) {
          const data = await response.json();
          if (response.status === 409) {
            setError('This time slot is no longer available. Please select another time.');
            // Refresh available slots
            await fetchAvailableSlots();
          } else {
            setError(data.error || 'Failed to book appointment. Please try again.');
          }
          return;
        }

        const data = await response.json();
        onBookingComplete(format(date, 'yyyy-MM-dd'), selectedTime);
      } catch (error) {
        console.error('Error booking appointment:', error);
        setError('Failed to book appointment. Please try again.');
      }
    }
  };

  const selectedDateSlots = date ? getAvailableTimesForDate(date) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <p>{error}</p>
        <button
          onClick={fetchAvailableSlots}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const hasAvailableSlots = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availableSlots[dateStr] && availableSlots[dateStr].slots.length > 0;
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Calendar Section */}
          <div className="md:w-1/2 p-6 border-r border-gray-200">
            <div className="flex items-center gap-2 mb-6">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-800">Select Date</h2>
            </div>
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              className="rounded-md"
              modifiers={{
                available: (date) => hasAvailableSlots(date),
                today: (date) => isToday(date)
              }}
              modifiersClassNames={{
                available: 'available-day',
                today: 'today'
              }}
              disabled={(date) => !hasAvailableSlots(date)}
            />
          </div>

          {/* Time Slots Section */}
          <div className="md:w-1/2 p-6 bg-gray-50">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-800">
                {date ? 'Select Time' : 'Choose a Date First'}
              </h2>
            </div>
            
            <AnimatePresence mode="wait">
              {date && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <h3 className="text-lg text-gray-600 mb-4">
                    Available times for {format(date, 'MMMM d, yyyy')}
                  </h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedDateSlots.map((slot) => (
                      <motion.button
                        key={slot.time}
                        onClick={() => handleTimeSelect(slot.time)}
                        className={`p-3 text-sm rounded-lg transition-all transform hover:scale-105 ${
                          selectedTime === slot.time
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-white hover:bg-blue-50 text-gray-700 shadow-sm hover:shadow'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {slot.formattedTime}
                      </motion.button>
                    ))}
                  </div>

                  {selectedTime && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6"
                    >
                      <button
                        onClick={handleBooking}
                        className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium
                          hover:bg-blue-700 transform transition-all hover:shadow-lg
                          active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Book Appointment
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
