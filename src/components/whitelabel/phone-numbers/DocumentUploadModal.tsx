'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { getThemeConfig, PortalTheme } from '@/lib/portalThemes';

interface DocumentUploadModalProps {
  isOpen: boolean;
  phoneNumberId: string;
  phoneNumber?: any;
  onClose: () => void;
  onUploadComplete: () => void;
  customerId?: string; // Optional - for partner portal usage
}

const DOCUMENT_TYPES = [
  { value: 'business_proof', label: 'Business Proof (Business License, Registration)' },
  { value: 'address_proof', label: 'Address Proof (Utility Bill, Bank Statement)' },
  { value: 'identity_proof', label: 'Identity Proof (Passport, Driver License)' },
  { value: 'authorization_letter', label: 'Authorization Letter' },
];

export function DocumentUploadModal({
  isOpen,
  phoneNumberId,
  phoneNumber,
  onClose,
  onUploadComplete,
  customerId,
}: DocumentUploadModalProps) {
  const { branding } = usePartnerBranding();
  const themeConfig = branding?.themePreference ? getThemeConfig(branding.themePreference as PortalTheme) : getThemeConfig(PortalTheme.MODERN);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('');
  const [documentName, setDocumentName] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!documentName) {
        setDocumentName(selectedFile.name);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !documentType || !documentName) {
      toast.error('Please fill in all fields');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('phoneNumberId', phoneNumberId);
      formData.append('documentType', documentType);
      formData.append('documentName', documentName);

      // Use different API endpoint based on whether customerId is provided (partner portal vs customer portal)
      const apiEndpoint = customerId
        ? `/api/partner/customers/${customerId}/phone-numbers/${phoneNumberId}/documents/upload`
        : '/api/phone-numbers/documents/upload';

      const headers: Record<string, string> = {};

      // Add Authorization header for partner portal
      if (customerId) {
        const token = localStorage.getItem('partner_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      toast.success('Document uploaded successfully');
      onUploadComplete();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2 text-white"
            style={{ color: branding?.primaryColor || '#3b82f6' }}
          >
            <Upload className="h-5 w-5" />
            Upload Regulatory Documents
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Upload documents to verify your business for {phoneNumber?.phoneNumber || 'this phone number'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="bg-blue-900/20 border-blue-700 text-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription>
              <strong>Important:</strong> For outbound calling, you must provide valid business documents.
              Our team will review and submit them to our vendor for verification.
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="documentType" className="text-gray-200">Document Type</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger id="documentType" className="bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-white hover:bg-gray-700">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="documentName" className="text-gray-200">Document Name</Label>
            <Input
              id="documentName"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="e.g., Business License 2024"
              className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
            />
          </div>

          <div>
            <Label htmlFor="file" className="text-gray-200">Select File</Label>
            <div className="mt-1">
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="cursor-pointer bg-gray-800 border-gray-600 text-white file:bg-gray-700 file:text-white file:border-0 file:rounded file:px-3 file:py-1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Accepted formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB)
              </p>
            </div>
          </div>

          {file && (
            <div className="flex items-center gap-2 p-3 bg-gray-800 border border-gray-600 rounded-lg">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-sm truncate text-white">{file.name}</span>
              <span className="text-xs text-gray-400">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={uploading}
            className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploading || !file || !documentType}
            className="text-white"
            style={{
              backgroundColor: (uploading || !file || !documentType) ? '#374151' : (branding?.primaryColor || '#3b82f6'),
              borderColor: (uploading || !file || !documentType) ? '#374151' : (branding?.primaryColor || '#3b82f6')
            }}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}