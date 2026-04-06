// src/lib/services/fileValidationService.ts
// Service for validating file formats and managing file upload restrictions

import { logger } from '@/lib/logger';

export interface SupportedFileFormat {
  extension: string;
  mimeTypes: string[];
  category: 'document' | 'image' | 'spreadsheet' | 'presentation' | 'text' | 'email';
  description: string;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string; // For non-blocking warnings (e.g., MIME type mismatch in lenient mode)
  fileInfo?: {
    name: string;
    size: number;
    sizeMB: number;
    extension: string;
    category: string;
    mimeType: string;
  };
}

export interface FileInput {
  name: string;
  size: number;
  type?: string;
}

export interface FileSizeInfo {
  bytes: number;
  kb: number;
  mb: number;
  gb: number;
  formatted: string;
}

export interface FileValidationOptions {
  /**
   * If true, reject files with mismatched MIME types. Default: true (strict mode)
   * Set to false only for specific use cases where browser MIME detection is unreliable
   */
  strictMimeType?: boolean;

  /**
   * Maximum file size in MB. Default: uses MAX_UPLOAD_FILE_SIZE_MB env var or 50MB
   * Set to 0 to disable file size validation
   */
  maxFileSizeMB?: number;

  /**
   * If true, skip file size validation entirely. Default: false
   */
  skipSizeValidation?: boolean;
}

export class FileValidationService {
  // Configuration from environment variables with sensible defaults
  // MAX_UPLOAD_FILE_SIZE_MB: Maximum file size in MB (default: 50MB)
  // STRICT_MIME_VALIDATION: Whether to reject mismatched MIME types (default: true)
  static readonly MAX_FILE_SIZE_MB = parseInt(process.env.MAX_UPLOAD_FILE_SIZE_MB || '50', 10);
  static readonly MAX_FILE_SIZE_BYTES = FileValidationService.MAX_FILE_SIZE_MB * 1024 * 1024;
  static readonly STRICT_MIME_VALIDATION = process.env.STRICT_MIME_VALIDATION !== 'false'; // default true

  // Supported file formats as specified in requirements
  static readonly SUPPORTED_FORMATS: SupportedFileFormat[] = [
    // Images
    { extension: '.bmp', mimeTypes: ['image/bmp'], category: 'image', description: 'Bitmap Image' },
    { extension: '.heic', mimeTypes: ['image/heic', 'image/heif'], category: 'image', description: 'HEIC Image' },
    { extension: '.jpeg', mimeTypes: ['image/jpeg'], category: 'image', description: 'JPEG Image' },
    { extension: '.jpg', mimeTypes: ['image/jpeg'], category: 'image', description: 'JPEG Image' },
    { extension: '.png', mimeTypes: ['image/png'], category: 'image', description: 'PNG Image' },
    { extension: '.tiff', mimeTypes: ['image/tiff'], category: 'image', description: 'TIFF Image' },
    
    // Documents
    { extension: '.doc', mimeTypes: ['application/msword'], category: 'document', description: 'Word Document' },
    { extension: '.docx', mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], category: 'document', description: 'Word Document' },
    { extension: '.odt', mimeTypes: ['application/vnd.oasis.opendocument.text'], category: 'document', description: 'OpenDocument Text' },
    { extension: '.pdf', mimeTypes: ['application/pdf'], category: 'document', description: 'PDF Document' },
    { extension: '.rtf', mimeTypes: ['application/rtf', 'text/rtf'], category: 'document', description: 'Rich Text Format' },
    
