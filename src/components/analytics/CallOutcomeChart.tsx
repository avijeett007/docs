'use client';

import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

interface CallOutcomeChartProps {
  data: {
    successful: number;
    follow_up_needed: number;
    unsuccessful: number;
  };
  primaryColor: string;
  secondaryColor: string;
}

const CallOutcomeChart: React.FC<CallOutcomeChartProps> = ({ data }) => {
  const chartData = {
    labels: ['Successful', 'Follow-up Needed', 'Unsuccessful'],
    datasets: [
      {
        data: [
          data.successful || 0,
          data.follow_up_needed || 0,
          data.unsuccessful || 0
        ],
        backgroundColor: [
          '#10B981', // Green for successful
          '#F59E0B', // Amber for follow-up
          '#EF4444'  // Red for unsuccessful
        ],
        borderColor: [
          '#059669',
          '#D97706',
          '#DC2626'
        ],
        borderWidth: 1
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        titleColor: 'rgba(255, 255, 255, 0.9)',
        bodyColor: 'rgba(255, 255, 255, 0.9)',
        callbacks: {
          label: (context: any) => {
            const total = data.successful + data.follow_up_needed + data.unsuccessful;
            const percentage = Math.round((context.raw / total) * 100);
            return `${context.label}: ${context.raw} (${percentage}%)`;
          }
        }
      }
    }
  };

  const total = data.successful + data.follow_up_needed + data.unsuccessful;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">No call outcome data available</p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <Doughnut data={chartData} options={options as any} />
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <div className="text-3xl font-bold text-white">{total}</div>
        <div className="text-sm text-gray-400">Total Calls</div>
      </div>
    </div>
  );
};

export default CallOutcomeChart;
