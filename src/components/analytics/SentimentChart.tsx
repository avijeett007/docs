'use client';

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { format, parseISO } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface SentimentChartProps {
  data: {
    timestamp: string;
    sentiment_score: number;
    call_id: string;
  }[];
  primaryColor: string;
  secondaryColor: string;
}

const SentimentChart: React.FC<SentimentChartProps> = ({ data, primaryColor, secondaryColor }) => {
  // Process data for the chart
  const chartData = useMemo(() => {
    // Sort data by timestamp
    const sortedData = [...data].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Group data by day
    const groupedByDay = sortedData.reduce((acc, item) => {
      const date = format(parseISO(item.timestamp), 'yyyy-MM-dd');
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(item);
      return acc;
    }, {} as Record<string, typeof data>);

    // Calculate average sentiment score for each day
    const labels = Object.keys(groupedByDay).sort();
    const values = labels.map(date => {
      const dayData = groupedByDay[date];
      const avgScore = dayData.reduce((sum, item) => sum + item.sentiment_score, 0) / dayData.length;
      return avgScore;
    });

    // Format labels for display
    const formattedLabels = labels.map(date => format(parseISO(date), 'MMM d'));

    return {
      labels: formattedLabels,
      datasets: [
        {
          label: 'Average Sentiment Score',
          data: values,
          borderColor: primaryColor,
          backgroundColor: `${primaryColor}33`,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: secondaryColor,
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    };
  }, [data, primaryColor, secondaryColor]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 1,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)'
        }
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)'
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        titleColor: 'rgba(255, 255, 255, 0.9)',
        bodyColor: 'rgba(255, 255, 255, 0.9)',
        displayColors: false,
        callbacks: {
          label: (context: any) => `Sentiment: ${context.raw.toFixed(2)}`
        }
      }
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">No sentiment data available</p>
      </div>
    );
  }

  return <Line data={chartData} options={options as any} />;
};

export default SentimentChart;
