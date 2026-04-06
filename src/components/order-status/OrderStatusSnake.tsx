'use client';

import React, { useState } from 'react';
import { FiCheckCircle } from 'react-icons/fi';

export const statuses = [
  { id: 'submitted', label: 'Submitted', description: 'Initial order received', isSpecial: 'start' },
  { id: 'processing', label: 'Processing', description: 'Order is being processed' },
  { id: 'info-requested', label: 'Additional Info', description: 'We need more information' },
  { id: 'review', label: 'Under Review', description: 'Team is reviewing' },
  { id: 'regulatory-submitted', label: 'Regulatory Submitted', description: 'Sent for approval' },
  { id: 'regulatory-approved', label: 'Regulatory Approved', description: 'Requirements passed' },
  { id: 'agreement', label: 'Agreement Ready', description: 'Contract finalized' },
  { id: 'development', label: 'Development', description: 'System configuration' },
  { id: 'testing', label: 'Testing', description: 'Final review phase' },
  { id: 'live', label: 'Live', description: 'AI agent operational', isSpecial: 'end' }
];

interface StatusPointProps {
  status: typeof statuses[0];
  isActive: boolean;
  isCurrent: boolean;
  position: 'top' | 'bottom';
  isInfoVisible: boolean;
  onHover: (show: boolean) => void;
}

