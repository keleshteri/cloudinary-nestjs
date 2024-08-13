import { ISignedUploadUrlOptions } from '../interfaces';

/**
 * CLOUDINARY
 */
export const CLOUDINARY = 'Cloudinary';

/**
 * defaultCreateSignedUploadUrlOptions
 */
export const defaultCreateSignedUploadUrlOptions: Partial<ISignedUploadUrlOptions> =
  {
    folder: undefined,
    eager: undefined,
  };
