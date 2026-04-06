import React, { useState } from 'react';
import { motion as m } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { FiSmartphone, FiGlobe, FiPhone } from 'react-icons/fi';
import { WidgetDesigner } from './WidgetDesigner';
import { PhoneWidgetDesigner } from './PhoneWidgetDesigner';
import type { WidgetConfig } from '@/types/widget';
import type { PhoneWidgetConfig } from './PhoneWidgetDesigner';

type ChannelType = 'website' | 'phone' | 'mobile';

interface ChannelData {
  website: boolean;
  phone: boolean;
  mobile: boolean;
}

interface ChannelSettings {
  designWidget?: boolean;
  widgetConfig?: WidgetConfig;
  phoneWidgetConfig?: PhoneWidgetConfig;
  workingHours: boolean;
  maskPII: boolean;
  saveTranscripts: boolean;
  callAnalysis: boolean;
  phoneNumber?: string;
}

interface LiveChannelsProps {
  channels: Partial<ChannelData>;
  settings: Partial<ChannelSettings>;
  onChannelChange: (channels: Partial<ChannelData>) => void;
  onSettingChange: (settings: Partial<ChannelSettings>) => void;
}

const ChannelTile: React.FC<{
  type: ChannelType;
  isActive: boolean;
  onToggle: (checked: boolean) => void;
  icon: React.ReactNode;
  label: string;
}> = ({ type, isActive, onToggle, icon, label }) => (
  <m.div
    className={`p-4 rounded-lg border ${
      isActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700'
    } cursor-pointer transition-colors`}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={() => onToggle(!isActive)}
  >
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-full ${isActive ? 'bg-blue-500/20' : 'bg-gray-700'}`}>
        {icon}
      </div>
      <div>
        <h4 className="font-medium text-white">{label}</h4>
      </div>
      <input
        type="checkbox"
        checked={isActive}
        onChange={(e) => onToggle(e.target.checked)}
        className="ml-auto rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 transition-colors"
      />
    </div>
  </m.div>
);

const ActionButton: React.FC<{
  onClick: () => void;
  primary?: boolean;
  children: React.ReactNode;
}> = ({ onClick, primary = false, children }) => (
  <m.button
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`px-4 py-2 ${
      primary
        ? 'bg-blue-600 hover:bg-blue-700'
        : 'bg-gray-700 hover:bg-gray-600'
    } text-white rounded-lg transition-colors text-sm`}
  >
    {children}
  </m.button>
);

export const LiveChannels: React.FC<LiveChannelsProps> = ({
  channels,
  settings,
  onChannelChange,
  onSettingChange,
}) => {
  const [showWebWidgetDesigner, setShowWebWidgetDesigner] = useState(false);
  const [showPhoneWidgetDesigner, setShowPhoneWidgetDesigner] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const handleWebWidgetSave = (widgetConfig: WidgetConfig) => {
    onSettingChange({
      ...settings,
      widgetConfig,
    });
    setShowWebWidgetDesigner(false);
    toast.success('Web widget design saved successfully!');
  };

  const handlePhoneWidgetSave = (phoneWidgetConfig: PhoneWidgetConfig) => {
    onSettingChange({
      ...settings,
      phoneWidgetConfig,
    });
    setShowPhoneWidgetDesigner(false);
    toast.success('Phone widget design saved successfully!');
  };

  const handleBuyPhone = () => {
    // This would be implemented later to integrate with phone number purchase API
    toast.success('Redirecting to phone number purchase...');
  };

  const handleSelectPhone = () => {
    setShowPhoneModal(true);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ChannelTile
          type="website"
          isActive={channels.website || false}
          onToggle={(checked) => onChannelChange({ ...channels, website: checked })}
          icon={<FiGlobe className="w-5 h-5 text-white" />}
          label="Website"
        />
        <ChannelTile
          type="phone"
          isActive={channels.phone || false}
          onToggle={(checked) => onChannelChange({ ...channels, phone: checked })}
          icon={<FiPhone className="w-5 h-5 text-white" />}
          label="Phone"
        />
        <ChannelTile
          type="mobile"
          isActive={channels.mobile || false}
          onToggle={(checked) => onChannelChange({ ...channels, mobile: checked })}
          icon={<FiSmartphone className="w-5 h-5 text-white" />}
          label="Mobile"
        />
      </div>

      {(channels.website || channels.phone || channels.mobile) && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white">Channel Settings</h3>
          
          {/* Website Channel Settings */}
          {channels.website && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-400">Website Settings</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <ActionButton
                  onClick={() => setShowWebWidgetDesigner(true)}
                  primary={!!settings.widgetConfig}
                >
                  Design Widget
                </ActionButton>
              </div>
            </div>
          )}

          {/* Phone Channel Settings */}
          {channels.phone && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-400">Phone Settings</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <ActionButton
                  onClick={handleBuyPhone}
                  primary={false}
                >
                  Buy Phone Number
                </ActionButton>
                <ActionButton
                  onClick={handleSelectPhone}
                  primary={!!settings.phoneNumber}
                >
                  Select Phone Number
                </ActionButton>
                <ActionButton
                  onClick={() => setShowPhoneWidgetDesigner(true)}
                  primary={!!settings.phoneWidgetConfig}
                >
                  Design Widget
                </ActionButton>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Web Widget Designer Modal */}
      {showWebWidgetDesigner && (
        <WidgetDesigner
          onClose={() => setShowWebWidgetDesigner(false)}
          onSave={handleWebWidgetSave}
        />
      )}

      {/* Phone Widget Designer Modal */}
      {showPhoneWidgetDesigner && (
        <PhoneWidgetDesigner
          onClose={() => setShowPhoneWidgetDesigner(false)}
          onSave={handlePhoneWidgetSave}
          availablePhoneNumbers={[settings.phoneNumber || '+1234567890']}
        />
      )}
    </div>
  );
};
