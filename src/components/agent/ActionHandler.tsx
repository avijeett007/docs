import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ActionModal } from './ActionModal';

interface ActionHandlerProps {
  showActionModal: boolean;
  actionModalType: 'transfer' | 'function';
  editingAction: any;
  onClose: () => void;
  onActionSave: (actionData: any) => void;
  onActionSelect: (type: 'transfer' | 'function') => void;
  onActionEdit: (action: any) => void;
  onActionDelete: (actionId: string) => void;
  userId: string;
}

export const ActionHandler: React.FC<ActionHandlerProps> = ({
  showActionModal,
  actionModalType,
  editingAction,
  onClose,
  onActionSave,
  onActionSelect,
  onActionEdit,
  onActionDelete,
  userId,
}) => {
  const handleActionSave = (actionData: any) => {
    const actionId = editingAction?.id || uuidv4();
    const newAction = {
      ...actionData,
      id: actionId,
      type: actionModalType
    };
    onActionSave(newAction);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h4 className="text-lg font-medium text-white mb-6">Actions</h4>
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => onActionSelect('transfer')}
          className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          <span className="mr-2">+</span>
          Add Transfer Action
        </button>
        <button
          onClick={() => onActionSelect('function')}
          className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          <span className="mr-2">+</span>
          Add Function Action
        </button>
      </div>

      <ActionModal
        isOpen={showActionModal}
        onClose={onClose}
        onSave={handleActionSave}
        type={actionModalType}
        initialData={editingAction}
        userId={userId}
      />
    </div>
  );
};
