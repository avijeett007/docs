'use client';

import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';

interface ConnectionLineProps {
  id: string;
  sourcePosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  isSelected: boolean;
  isTemporary?: boolean;
  onDelete: () => void;
}

export default function ConnectionLine({
  id,
  sourcePosition,
  targetPosition,
  isSelected,
  isTemporary = false,
  onDelete
}: ConnectionLineProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate control points for smooth bezier curve (N8N style)
  const dx = targetPosition.x - sourcePosition.x;
  const dy = targetPosition.y - sourcePosition.y;

  // Control point offset based on distance (more dynamic like N8N)
  const minOffset = 50;
  const dynamicOffset = Math.abs(dx) * 0.5;
  const controlOffset = Math.max(minOffset, Math.min(dynamicOffset, 200));

  // Adjust control points for better curves
  const sourceControlX = sourcePosition.x + controlOffset;
  const sourceControlY = sourcePosition.y;
  const targetControlX = targetPosition.x - controlOffset;
  const targetControlY = targetPosition.y;

  // Create SVG path for bezier curve
  const pathData = `M ${sourcePosition.x} ${sourcePosition.y} C ${sourceControlX} ${sourceControlY}, ${targetControlX} ${targetControlY}, ${targetPosition.x} ${targetPosition.y}`;

  // Calculate midpoint for delete button
  const midX = (sourcePosition.x + targetPosition.x) / 2;
  const midY = (sourcePosition.y + targetPosition.y) / 2;

  const strokeColor = isTemporary
    ? '#3b82f6' // Blue for temporary connections
    : isSelected
      ? '#10b981' // Green for selected
      : isHovered
        ? '#f59e0b' // Amber for hovered
        : '#6b7280'; // Gray for normal

  const strokeWidth = isTemporary
    ? 2
    : isSelected
      ? 3
      : isHovered
        ? 2.5
        : 2;

  const strokeOpacity = isTemporary ? 0.8 : 1;

  return (
    <g>
      {/* Invisible wider path for easier hover detection */}
      <path
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeWidth="12"
        className="cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      
      {/* Shadow for depth */}
      {!isTemporary && (
        <path
          d={pathData}
          fill="none"
          stroke="black"
          strokeWidth={strokeWidth + 2}
          opacity="0.1"
          className="pointer-events-none"
          transform="translate(0, 2)"
        />
      )}
      
      {/* Visible connection line */}
      <path
        d={pathData}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDasharray={isTemporary ? "8,4" : "none"}
        strokeLinecap="round"
        className={`transition-all duration-200 ${!isTemporary ? 'pointer-events-none' : ''}`}
        markerEnd={`url(#arrowhead-${id})`}
      />

      {/* Arrow marker definition */}
      <defs>
        <marker
          id={`arrowhead-${id}`}
          markerWidth="12"
          markerHeight="10"
          refX="11"
          refY="5"
          orient="auto"
        >
          <path
            d="M 0 0 L 12 5 L 0 10 L 3 5 Z"
            fill={strokeColor}
            opacity={strokeOpacity}
            className="transition-all duration-200"
          />
        </marker>
      </defs>

      {/* Delete button - only show when hovered and not temporary */}
      {isHovered && !isTemporary && (
        <g>
          {/* Button background with better visibility */}
          <circle
            cx={midX}
            cy={midY}
            r="14"
            fill="#1F2937"
            stroke="#6b7280"
            strokeWidth="2"
            className="cursor-pointer transition-all hover:r-16"
          />
          
          {/* Delete icon */}
          <foreignObject
            x={midX - 7}
            y={midY - 7}
            width="14"
            height="14"
            className="pointer-events-none"
          >
            <div className="flex items-center justify-center w-full h-full">
              <FiX className="w-4 h-4 text-red-400" />
            </div>
          </foreignObject>
          
          {/* Clickable area for delete */}
          <circle
            cx={midX}
            cy={midY}
            r="14"
            fill="transparent"
            className="cursor-pointer hover:fill-red-500 hover:fill-opacity-20 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          />
        </g>
      )}

      {/* Connection info on hover */}
      {isHovered && !isTemporary && (
        <g>
          <rect
            x={midX - 40}
            y={midY - 30}
            width="80"
            height="20"
            rx="4"
            fill="#1F2937" // gray-800
            stroke="#374151" // gray-700
            strokeWidth="1"
            opacity="0.9"
          />
          <text
            x={midX}
            y={midY - 16}
            textAnchor="middle"
            className="text-xs fill-gray-300 pointer-events-none"
            fontSize="10"
          >
            Connection
          </text>
        </g>
      )}
    </g>
  );
}
