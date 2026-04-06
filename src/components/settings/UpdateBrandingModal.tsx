'use client';

import React, { useState, useRef } from 'react';
import { FiX, FiUpload, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

interface UpdateBrandingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBranding: {
    logo: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    fontFamily: string | null;
    portalTitle: string | null;
    portalSlogan: string | null;
  };
  onUpdate: (brandingData: FormData) => Promise<void>;
}

const fontOptions = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Lato',
  'Poppins',
  'Source Sans Pro',
  'Nunito',
  'Raleway',
  'Ubuntu'
];

const UpdateBrandingModal: React.FC<UpdateBrandingModalProps> = ({
  isOpen,
  onClose,
  currentBranding,
  onUpdate
}) => {
  const [primaryColor, setPrimaryColor] = useState(currentBranding.primaryColor || '#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState(currentBranding.secondaryColor || '#10B981');
  const [fontFamily, setFontFamily] = useState(currentBranding.fontFamily || 'Inter');
  const [portalTitle, setPortalTitle] = useState(currentBranding.portalTitle || '');
  const [portalSlogan, setPortalSlogan] = useState(currentBranding.portalSlogan || '');
  const [logoPreview, setLogoPreview] = useState<string | null>(currentBranding.logo);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast.error('Logo image must be less than 2MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setLogoFile(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setLogoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('primaryColor', primaryColor);
      formData.append('secondaryColor', secondaryColor);
      formData.append('fontFamily', fontFamily);
      formData.append('portalTitle', portalTitle);
      formData.append('portalSlogan', portalSlogan);
      
      if (logoFile) {
        formData.append('logo', logoFile);
      } else if (logoPreview === null && currentBranding.logo) {
        // If logo preview is null but there was a previous logo, it means the user removed it
        formData.append('removeLogo', 'true');
      }

      await onUpdate(formData);
      onClose();
      toast.success('Branding settings updated successfully');
    } catch (error) {
      console.error('Error updating branding:', error);
      toast.error('Failed to update branding settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Update Branding Settings</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Company Logo</label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-40 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                {logoPreview ? (
                  <img 
                    src={logoPreview} 
                    alt="Logo Preview" 
                    className="h-full object-contain"
                  />
                ) : (
                  <span className="text-gray-400">No logo</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  ref={fileInputRef}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                >
                  <FiUpload className="w-4 h-4" />
                  Upload Logo
                </button>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    <FiTrash2 className="w-4 h-4" />
                    Remove Logo
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Recommended size: 300x150px. Max size: 2MB.</p>
          </div>

          {/* Portal Title & Slogan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Portal Title</label>
              <input
                type="text"
                value={portalTitle}
                onChange={(e) => setPortalTitle(e.target.value)}
                placeholder="e.g., AI Voice Assistant Portal"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Portal Slogan</label>
              <input
                type="text"
                value={portalSlogan}
                onChange={(e) => setPortalSlogan(e.target.value)}
                placeholder="e.g., Powered by cutting-edge AI"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Primary Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Secondary Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Font Family</label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {fontOptions.map((font) => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </div>

          {/* Preview */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">Preview</h3>
            <div 
              className="p-4 rounded-lg border border-gray-600"
              style={{ fontFamily }}
            >
              <h4 
                className="text-lg font-bold mb-2" 
                style={{ color: primaryColor }}
              >
                {portalTitle || 'Your Portal Title'}
              </h4>
              <p 
                className="text-sm" 
                style={{ color: secondaryColor }}
              >
                {portalSlogan || 'Your portal slogan goes here'}
              </p>
              <button 
                className="mt-3 px-4 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: primaryColor }}
              >
                Sample Button
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdateBrandingModal;
