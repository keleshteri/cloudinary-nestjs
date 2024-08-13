import { CloudinaryConfigOptions } from './cloudinary-config-options.interface';

/**
 * CloudinaryModuleOptions
 */
export interface CloudinaryModuleOptions extends CloudinaryConfigOptions {}
/**
 * CloudinaryAsyncModuleOptions
 */
export interface CloudinaryAsyncModuleOptions {
  useFactory?: (
    ...args: any[]
  ) => CloudinaryModuleOptions | Promise<CloudinaryModuleOptions>;
  inject?: any[];
}
