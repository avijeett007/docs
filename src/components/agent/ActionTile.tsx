import React from 'react';
import { motion as m } from 'framer-motion';
import { FiPhone, FiCode, FiEdit2, FiTrash2 } from 'react-icons/fi';

interface ActionTileProps {
  action: {
    id: string;
    type: 'transfer' | 'function';
    name: string;
    condition: string;
    message: string;
    phoneNumber?: string;
    countryCode?: string;
    toolId: string;
    toolName: string;
  };
  onEdit: (action: any) => void;
  onDelete: (id: string) => void;
}

export const ActionTile: React.FC<ActionTileProps> = ({
  action,
  onEdit,
  onDelete
}) => {
  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className={`p-2 rounded-lg ${
            action.type === 'transfer' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'
          }`}>
            {action.type === 'transfer' ? (
              <FiPhone className="w-5 h-5" />
            ) : (
              <FiCode className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="font-medium text-white">{action.name}</h3>
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{action.condition}</p>
          </div>
        </div>
        <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(action)}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="Edit action"
          >
            <FiEdit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(action.id)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            title="Delete action"
          >
            <FiTrash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-700">
        <p className="text-sm text-gray-400">
          {action.type === 'transfer' ? (
            <>Transfer to: <span className="text-white">{action.countryCode} {action.phoneNumber}</span></>
          ) : (
            <>Function: <span className="text-white">{action.toolName}</span></>
          )}
        </p>
      </div>
    </m.div>
  );
};
