'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiXCircle, FiClock, FiEdit2 } from 'react-icons/fi';

interface CustomerHomeViewProps {
  customerData: {
    firstName: string;
    lastName: string;
    companyName: string;
    email: string;
    monthlyCallVolume: string;
    estimatedPrice: number;
    priceBreakdown: string;
    orderStatus: string;
  };
  onBack: () => void;
  allowEdit?: boolean;
  onEdit?: () => void;
}

export default function CustomerHomeView({ customerData, onBack, allowEdit, onEdit }: CustomerHomeViewProps) {
  let priceBreakdown;
  try {
    priceBreakdown = customerData.priceBreakdown ? JSON.parse(customerData.priceBreakdown) : {
      platformFee: 0,
      voiceAICost: 0,
      telephonyCost: 0,
      emailCost: 0,
      smsCost: 0
    };
  } catch (error) {
    console.error('Error parsing price breakdown:', error);
    priceBreakdown = {
      platformFee: 0,
      voiceAICost: 0,
      telephonyCost: 0,
      emailCost: 0,
      smsCost: 0
    };
  }

  return (
    <div className="text-white p-8">
      <div className="grid gap-8">
        {/* Customer Info */}
        <div className="bg-gray-800/50 rounded-xl p-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl font-bold text-white">
              {customerData.companyName || `${customerData.firstName} ${customerData.lastName}`}
            </h1>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2
                ${customerData.orderStatus === 'PENDING' ? 'bg-yellow-400/20 text-amber-400' :
                  customerData.orderStatus === 'APPROVED' ? 'bg-green-400/20 text-green-400' :
                  'bg-gray-400/20 text-gray-400'}`}>
                {customerData.orderStatus === 'APPROVED' ? (
                  <FiCheckCircle className="w-4 h-4" />
                ) : customerData.orderStatus === 'REJECTED' ? (
                  <FiXCircle className="w-4 h-4" />
                ) : (
                  <FiClock className="w-4 h-4" />
                )}
                <span>{customerData.orderStatus}</span>
              </div>
              {allowEdit && onEdit && (
                <button
                  onClick={onEdit}
                  className="text-blue-400 hover:text-blue-300 transition-colors text-sm flex items-center gap-2"
                >
                  <FiEdit2 className="w-4 h-4" />
                  Edit Customer Information
                </button>
              )}
            </div>
          </div>
          <p className="text-gray-300">
            Email: {customerData.email}
          </p>
          <p className="text-gray-300 mt-2">
            Monthly Call Volume: {customerData.monthlyCallVolume}
          </p>
        </div>

        {/* Pricing Information */}
        <div className="bg-gray-800/50 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Pricing Breakdown</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 p-4 bg-gray-700/50 rounded-lg">
              <div className="text-lg font-semibold text-gray-300">Total Estimated Cost</div>
              <div className="text-3xl font-bold text-white">
                ${(customerData.estimatedPrice ?? 0).toLocaleString()}/month
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gray-700/30 rounded-lg">
                <div className="text-sm text-gray-400">Platform Fee</div>
                <div className="text-lg font-semibold">${priceBreakdown.platformFee}</div>
              </div>
              <div className="p-4 bg-gray-700/30 rounded-lg">
                <div className="text-sm text-gray-400">Voice AI Cost</div>
                <div className="text-lg font-semibold">${priceBreakdown.voiceAICost}</div>
              </div>
              <div className="p-4 bg-gray-700/30 rounded-lg">
                <div className="text-sm text-gray-400">Telephony Cost</div>
                <div className="text-lg font-semibold">${priceBreakdown.telephonyCost}</div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gray-700/30 rounded-lg">
                <div className="text-sm text-gray-400">Email Cost</div>
                <div className="text-lg font-semibold">${priceBreakdown.emailCost}</div>
              </div>
              <div className="p-4 bg-gray-700/30 rounded-lg">
                <div className="text-sm text-gray-400">SMS Cost</div>
                <div className="text-lg font-semibold">${priceBreakdown.smsCost}</div>
              </div>
              <div className="p-4 bg-gray-700/30 rounded-lg">
                <div className="text-sm text-gray-400">Status</div>
                <div className={`text-lg font-semibold ${
                  customerData.orderStatus === 'PENDING' ? 'text-amber-400' :
                  customerData.orderStatus === 'APPROVED' ? 'text-green-400' :
                  'text-gray-400'
                }`}>
                  {customerData.orderStatus}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
