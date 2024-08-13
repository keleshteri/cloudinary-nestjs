import { registerAs } from '@nestjs/config';

/**
 * registerAs
 */
export const CloudinaryConfig = registerAs(
  'cloudinary',
  (): Record<string, any> => ({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  }),
);
