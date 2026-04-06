'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  FiDollarSign,
  FiTrendingUp,
  FiUsers,
  FiCheck,
  FiClock,
  FiAlertCircle,
  FiX,
  FiCalendar
} from 'react-icons/fi';

interface BillingStats {
  totalRevenue: number;
  monthlyRevenue: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  averageInvoiceValue: number;
  paymentRate: number;
}

interface BillingStatsCardsProps {
  stats: BillingStats;
  isLoading?: boolean;
}

export default function BillingStatsCards({ stats, isLoading = false }: BillingStatsCardsProps) {
  const formatAmount = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
        ease: "easeOut"
      }
    })
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-900/50 rounded-xl p-6 border border-gray-800 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 bg-gray-700 rounded w-20"></div>
                <div className="h-8 bg-gray-700 rounded w-16"></div>
              </div>
              <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const mainStats = [
    {
      title: 'Total Revenue',
      value: formatAmount(stats.totalRevenue),
      icon: FiDollarSign,
      color: 'green',
      bgColor: 'bg-green-500/20',
      textColor: 'text-green-400',
    },
    {
      title: 'This Month',
      value: formatAmount(stats.monthlyRevenue),
      icon: FiTrendingUp,
      color: 'blue',
      bgColor: 'bg-blue-500/20',
      textColor: 'text-blue-400',
    },
    {
      title: 'Total Invoices',
      value: stats.totalInvoices.toString(),
      icon: FiUsers,
      color: 'purple',
      bgColor: 'bg-purple-500/20',
      textColor: 'text-purple-400',
    },
    {
      title: 'Payment Rate',
      value: formatPercentage(stats.paymentRate),
      icon: FiCheck,
      color: 'teal',
      bgColor: 'bg-teal-500/20',
      textColor: 'text-teal-400',
    },
  ];

  const detailStats = [
    {
      title: 'Paid Invoices',
      value: stats.paidInvoices,
      icon: FiCheck,
      color: 'text-green-400',
    },
    {
      title: 'Pending Invoices',
      value: stats.pendingInvoices,
      icon: FiClock,
      color: 'text-blue-400',
    },
    {
      title: 'Overdue Invoices',
      value: stats.overdueInvoices,
      icon: FiAlertCircle,
      color: 'text-red-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mainStats.map((stat, index) => (
          <motion.div
            key={stat.title}
            custom={index}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="bg-gray-900/50 rounded-xl p-6 border border-gray-800 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">{stat.title}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                
                {/* Additional context for some stats */}
                {stat.title === 'Total Revenue' && stats.totalInvoices > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Avg: {formatAmount(stats.averageInvoiceValue)}
                  </p>
                )}
                {stat.title === 'This Month' && (
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              <div className={`p-3 ${stat.bgColor} rounded-lg`}>
                <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {detailStats.map((stat, index) => (
          <motion.div
            key={stat.title}
            custom={index + 4}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <span className="text-gray-400 font-medium">{stat.title}</span>
              </div>
              <span className={`font-semibold ${stat.color}`}>{stat.value}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Additional Insights */}
      {stats.totalInvoices > 0 && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          custom={7}
          className="bg-gray-900/50 rounded-xl p-6 border border-gray-800"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FiCalendar className="w-5 h-5 text-blue-400" />
            Quick Insights
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400">Average Invoice Value</div>
              <div className="text-xl font-bold text-white">{formatAmount(stats.averageInvoiceValue)}</div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400">Collection Rate</div>
              <div className="text-xl font-bold text-white">{formatPercentage(stats.paymentRate)}</div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400">Outstanding Amount</div>
              <div className="text-xl font-bold text-white">
                {formatAmount((stats.pendingInvoices + stats.overdueInvoices) * stats.averageInvoiceValue)}
              </div>
            </div>
          </div>

          {/* Alerts */}
          {stats.overdueInvoices > 0 && (
            <div className="mt-4 p-3 bg-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
              <FiAlertCircle className="w-4 h-4" />
              <span className="text-sm">
                {stats.overdueInvoices} invoice{stats.overdueInvoices > 1 ? 's' : ''} overdue - 
                consider sending payment reminders
              </span>
            </div>
          )}

          {stats.paymentRate < 50 && stats.totalInvoices > 5 && (
            <div className="mt-2 p-3 bg-yellow-500/20 text-amber-400 rounded-lg flex items-center gap-2">
              <FiAlertCircle className="w-4 h-4" />
              <span className="text-sm">
                Low payment rate ({formatPercentage(stats.paymentRate)}) - 
                consider reviewing your invoicing process
              </span>
            </div>
          )}

          {stats.paymentRate > 90 && stats.totalInvoices > 10 && (
            <div className="mt-2 p-3 bg-green-500/20 text-green-400 rounded-lg flex items-center gap-2">
              <FiCheck className="w-4 h-4" />
              <span className="text-sm">
                Excellent payment rate ({formatPercentage(stats.paymentRate)})! 
                Your customers are paying promptly.
              </span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
