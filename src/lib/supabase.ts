import { supabaseAdmin } from './supabase-admin';
import { logger } from './logger';

// The bucket name to use for all storage operations
const DEFAULT_BUCKET = 'files';

// Function to create the path for a file
function createFilePath(partnerId: string, customerId: string, filePath: string): string {
  return `${partnerId}/${customerId}/${filePath}`;
}

// Function to upload a file to Supabase Storage
export async function uploadFile(
  file: File | Blob,
  path: string,
  customerId: string,
  partnerId: string
): Promise<{ data: any; error: any }> {
  try {
    // Create the full path including partner and customer IDs
    const fullPath = `${partnerId}/${customerId}/${path}`;
    logger.info('Uploading file to bucket', {
      operation: 'supabase',
      bucket: DEFAULT_BUCKET,
      path: fullPath
    });

    // Upload the file using the admin client to bypass RLS
    const { data, error } = await supabaseAdmin.storage
      .from(DEFAULT_BUCKET)
      .upload(fullPath, file, {
        cacheControl: '3600',
        upsert: true, // Allow overwriting files
      });

    if (error) {
      logger.error('Error uploading file', new Error(error.message || 'Upload failed'), {
        operation: 'supabase',
        bucket: DEFAULT_BUCKET,
        path: fullPath
      });
      return { data: null, error };
    }

    logger.info('File uploaded successfully', {
      operation: 'supabase',
      bucket: DEFAULT_BUCKET,
      path: fullPath,
      fileId: data?.id
    });
    return { data, error: null };
  } catch (error) {
    logger.error('Exception uploading file', error as Error, {
      operation: 'supabase',
      bucket: DEFAULT_BUCKET,
      path: `${partnerId}/${customerId}/${path}`
    });
    return { data: null, error };
  }
}

// Function to get a public URL for a file
export async function getFileUrl(
  partnerId: string,
  customerId: string,
  path: string
): Promise<string | null> {
  try {
    const fullPath = `${partnerId}/${customerId}/${path}`;
    logger.info('Getting URL for file', {
      operation: 'supabase',
      bucket: DEFAULT_BUCKET,
      path: fullPath
    });

    // Use admin client to bypass RLS
    const { data } = supabaseAdmin.storage.from(DEFAULT_BUCKET).getPublicUrl(fullPath);
    return data.publicUrl;
  } catch (error) {
    logger.error('Error getting file URL', error as Error, {
      operation: 'supabase',
      bucket: DEFAULT_BUCKET,
      partnerId,
      customerId,
      path
    });
    return null;
  }
}

// Function to delete a file
export async function deleteFile(
  partnerId: string,
  customerId: string,
  path: string
): Promise<{ error: any }> {
  try {
    const fullPath = `${partnerId}/${customerId}/${path}`;
    logger.info('Deleting file from bucket', {
      operation: 'supabase',
      bucket: DEFAULT_BUCKET,
      path: fullPath
    });

    // Use admin client to bypass RLS
    const { error } = await supabaseAdmin.storage.from(DEFAULT_BUCKET).remove([fullPath]);
    return { error };
  } catch (error) {
    logger.error('Error deleting file', error as Error, {
      operation: 'supabase',
      bucket: DEFAULT_BUCKET,
      partnerId,
      customerId,
      path
    });
    return { error };
  }
}

// Function to download a file
export async function downloadFile(
  bucketName: string,
  filePath: string
): Promise<ArrayBuffer | null> {
  try {
    logger.info('Downloading file from bucket', {
      operation: 'supabase',
      bucket: bucketName,
      path: filePath
    });

    // Use admin client to bypass RLS
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .download(filePath);

    if (error) {
      logger.error('Error downloading file', new Error(error.message || 'Download failed'), {
        operation: 'supabase',
        bucket: bucketName,
        path: filePath
      });
      return null;
    }

    return await data.arrayBuffer();
  } catch (error) {
    logger.error('Exception downloading file', error as Error, {
      operation: 'supabase',
      bucket: bucketName,
      path: filePath
    });
    return null;
  }
}

// Function to list files in a folder
export async function listFiles(
  partnerId: string,
  customerId: string,
  path: string = ''
): Promise<{ data: any; error: any }> {
  try {
    const fullPath = path
      ? `${partnerId}/${customerId}/${path}`
      : `${partnerId}/${customerId}`;

    logger.info('Listing files in bucket', {
      operation: 'supabase',
      bucket: DEFAULT_BUCKET,
      path: fullPath
    });

    // Use admin client to bypass RLS
    const { data, error } = await supabaseAdmin.storage.from(DEFAULT_BUCKET).list(fullPath);
    return { data, error };
  } catch (error) {
    logger.error('Error listing files', error as Error, {
      operation: 'supabase',
      bucket: DEFAULT_BUCKET,
      partnerId,
      customerId,
      path
    });
    return { data: null, error };
  }
}
