import {
  S3Client,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from 'crypto';
import { logger } from './logger';

if (!process.env.R2_ACCESS_KEY_ID) throw new Error('R2_ACCESS_KEY_ID is required');
if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error('R2_SECRET_ACCESS_KEY is required');
if (!process.env.R2_ENDPOINT) throw new Error('R2_ENDPOINT is required');
if (!process.env.R2_DEFAULT_BUCKET) throw new Error('R2_DEFAULT_BUCKET is required');

// Configure S3 client for R2
export const S3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export interface UploadOptions {
  file: Buffer | Blob;
  fileName: string;
  mimeType: string;
  userId: string;
  metadata?: Record<string, string>;
  bucket?: string; // Optional bucket override
}

export async function uploadToR2({ 
  file, 
  fileName, 
  mimeType, 
  userId, 
  metadata = {},
  bucket = process.env.R2_DEFAULT_BUCKET // Default to R2_DEFAULT_BUCKET if not specified
}: UploadOptions) {
  try {
    let buffer: Buffer;
    
    if (Buffer.isBuffer(file)) {
      buffer = file;
    } else {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    const fileExtension = fileName.split('.').pop();
    const randomFileName = `${randomUUID()}.${fileExtension}`;
    const key = `${userId}/${randomFileName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
      Metadata: {
        ...metadata,
        userId,
        originalName: fileName,
      },
      Body: buffer,
    });

    // First upload the file
    await S3.send(command);
    
    // Then get the signed URL
    const url = await getSignedUrl(S3, command, { expiresIn: 3600 });

    return {
      url,
      key,
      bucket,
    };
  } catch (error) {
    logger.error('Error in uploadToR2', error as Error, {
      operation: 'r2_upload'
    });
    throw error;
  }
}