const StatusPoint: React.FC<StatusPointProps> = ({
  status,
  isActive,
  isCurrent,
  position,
  isInfoVisible,
  onHover
}) => {
  return (
    <div className="relative">
      {/* Milestone Point */}
      <div
        className="absolute left-1/2 -translate-x-1/2 cursor-pointer group"
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onClick={() => onHover(!isInfoVisible)}
      >
        {isCurrent && (
          <div className="absolute -inset-4">
            <div className="w-full h-full bg-blue-500/20 rounded-full blur-lg animate-pulse" />
          </div>
        )}
        
        <div className={`
          relative
          ${status.isSpecial ? 'w-8 h-8' : 'w-6 h-6'}
          rounded-full
          ${isCurrent ? 'ring-4 ring-blue-400/50 scale-125' : ''}
          ${isActive ? 'bg-blue-500' : 'bg-gray-600'}
          flex items-center justify-center
          border-2 ${isActive ? 'border-blue-400' : 'border-gray-500'}
          transition-all duration-300
          hover:scale-110 z-20
        `}>
          {isActive && <FiCheckCircle className="text-white text-sm" />}
        </div>

        {/* Label */}
        <div className={`
          absolute left-1/2 -translate-x-1/2 w-32 text-center
          ${position === 'top' ? '-top-8' : 'top-8'}
          z-10
        `}>
          <div className={`text-sm font-medium ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
            {status.label}
          </div>
        </div>

        {/* Hover/Click Info */}
        {isInfoVisible && (
          <div className={`
            absolute left-1/2 -translate-x-1/2 w-48
            ${position === 'top' ? '-top-24' : 'top-20'}
            p-3 rounded-lg bg-gray-800/95 border border-blue-500/20
            transform transition-all duration-200 z-30
            shadow-lg backdrop-blur-sm
          `}>
            <div className="text-sm text-blue-100">
              {status.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface OrderStatusSnakeProps {
  currentStatus?: string;
  className?: string;
}

const OrderStatusSnake: React.FC<OrderStatusSnakeProps> = ({ 
  currentStatus = 'submitted',
  className = ''
}) => {
  const [activeInfo, setActiveInfo] = useState<string | null>(null);
  const currentIndex = statuses.findIndex(s => s.id === currentStatus.toLowerCase());

  return (
    <div className={`relative h-full ${className}`}>
      <div className="w-full relative h-full">
        {/* First Row: [1] → [2] → [3] → [4] */}
        <div className="absolute w-full h-3 bg-gray-700/50 top-16 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(59,130,246,0.2),transparent)] animate-flow-right" />
        </div>
        <div 
          className="absolute h-3 top-16 rounded-full transition-all duration-1000 overflow-hidden"
          style={{ 
            width: `${Math.min((currentIndex + 1) / 4 * 100, 100)}%`,
            opacity: currentIndex >= 0 ? 1 : 0,
            background: 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)'
          }} 
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] animate-flow-right" />
        </div>
        
        {/* First Row Points */}
        <div className="absolute top-16 w-full grid grid-cols-4 -mt-3 z-10">
          {statuses.slice(0, 4).map((status, index) => (
            <StatusPoint 
              key={status.id}
              status={status}
              isActive={index <= currentIndex}
              isCurrent={index === currentIndex}
              position="top"
              isInfoVisible={activeInfo === status.id}
              onHover={(show) => setActiveInfo(show ? status.id : null)}
            />
          ))}
        </div>

        {/* Vertical Connector Right: [4] ↓ */}
        <div className="absolute right-0 w-3 h-32 bg-gray-700/50 top-16 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent,rgba(59,130,246,0.2),transparent)] animate-flow-down" />
        </div>
        {currentIndex >= 3 && (
          <div className="absolute right-0 w-3 h-32 top-16 rounded-full overflow-hidden transition-all duration-1000"
               style={{ background: 'linear-gradient(180deg, #3b82f6, #60a5fa)' }}>
            <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent,rgba(255,255,255,0.2),transparent)] animate-flow-down" />
          </div>
        )}

        {/* Second Row: [8] ← [7] ← [6] ← [5] */}
        <div className="absolute w-full h-3 bg-gray-700/50 top-48 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(59,130,246,0.2),transparent)] animate-flow-left" />
        </div>
        {currentIndex >= 4 && (
          <div 
            className="absolute h-3 top-48 rounded-full transition-all duration-1000 right-0 overflow-hidden"
            style={{ 
              width: `${Math.min((currentIndex - 3) / 4 * 100, 100)}%`,
              background: 'linear-gradient(90deg, #60a5fa, #3b82f6, #2563eb)'
            }} 
          >
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] animate-flow-left" />
          </div>
        )}
        
        <div className="absolute top-48 w-full grid grid-cols-4 -mt-3 z-10">
          {statuses.slice(4, 8).map((status, index) => (
            <StatusPoint 
              key={status.id}
              status={status}
              isActive={index + 4 <= currentIndex}
              isCurrent={index + 4 === currentIndex}
              position="bottom"
              isInfoVisible={activeInfo === status.id}
              onHover={(show) => setActiveInfo(show ? status.id : null)}
            />
          ))}
        </div>

        {/* Vertical Connector Left: [8] ↓ */}
        <div className="absolute left-0 w-3 h-32 bg-gray-700/50 top-48 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent,rgba(59,130,246,0.2),transparent)] animate-flow-down" />
        </div>
        {currentIndex >= 7 && (
          <div className="absolute left-0 w-3 h-32 top-48 rounded-full overflow-hidden transition-all duration-1000"
               style={{ background: 'linear-gradient(180deg, #3b82f6, #60a5fa)' }}>
            <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent,rgba(255,255,255,0.2),transparent)] animate-flow-down" />
          </div>
        )}

        {/* Third Row: [9] → [10] */}
        <div className="absolute w-[50%] h-3 bg-gray-700/50 top-80 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(59,130,246,0.2),transparent)] animate-flow-right" />
        </div>
        {currentIndex >= 8 && (
          <div 
            className="absolute h-3 top-80 rounded-full transition-all duration-1000 overflow-hidden"
            style={{ 
              width: `${Math.min((currentIndex - 7) / 2 * 50, 50)}%`,
              background: 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)'
            }} 
          >
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] animate-flow-right" />
          </div>
        )}
        
        <div className="absolute top-80 w-[50%] grid grid-cols-2 -mt-3 z-10">
          {statuses.slice(8).map((status, index) => (
            <StatusPoint 
              key={status.id}
              status={status}
              isActive={index + 8 <= currentIndex}
              isCurrent={index + 8 === currentIndex}
              position="top"
              isInfoVisible={activeInfo === status.id}
              onHover={(show) => setActiveInfo(show ? status.id : null)}
            />
          ))}
        </div>

        {/* Animation Styles */}
        <style jsx>{`
          @keyframes flow-right {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes flow-left {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          @keyframes flow-down {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100%); }
          }
          .animate-flow-right {
            animation: flow-right 2s linear infinite;
          }
          .animate-flow-left {
            animation: flow-left 2s linear infinite;
          }
          .animate-flow-down {
            animation: flow-down 2s linear infinite;
          }
        `}</style>
      </div>
    </div>
  );
};

export default OrderStatusSnake;
