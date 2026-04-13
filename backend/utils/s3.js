import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a file to S3
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original file name
 * @param {string} mimetype - File mimetype
 * @param {string} userId - User ID for the folder
 * @returns {Promise<{fileUrl: string, key: string}>}
 */
export const uploadToS3 = async (buffer, originalName, mimetype, userId = 'guest') => {
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(4).toString('hex');
  const ext = originalName.split('.').pop() || 'jpg';
  const fileName = `${timestamp}-${randomStr}.${ext}`;
  const key = `documents/${userId}/${fileName}`;

  await s3.send(
    new PutObjectCommand({
  Bucket: process.env.AWS_BUCKET_NAME,
  Key: key,
  Body: buffer,
  ContentType: mimetype,
  
})
  );

  
  const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return { fileUrl, key };
};

/**
 * Delete an object from S3
 * @param {string} urlOrKey - Full S3 URL or the S3 key
 */
export const deleteFromS3 = async (urlOrKey) => {
  if (!urlOrKey) return;

  let key = urlOrKey;
  if (urlOrKey.startsWith('http')) {
    // Extract key from URL
    // Format: https://bucket.s3.region.amazonaws.com/key
    try {
      const url = new URL(urlOrKey);
      key = url.pathname.substring(1); // Remove leading slash
    } catch (e) {
      console.error('Failed to parse S3 URL:', urlOrKey);
      return;
    }
  }

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      })
    );
  } catch (error) {
    console.error('Failed to delete from S3:', key, error.message);
  }
};
