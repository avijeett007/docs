'use client';

import React from 'react';
import { Pie } from 'react-chartjs-2';
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

interface TopicsChartProps {
  data: {
    topic: string;
    count: number;
  }[];
  primaryColor: string;
  secondaryColor: string;
}

const TopicsChart: React.FC<TopicsChartProps> = ({ data, primaryColor, secondaryColor }) => {
  // Generate colors based on primary and secondary colors
  const generateColors = (count: number) => {
    const colors = [];
    const backgroundColors = [];
    
    // Convert hex to RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 0, b: 0 };
    };
    
    const primary = hexToRgb(primaryColor);
    const secondary = hexToRgb(secondaryColor);
    
    for (let i = 0; i < count; i++) {
      const ratio = i / (count - 1);
      
      // Interpolate between primary and secondary colors
      const r = Math.round(primary.r + ratio * (secondary.r - primary.r));
      const g = Math.round(primary.g + ratio * (secondary.g - primary.g));
      const b = Math.round(primary.b + ratio * (secondary.b - primary.b));
      
      colors.push(`rgb(${r}, ${g}, ${b})`);
      backgroundColors.push(`rgba(${r}, ${g}, ${b}, 0.8)`);
    }
    
    return { colors, backgroundColors };
  };

  // Format topic names for better display
  const formatTopic = (topic: string) => {
    return topic
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Limit to top 10 topics and sort by count
  const topTopics = [...data]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const { colors, backgroundColors } = generateColors(topTopics.length);

  const chartData = {
    labels: topTopics.map(item => formatTopic(item.topic)),
    datasets: [
      {
        data: topTopics.map(item => item.count),
        backgroundColor: backgroundColors,
        borderColor: colors,
        borderWidth: 1
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: 11
          },
          padding: 15
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        titleColor: 'rgba(255, 255, 255, 0.9)',
        bodyColor: 'rgba(255, 255, 255, 0.9)',
        callbacks: {
          label: (context: any) => `Count: ${context.raw}`
        }
      }
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">No topic data available</p>
      </div>
    );
  }

  return <Pie data={chartData} options={options as any} />;
};

export default TopicsChart;