    // Presentations
    { extension: '.ppt', mimeTypes: ['application/vnd.ms-powerpoint'], category: 'presentation', description: 'PowerPoint Presentation' },
    { extension: '.pptx', mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], category: 'presentation', description: 'PowerPoint Presentation' },
    
    // Spreadsheets
    { extension: '.csv', mimeTypes: ['text/csv', 'application/csv'], category: 'spreadsheet', description: 'CSV File' },
    { extension: '.tsv', mimeTypes: ['text/tab-separated-values'], category: 'spreadsheet', description: 'TSV File' },
    { extension: '.xls', mimeTypes: ['application/vnd.ms-excel'], category: 'spreadsheet', description: 'Excel Spreadsheet' },
    { extension: '.xlsx', mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], category: 'spreadsheet', description: 'Excel Spreadsheet' },
    
    // Text Files
    { extension: '.html', mimeTypes: ['text/html'], category: 'text', description: 'HTML Document' },
    { extension: '.md', mimeTypes: ['text/markdown', 'text/x-markdown'], category: 'text', description: 'Markdown File' },
    { extension: '.org', mimeTypes: ['text/org'], category: 'text', description: 'Org Mode File' },
    { extension: '.rst', mimeTypes: ['text/x-rst'], category: 'text', description: 'reStructuredText' },
    { extension: '.txt', mimeTypes: ['text/plain'], category: 'text', description: 'Text File' },
    { extension: '.xml', mimeTypes: ['application/xml', 'text/xml'], category: 'text', description: 'XML File' },
    
    // Email
    { extension: '.eml', mimeTypes: ['message/rfc822'], category: 'email', description: 'Email Message' },
    { extension: '.msg', mimeTypes: ['application/vnd.ms-outlook'], category: 'email', description: 'Outlook Message' },
    
    // Other
    { extension: '.epub', mimeTypes: ['application/epub+zip'], category: 'document', description: 'EPUB eBook' },
    { extension: '.p7s', mimeTypes: ['application/pkcs7-signature'], category: 'document', description: 'PKCS#7 Signature' },
  ];

  /**
   * Get all supported file extensions
   */
  static getSupportedExtensions(): string[] {
    return this.SUPPORTED_FORMATS.map(format => format.extension);
  }

  /**
   * Get supported formats grouped by category
   */
  static getSupportedFormatsByCategory(): Record<string, SupportedFileFormat[]> {
    return this.SUPPORTED_FORMATS.reduce((acc, format) => {
      if (!acc[format.category]) {
        acc[format.category] = [];
      }
      acc[format.category].push(format);
      return acc;
    }, {} as Record<string, SupportedFileFormat[]>);
  }

  /**
   * Validate a file based on name, MIME type, and size
   * @param file - The file to validate
   * @param options - Optional validation options to override defaults
   */
  static validateFile(file: FileInput, options?: FileValidationOptions): FileValidationResult {
    const fileName = file.name.toLowerCase();
    const fileSize = file.size;
    const fileSizeMB = fileSize / (1024 * 1024);

    // Determine validation settings (options override env vars)
    const strictMimeType = options?.strictMimeType ?? this.STRICT_MIME_VALIDATION;
    const maxFileSizeMB = options?.maxFileSizeMB ?? this.MAX_FILE_SIZE_MB;
    const skipSizeValidation = options?.skipSizeValidation ?? false;

    // 1. Validate file size first (fail fast for large files)
    if (!skipSizeValidation && maxFileSizeMB > 0) {
      if (fileSizeMB > maxFileSizeMB) {
        logger.warn('File size exceeds limit', {
          operation: 'file_validation_service',
          fileName: file.name,
          fileSizeMB: fileSizeMB.toFixed(2),
          maxFileSizeMB,
        });
        return {
          isValid: false,
          error: `File size (${fileSizeMB.toFixed(2)} MB) exceeds the maximum allowed size of ${maxFileSizeMB} MB`,
        };
      }
    }

    // 2. Extract and validate file extension
    const extensionMatch = fileName.match(/\.([^.]+)$/);
    if (!extensionMatch) {
      return {
        isValid: false,
        error: 'File must have a valid extension',
      };
    }

    const extension = '.' + extensionMatch[1];

    // 3. Find supported format by extension
    const supportedFormat = this.SUPPORTED_FORMATS.find(format =>
      format.extension === extension
    );

    if (!supportedFormat) {
      return {
        isValid: false,
        error: `File type '${extension}' is not supported. Supported formats: ${this.getSupportedExtensions().join(', ')}`,
      };
    }

    // 4. Validate MIME type if available
    let warning: string | undefined;
    if (file.type) {
      const isMimeTypeValid = supportedFormat.mimeTypes.includes(file.type);

      if (!isMimeTypeValid) {
        // Check for common browser MIME type variations that should be allowed
        const isKnownBrowserVariation = this.isKnownMimeTypeVariation(extension, file.type);

        if (strictMimeType && !isKnownBrowserVariation) {
          logger.warn('MIME type mismatch rejected (strict mode)', {
            operation: 'file_validation_service',
            fileName: file.name,
            extension,
            expectedMimeTypes: supportedFormat.mimeTypes,
            actualMimeType: file.type,
          });
          return {
            isValid: false,
            error: `File MIME type '${file.type}' does not match expected type for ${extension} files. Expected: ${supportedFormat.mimeTypes.join(' or ')}`,
          };
        } else {
          // Lenient mode: log warning but allow the file
          logger.warn('MIME type mismatch detected (lenient mode)', {
            operation: 'file_validation_service',
            fileName: file.name,
            extension,
            expectedMimeTypes: supportedFormat.mimeTypes,
            actualMimeType: file.type,
            isKnownBrowserVariation,
          });
          warning = `MIME type '${file.type}' differs from expected. File allowed based on extension.`;
        }
      }
    }

    return {
      isValid: true,
      warning,
      fileInfo: {
        name: file.name,
        size: fileSize,
        sizeMB: fileSizeMB,
        extension,
        category: supportedFormat.category,
        mimeType: file.type || supportedFormat.mimeTypes[0],
      },
    };
  }

  /**
   * Check if a MIME type is a known browser variation that should be allowed
   * Some browsers report different MIME types for the same file format
   */
  private static isKnownMimeTypeVariation(extension: string, mimeType: string): boolean {
    const knownVariations: Record<string, string[]> = {
      // Text files - browsers may use different MIME types
      '.txt': ['text/plain', 'application/octet-stream'],
      '.csv': ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'],
      '.md': ['text/markdown', 'text/x-markdown', 'text/plain', 'application/octet-stream'],
      '.html': ['text/html', 'application/xhtml+xml'],
      '.xml': ['text/xml', 'application/xml', 'text/plain'],
      // Document files
      '.doc': ['application/msword', 'application/octet-stream'],
      '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
      '.pdf': ['application/pdf', 'application/octet-stream'],
      // Image files
      '.jpg': ['image/jpeg', 'image/pjpeg'],
      '.jpeg': ['image/jpeg', 'image/pjpeg'],
      '.png': ['image/png', 'image/x-png'],
      // Spreadsheets
      '.xls': ['application/vnd.ms-excel', 'application/octet-stream'],
      '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
    };

    const variations = knownVariations[extension];
    return variations ? variations.includes(mimeType) : false;
  }

  /**
   * Validate multiple files
   * @param files - Array of files to validate
   * @param options - Optional validation options to override defaults
   */
  static validateFiles(files: FileInput[], options?: FileValidationOptions): {
    validFiles: FileInput[];
    invalidFiles: Array<{ file: FileInput; error: string }>;
    totalSize: number;
    totalSizeMB: number;
  } {
    const validFiles: FileInput[] = [];
    const invalidFiles: Array<{ file: FileInput; error: string }> = [];
    let totalSize = 0;

    for (const file of files) {
      const validation = this.validateFile(file, options);
      if (validation.isValid) {
        validFiles.push(file);
        totalSize += file.size;
      } else {
        invalidFiles.push({ file, error: validation.error || 'Unknown error' });
      }
    }

    return {
      validFiles,
      invalidFiles,
      totalSize,
      totalSizeMB: totalSize / (1024 * 1024),
    };
  }

  /**
   * Get current validation configuration
   * Useful for displaying limits to users in the UI
   */
  static getValidationConfig(): {
    maxFileSizeMB: number;
    maxFileSizeBytes: number;
    strictMimeValidation: boolean;
    supportedExtensions: string[];
    supportedMimeTypes: string[];
  } {
    return {
      maxFileSizeMB: this.MAX_FILE_SIZE_MB,
      maxFileSizeBytes: this.MAX_FILE_SIZE_BYTES,
      strictMimeValidation: this.STRICT_MIME_VALIDATION,
      supportedExtensions: this.getSupportedExtensions(),
      supportedMimeTypes: [...new Set(this.SUPPORTED_FORMATS.flatMap(f => f.mimeTypes))],
    };
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): FileSizeInfo {
    const kb = bytes / 1024;
    const mb = kb / 1024;
    const gb = mb / 1024;

    let formatted: string;
    if (gb >= 1) {
      formatted = `${gb.toFixed(2)} GB`;
    } else if (mb >= 1) {
      formatted = `${mb.toFixed(2)} MB`;
    } else if (kb >= 1) {
      formatted = `${kb.toFixed(2)} KB`;
    } else {
      formatted = `${bytes} bytes`;
    }

    return {
      bytes,
      kb,
      mb,
      gb,
      formatted,
    };
  }

  /**
   * Get file extension from filename
   */
  static getFileExtension(filename: string): string {
    const match = filename.toLowerCase().match(/\.([^.]+)$/);
    return match ? '.' + match[1] : '';
  }

  /**
   * Check if file extension is supported
   */
  static isExtensionSupported(extension: string): boolean {
    return this.SUPPORTED_FORMATS.some(format => format.extension === extension.toLowerCase());
  }

  /**
   * Get file category by extension
   */
  static getFileCategory(extension: string): string | null {
    const format = this.SUPPORTED_FORMATS.find(format => format.extension === extension.toLowerCase());
    return format ? format.category : null;
  }

  /**
   * Generate accept attribute for file input
   */
  static getAcceptAttribute(): string {
    const extensions = this.getSupportedExtensions();
    const mimeTypes = [...new Set(this.SUPPORTED_FORMATS.flatMap(format => format.mimeTypes))];
    return [...extensions, ...mimeTypes].join(',');
  }
}

export default FileValidationService;
