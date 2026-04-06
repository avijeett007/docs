import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiEdit2, FiTrash2, FiCpu, FiPhone, FiGlobe, FiCode, FiCopy, FiCheck, FiX } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import Tooltip from '@/components/ui/Tooltip';
import type { AgentData } from '@/types/agent';

interface AgentCardProps {
  agent: AgentData;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onEdit, onDelete }) => {
  const [showEmbedCode, setShowEmbedCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const getTypeIcon = () => {
    switch (agent.type) {
      case 'inbound_phone':
      case 'outbound_phone':
        return <FiPhone className="w-4 h-4" />;
      case 'website':
        return <FiGlobe className="w-4 h-4" />;
      default:
        return <FiCpu className="w-4 h-4" />;
    }
  };

  const getStatusColor = () => {
    switch (agent.status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'draft':
        return 'bg-yellow-500/20 text-amber-400 border-yellow-500/30';
      case 'inactive':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const handleCopyEmbedCode = async () => {
    if (agent.settings?.widgetConfig?.embedCode) {
      try {
        await navigator.clipboard.writeText(agent.settings.widgetConfig.embedCode);
        setCopied(true);
        toast.success('Embed code copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy embed code:', error);
        toast.error('Failed to copy embed code');
      }
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-lg shadow-sm border border-gray-700 hover:border-blue-500/30 transition-all duration-300 p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">{agent.name}</h3>
          <p className="text-sm text-gray-400">{agent.businessName}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Tooltip content="Edit Agent">
            <button
              onClick={() => onEdit(agent.id)}
              className="p-1 text-gray-400 hover:text-blue-400"
            >
              <FiEdit2 className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Delete Agent">
            <button
              onClick={() => onDelete(agent.id)}
              className="p-1 text-gray-400 hover:text-red-400"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center space-x-4 mb-4">
        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor()}`}>
          {agent.status}
        </span>
        <span className="flex items-center text-sm text-gray-400">
          {getTypeIcon()}
          <span className="ml-1">{agent.type}</span>
        </span>
      </div>

      {agent.channels?.website && agent.settings?.widgetConfig && (
        <div className="mt-4 border-t border-gray-700 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">Widget Embed Code</span>
            <div className="flex items-center space-x-2">
              <Tooltip content={showEmbedCode ? 'Hide Code' : 'Show Code'}>
                <button
                  onClick={() => setShowEmbedCode(!showEmbedCode)}
                  className="p-1 text-gray-400 hover:text-blue-400"
                >
                  {showEmbedCode ? <FiX className="w-4 h-4" /> : <FiCode className="w-4 h-4" />}
                </button>
              </Tooltip>
              {showEmbedCode && (
                <Tooltip content="Copy Code">
                  <button
                    onClick={handleCopyEmbedCode}
                    className="p-1 text-gray-400 hover:text-blue-400"
                  >
                    {copied ? <FiCheck className="w-4 h-4 text-green-500" /> : <FiCopy className="w-4 h-4" />}
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
          <AnimatePresence>
            {showEmbedCode && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <pre className="text-xs bg-gray-900/50 p-3 rounded-md overflow-x-auto border border-gray-700 text-gray-300">
                  <code>{agent.settings.widgetConfig.embedCode}</code>
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
