import React, { useState } from 'react';
import Image from 'next/image';
import { ToolMetadata } from '@/types/plugin';
import { FiExternalLink } from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface ToolCardProps {
  tool: ToolMetadata;
  onConnect: () => void;
  isConnecting?: boolean;
}

export const ToolCard: React.FC<ToolCardProps> = ({
  tool,
  onConnect,
  isConnecting = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const { branding, getButtonStyles } = usePartnerBranding();

  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <div className="relative w-10 h-10 mr-3 bg-gray-700 rounded-lg overflow-hidden">
            <Image
              src={imageError ? '/images/default-tool-icon.svg' : tool.icon}
              alt={tool.name}
              width={40}
              height={40}
              className="rounded-lg object-contain"
              onError={() => setImageError(true)}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{tool.name}</h3>
            <span className="text-xs text-gray-400">v{tool.version}</span>
          </div>
        </div>
        <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
          {tool.category}
        </span>
      </div>
      
      <p className="text-sm text-gray-300 mb-4 flex-grow">
        {tool.description}
      </p>
      
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center space-x-2">
          {tool.documentation && (
            <a
              href={tool.documentation}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 hover:text-white flex items-center"
            >
              Docs <FiExternalLink className="ml-1" />
            </a>
          )}
        </div>
        
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="px-4 py-2 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={getButtonStyles()}
        >
          {isConnecting ? 'Connecting...' : 'Connect'}
        </button>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="flex items-center text-xs text-gray-400">
          <span className={`w-2 h-2 rounded-full mr-2 ${
            tool.provider === 'official' ? 'bg-green-400' : 'bg-yellow-400'
          }`} />
          {tool.provider === 'official' ? 'Official' : 'Community'} •{' '}
          {tool.publisher.name}
        </div>
      </div>
    </div>
  );
};
