import React from 'react';
import { OrderStatus } from '@/types/pricing';
import { FiCheckCircle, FiXCircle, FiClock, FiAlertCircle } from 'react-icons/fi';

const statusConfig: Record<OrderStatus, { color: string; progress: number; icon: React.ReactNode }> = {
  'Submitted': { color: 'blue', progress: 10, icon: <FiClock /> },
  'Processing': { color: 'blue', progress: 20, icon: <FiClock /> },
  'Additional Info Requested': { color: 'yellow', progress: 30, icon: <FiAlertCircle /> },
  'Under Review': { color: 'blue', progress: 40, icon: <FiClock /> },
  'Regulatory approval submitted': { color: 'purple', progress: 50, icon: <FiClock /> },
  'Regulatory approval completed': { color: 'purple', progress: 60, icon: <FiCheckCircle /> },
  'Business Agreement Established': { color: 'green', progress: 70, icon: <FiCheckCircle /> },
  'Under Development': { color: 'blue', progress: 80, icon: <FiClock /> },
  'System under review': { color: 'yellow', progress: 90, icon: <FiAlertCircle /> },
  'Voice AI Agent Live': { color: 'green', progress: 100, icon: <FiCheckCircle /> }
};

interface StatusSelectorProps {
  currentStatus: OrderStatus;
  onStatusChange: (newStatus: OrderStatus) => void;
}

export default function StatusSelector({ currentStatus, onStatusChange }: StatusSelectorProps) {
  // Set default status if currentStatus is undefined
  const status = currentStatus || 'Submitted';
  const config = statusConfig[status];

  if (!config) {
    console.error(`Invalid status: ${status}`);
    return null;
  }

  return (
    <div className="relative">
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as OrderStatus)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {Object.entries(statusConfig).map(([status, config]) => (
          <option key={status} value={status}>
            {status} ({config.progress}%)
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        {config.icon}
      </div>
    </div>
  );
}
