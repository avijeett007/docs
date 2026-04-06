import React from 'react';
import { motion } from 'framer-motion';
import { FiHelpCircle } from 'react-icons/fi';
import Tooltip from '../ui/Tooltip';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  tooltip?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  error,
  tooltip,
  children
}) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <label className="block text-sm font-medium text-gray-300">
          {label}
          {required && <span className="text-blue-400 ml-0.5">*</span>}
        </label>
        {tooltip && (
          <Tooltip content={tooltip}>
            <div className="text-gray-400 hover:text-gray-300 cursor-help">
              <FiHelpCircle className="w-4 h-4" />
            </div>
          </Tooltip>
        )}
      </div>
      {children}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-400 mt-1"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
};
