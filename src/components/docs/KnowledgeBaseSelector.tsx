import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiCheck, FiSearch, FiMove } from 'react-icons/fi';
import Draggable from 'react-draggable';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  version: string;
  autoEmbed: boolean;
  isEmbed: string | null;
  reEmbed: boolean;
}

interface KnowledgeBaseSelectorProps {
  knowledgeBases: KnowledgeBase[];
  selectedKnowledgeBases: KnowledgeBase[];
  onKnowledgeBasesChange: (knowledgeBases: KnowledgeBase[]) => void;
}

export default function KnowledgeBaseSelector({
  knowledgeBases,
  selectedKnowledgeBases,
  onKnowledgeBasesChange,
}: KnowledgeBaseSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
        setPosition({ x: 0, y: 0 });
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleKnowledgeBase = (kb: KnowledgeBase) => {
    const isSelected = selectedKnowledgeBases.some(selected => selected.id === kb.id);
    if (isSelected) {
      onKnowledgeBasesChange(selectedKnowledgeBases.filter(selected => selected.id !== kb.id));
    } else {
      onKnowledgeBasesChange([...selectedKnowledgeBases, kb]);
    }
  };

  const filteredKnowledgeBases = knowledgeBases.filter(kb => 
    kb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    kb.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitialPosition = () => {
    if (!containerRef.current) return { x: 0, y: 0 };

    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(300, filteredKnowledgeBases.length * 60 + 50);

    return {
      x: 0,
      y: spaceBelow >= dropdownHeight ? 4 : -dropdownHeight - 4,
    };
  };

  const handleDragStart = () => {
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  };

  const handleDragStop = (e: any, data: { x: number; y: number }) => {
    setPosition({ x: data.x, y: data.y });
  };

  return (
    <div ref={containerRef} className="relative min-w-[200px]">
      <div
        onClick={() => {
          if (!isOpen) {
            setPosition(getInitialPosition());
          }
          setIsOpen(!isOpen);
        }}
        className="min-h-[2.5rem] px-3 py-1 bg-gray-700/50 border border-gray-600 rounded-lg cursor-pointer hover:bg-gray-700/70 transition-colors"
      >
        {selectedKnowledgeBases.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selectedKnowledgeBases.map((kb) => (
              <span
                key={kb.id}
                className="inline-flex items-center px-2 py-0.5 rounded bg-gray-600 text-sm text-white"
              >
                {kb.name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-400">Select knowledge bases...</span>
        )}
      </div>

      {isOpen && (
        <Draggable
          handle=".drag-handle"
          position={position}
          onStart={handleDragStart}
          onStop={handleDragStop}
        >
          <div
            ref={dropdownRef}
            style={{ zIndex: 1000 }}
            className="absolute left-0 w-[300px] bg-gray-800 border border-gray-600 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="flex items-center justify-between p-2 border-b border-gray-700 bg-gray-750">
              <div className="flex-grow px-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search knowledge bases..."
                  className="w-full bg-gray-700 text-white px-3 py-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="drag-handle cursor-move px-2">
                <FiMove className="text-gray-400" />
              </div>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto">
              {filteredKnowledgeBases.length > 0 ? (
                filteredKnowledgeBases.map((kb) => {
                  const isSelected = selectedKnowledgeBases.some(
                    (selected) => selected.id === kb.id
                  );
                  return (
                    <div
                      key={kb.id}
                      onClick={() => toggleKnowledgeBase(kb)}
                      className="flex items-center justify-between px-4 py-2 hover:bg-gray-700 cursor-pointer"
                    >
                      <div className="flex-grow">
                        <div className="text-white">{kb.name}</div>
                        <div className="text-sm text-gray-400">{kb.description}</div>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        {isSelected ? (
                          <FiCheck className="text-green-500" />
                        ) : (
                          <div className="w-4 h-4 border border-gray-500 rounded" />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-gray-400">
                  No knowledge bases found
                </div>
              )}
            </div>
          </div>
        </Draggable>
      )}
    </div>
  );
}
