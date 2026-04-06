'use client';

import React from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface CallData {
  day: string;
  calls: number;
}

interface CallVolumeChartProps {
  data: CallData[];
}

const CallVolumeChart: React.FC<CallVolumeChartProps> = ({ data }) => {
  const { branding } = usePartnerBranding();
  const maxCalls = Math.max(...data.map(d => d.calls), 1); // Use actual max, minimum 1 to avoid division by zero

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-sm">No call data available</div>
          <div className="text-gray-500 text-xs mt-1">Call volume will appear here once data is available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-64 flex flex-col">
      <div className="flex-1 flex items-end justify-center space-x-2 px-4">
        {data.map((item, index) => {
          const hasData = item.calls > 0;
          const heightPercentage = hasData ? Math.max((item.calls / maxCalls) * 90, 8) : 2; // Minimum 8% for data, 2% for no data

          return (
            <div key={index} className="flex flex-col items-center justify-end flex-1 max-w-16">
              {/* Call count display above bar */}
              <div className="mb-1 h-6 flex items-end">
                {hasData && (
                  <div className="text-xs font-medium text-white bg-gray-800 px-2 py-1 rounded">
                    {item.calls}
                  </div>
                )}
              </div>

              {/* Bar */}
              <div
                className="w-full rounded-t-md transition-all duration-500 hover:opacity-80 relative"
                style={{
                  height: `${heightPercentage}%`,
                  backgroundColor: hasData ? (branding.primaryColor || '#3b82f6') : '#374151',
                  opacity: hasData ? 1 : 0.3,
                  minHeight: hasData ? '8px' : '2px'
                }}
              />

              {/* Day label */}
              <div className="text-xs text-gray-400 mt-2 font-medium">{item.day}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex justify-between">
        <div className="text-xs text-gray-400">Total Calls: {data.reduce((sum, item) => sum + item.calls, 0)}</div>
        <div className="text-xs text-gray-400">
          Avg: {(data.reduce((sum, item) => sum + item.calls, 0) / data.length).toFixed(1)} calls/day
        </div>
      </div>
    </div>
  );
};

export default CallVolumeChart;
