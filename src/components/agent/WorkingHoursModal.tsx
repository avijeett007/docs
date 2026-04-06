import React, { useState } from 'react';
import { motion as m } from 'framer-motion';
import { FiX, FiClock } from 'react-icons/fi';

interface WorkingHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

interface WeeklyWorkingHours {
  monday: WorkingHours;
  tuesday: WorkingHours;
  wednesday: WorkingHours;
  thursday: WorkingHours;
  friday: WorkingHours;
  saturday: WorkingHours;
  sunday: WorkingHours;
}

const DEFAULT_WORKING_HOURS: WorkingHours = {
  enabled: true,
  startTime: '09:00',
  endTime: '17:00'
};

interface WorkingHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (hours: WeeklyWorkingHours) => void;
  initialHours?: WeeklyWorkingHours;
}

export const WorkingHoursModal: React.FC<WorkingHoursModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialHours
}) => {
  const [workingHours, setWorkingHours] = useState<WeeklyWorkingHours>(
    initialHours || {
      monday: { ...DEFAULT_WORKING_HOURS },
      tuesday: { ...DEFAULT_WORKING_HOURS },
      wednesday: { ...DEFAULT_WORKING_HOURS },
      thursday: { ...DEFAULT_WORKING_HOURS },
      friday: { ...DEFAULT_WORKING_HOURS },
      saturday: { ...DEFAULT_WORKING_HOURS, enabled: false },
      sunday: { ...DEFAULT_WORKING_HOURS, enabled: false }
    }
  );

  const handleDayChange = (day: keyof WeeklyWorkingHours, hours: WorkingHours) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: hours
    }));
  };

  const applyToAll = (hours: WorkingHours) => {
    const days: (keyof WeeklyWorkingHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const newHours = days.reduce((acc, day) => ({
      ...acc,
      [day]: { ...hours }
    }), {} as WeeklyWorkingHours);
    setWorkingHours(newHours);
  };

  const applyToWeekdays = (hours: WorkingHours) => {
    const weekdays: (keyof WeeklyWorkingHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    setWorkingHours(prev => {
      const newHours = { ...prev };
      weekdays.forEach(day => {
        newHours[day] = { ...hours };
      });
      return newHours;
    });
  };

  const applyToWeekends = (hours: WorkingHours) => {
    const weekends: (keyof WeeklyWorkingHours)[] = ['saturday', 'sunday'];
    setWorkingHours(prev => {
      const newHours = { ...prev };
      weekends.forEach(day => {
        newHours[day] = { ...hours };
      });
      return newHours;
    });
  };

  const handleSave = () => {
    onSave(workingHours);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <m.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <FiClock className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-white">Working Hours</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Quick Apply Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => applyToAll(workingHours.monday)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Apply to All Days
            </button>
            <button
              onClick={() => applyToWeekdays(workingHours.monday)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              Apply to Weekdays
            </button>
            <button
              onClick={() => applyToWeekends(workingHours.monday)}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm"
            >
              Apply to Weekends
            </button>
          </div>

          {/* Day-wise Settings */}
          <div className="grid gap-4">
            {(Object.keys(workingHours) as (keyof WeeklyWorkingHours)[]).map((day) => (
              <div
                key={day}
                className="flex items-center gap-4 p-4 bg-gray-700/50 rounded-lg"
              >
                <div className="w-28">
                  <span className="text-white capitalize">{day}</span>
                </div>
                <div className="flex-1 flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={workingHours[day].enabled}
                      onChange={(e) => handleDayChange(day, {
                        ...workingHours[day],
                        enabled: e.target.checked
                      })}
                      className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-300">Enabled</span>
                  </label>
                  <input
                    type="time"
                    value={workingHours[day].startTime}
                    onChange={(e) => handleDayChange(day, {
                      ...workingHours[day],
                      startTime: e.target.value
                    })}
                    disabled={!workingHours[day].enabled}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white disabled:opacity-50"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="time"
                    value={workingHours[day].endTime}
                    onChange={(e) => handleDayChange(day, {
                      ...workingHours[day],
                      endTime: e.target.value
                    })}
                    disabled={!workingHours[day].enabled}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white disabled:opacity-50"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </m.div>
    </div>
  );
};
