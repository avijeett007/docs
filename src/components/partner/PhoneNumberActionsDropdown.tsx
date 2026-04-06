import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiMoreVertical, FiUser, FiPhone, FiUserX, FiPhoneOff, FiTrash2 } from 'react-icons/fi';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  provider: string;
  isAssigned: boolean;
  hasAgentAssignment: boolean;
  isImported: boolean;
  agentMappings?: Array<{
    agentProvider: string;
    agentName: string | null;
    status: string;
  }>;
}

interface PhoneNumberActionsDropdownProps {
  phoneNumber: PhoneNumber;
  onAssignCustomer: () => void;
  onReassignCustomer: () => void;
  onUnassignCustomer: () => void;
  onAssignAgent: () => void;
  onReassignAgent: () => void;
  onUnassignAgent: () => void;
  onDeletePhoneNumber: () => void;
}

export default function PhoneNumberActionsDropdown({
  phoneNumber,
  onAssignCustomer,
  onReassignCustomer,
  onUnassignCustomer,
  onAssignAgent,
  onReassignAgent,
  onUnassignAgent,
  onDeletePhoneNumber
}: PhoneNumberActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAbove, setShowAbove] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      // Check if click is outside both the button and the dropdown
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleScroll() {
      // Close dropdown on scroll to prevent misalignment
      setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true); // Use capture to catch all scroll events
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const handleToggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 320; // max-h-80 = 20rem = 320px
      const viewportHeight = window.innerHeight;

      // Check if dropdown would be cut off at the bottom
      const spaceBelow = viewportHeight - buttonRect.bottom;
      const shouldShowAbove = spaceBelow < dropdownHeight + 20; // 20px buffer

      setShowAbove(shouldShowAbove);

      // Calculate position for fixed positioning
      setDropdownPosition({
        top: shouldShowAbove ? buttonRect.top - 8 : buttonRect.bottom + 8,
        right: window.innerWidth - buttonRect.right
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={handleToggleDropdown}
        className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
        aria-label="More actions"
      >
        <FiMoreVertical className="w-4 h-4" />
      </button>

      {isOpen && createPortal(
        <div
          className="fixed w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-[99999] max-h-80 overflow-y-auto"
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
            transform: showAbove ? 'translateY(-100%)' : 'none',
            minWidth: '12rem' // Ensure minimum width
          }}
          ref={dropdownRef}
        >
          <div className="py-1">
            {/* Customer Assignment Actions */}
            {!phoneNumber.isAssigned ? (
              <button
                onClick={() => handleAction(onAssignCustomer)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-blue-400 hover:bg-gray-700 transition-colors"
              >
                <FiUser className="w-4 h-4" />
                Assign Customer
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleAction(onReassignCustomer)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 transition-colors"
                >
                  <FiUserX className="w-4 h-4" />
                  Reassign Customer
                </button>
                <button
                  onClick={() => handleAction(onUnassignCustomer)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                >
                  <FiUserX className="w-4 h-4" />
                  Unassign Customer
                </button>
              </>
            )}

            {/* Agent Assignment Actions - For all Twilio and Telnyx numbers */}
            {(['imported_twilio', 'imported_telnyx', 'twilio', 'telnyx'].includes(phoneNumber.provider)) && (
              <>
                <div className="border-t border-gray-700 my-1"></div>

                {!phoneNumber.hasAgentAssignment ? (
                  <button
                    onClick={() => handleAction(onAssignAgent)}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-400 hover:bg-gray-700 transition-colors"
                  >
                    <FiPhone className="w-4 h-4" />
                    Assign Agent
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleAction(onReassignAgent)}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-yellow-400 hover:bg-gray-700 transition-colors"
                    >
                      <FiPhone className="w-4 h-4" />
                      Reassign Agent
                    </button>
                    <button
                      onClick={() => handleAction(onUnassignAgent)}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                    >
                      <FiPhoneOff className="w-4 h-4" />
                      Unassign Agent
                    </button>
                  </>
                )}
              </>
            )}

            {/* Delete Phone Number - Only for imported numbers that are not assigned */}
            {(phoneNumber.isImported || phoneNumber.provider.startsWith('imported_')) &&
             !phoneNumber.isAssigned &&
             !phoneNumber.hasAgentAssignment && (
              <>
                <div className="border-t border-gray-700 my-1"></div>
                <button
                  onClick={() => handleAction(onDeletePhoneNumber)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                  Delete Phone Number
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
