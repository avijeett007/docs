import React from 'react';
import { OrderStatus as OrderStatusType } from '@/types/pricing';

interface OrderStatusProps {
  status: OrderStatusType;
}

const statusConfig: Record<OrderStatusType, { color: string; progress: number }> = {
  'Submitted': { color: 'blue', progress: 10 },
  'Processing': { color: 'blue', progress: 20 },
  'Additional Info Requested': { color: 'yellow', progress: 30 },
  'Under Review': { color: 'blue', progress: 40 },
  'Regulatory approval submitted': { color: 'purple', progress: 50 },
  'Regulatory approval completed': { color: 'purple', progress: 60 },
  'Business Agreement Established': { color: 'green', progress: 70 },
  'Under Development': { color: 'blue', progress: 80 },
  'System under review': { color: 'yellow', progress: 90 },
  'Voice AI Agent Live': { color: 'green', progress: 100 }
};

const OrderStatus: React.FC<OrderStatusProps> = ({ status }) => {
  const config = statusConfig[status];
  
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-blue-100/70">Order Status</span>
        <span className={`text-sm font-medium text-${config.color}-400`}>{status}</span>
      </div>
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full bg-${config.color}-500 transition-all duration-500 ease-out`}
          style={{ width: `${config.progress}%` }}
        />
      </div>
    </div>
  );
};

export default OrderStatus;
