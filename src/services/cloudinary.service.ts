import { Readable } from 'node:stream';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ResourceType,
  UploadApiErrorResponse,
  UploadApiOptions,
  UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary';
import {
  CloudinaryModuleOptions,
  IFile,
  ISignedUploadUrlOptions,
} from '../interfaces';
import { MODULE_OPTIONS_TOKEN } from '../cloudinary.module-definition';
import { defaultCreateSignedUploadUrlOptions } from '../constants';
import axios from 'axios';

/**
 * CloudinaryService
 */
@Injectable()
export class CloudinaryService {
  private logger = new Logger(CloudinaryService.name);
  public readonly cloudinary = cloudinary;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: CloudinaryModuleOptions,
  ) {
    //set options
    this.cloudinary.config(Object.assign({}, options));
  }

  /**
   * pingCloudinary
   */
  pingCloudinary() {
    cloudinary.api
      .ping()
      .then((res) => {
        this.logger.log(`Cloudinary connection status ${res.status}`);
      })
      .catch((err) => {
        this.logger.warn('Cloudinary connection status failed.');
        this.logger.error(err.error);
      });
  }
  /**
   * It returns the cloudinary instance.
   * @returns The cloudinary instance.
   */
  get cloudinaryInstance() {
    return this.cloudinary;
  }
  /**
   * It takes a file, uploads it to cloudinary, and returns a promise
   * @param {IFile} file - IFile - This is the file object that is passed to the uploadFile method.
   * @param {UploadApiOptions} [options] - This is the options object that you can pass to the
   * uploader.upload_stream method.
   * @returns   | UploadApiResponse
   * 						| UploadApiErrorResponse
   * 						| PromiseLike<UploadApiResponse | UploadApiErrorResponse>,
   */
  async uploadFile(
    file: IFile,
    options?: UploadApiOptions,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise(async (resolve, reject) => {
      cloudinary.api.ping;
      const upload = cloudinary.uploader.upload_stream(
        options,
        (
          error: any,
          result:
            | UploadApiResponse
            | UploadApiErrorResponse
            | PromiseLike<UploadApiResponse | UploadApiErrorResponse>,
        ) => {
          if (error) {
            this.logger.error(error);

            return reject(error);
          } else {
            resolve(result);
          }
        },
      );

      const stream: Readable = new Readable();

      stream.push(file.buffer);

      stream.push(null);

      stream.pipe(upload);
    });
  }
  /**
   * Uploads an image to Cloudinary using a remote URL.
   * @param {string} imageUrl - The URL of the image to be uploaded.
   * @param {UploadApiOptions} [options] - Optional upload options.
   * @returns Promise<UploadApiResponse | UploadApiErrorResponse>
   */
  async uploadByUrl(
    imageUrl: string,
    options?: UploadApiOptions,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    this.logger.debug(`uploadByUrl ${imageUrl}`);
    // Check if imageUrl is a string
    if (typeof imageUrl !== 'string') {
      this.logger.error(`Invalid parameter: imageUrl must be a string`);
      throw new Error('Invalid parameter: imageUrl must be a string');
    }

    // Validate the provided imageUrl
    const isValid = await this.validateImageUrl(imageUrl);
    if (!isValid) {
      this.logger.warn(`[uploadByUrl]:Invalid image URL: ${imageUrl}`);
      throw new Error('Invalid image URL');
    }
    // Retrieve the filename from the image URL
    const filename = this.getFilenameFromImageUrl(imageUrl);
    if (filename) {
      options = {
        ...options,
        public_id: filename,
      };
    }
    this.logger.debug('Uploading image');
    // If the URL is valid, proceed with the upload
    return new Promise((resolve, reject) => {
      this.cloudinary.uploader.upload(imageUrl, options, (error, result) => {
        if (error) {
          this.logger.error(error);
          return reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Deletes an image from Cloudinary.
   * @param {string} publicId - The public_id of the image to be deleted.
   * @returns Promise<DeleteApiResponse | Error>
   */
  async deleteImage(publicId: string): Promise<boolean> {
    if (!publicId) {
      this.logger.error('Invalid publicId provided for deletion.');
      throw new Error('Invalid publicId provided for deletion.');
    }
    try {
      const result = await this.cloudinary.uploader.destroy(publicId);
      if (result && result.result === 'ok') {
        return true;
      }
      return false;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to delete image with publicId: ${publicId}. Error: ${error.message}`,
        );
        throw error;
      } else {
        // Handle non-Error objects
        this.logger.error('An unknown error occurred', error);
      }
    }
  }

  /**
   * deleteImages
   * @param publicIds
   * @returns
   */
  async deleteImages(
    publicIds: string[],
  ): Promise<{ deleted: string[]; failed: string[] }> {
    if (!publicIds || publicIds.length === 0) {
      this.logger.error('No publicIds provided for deletion.');
      throw new Error('No publicIds provided for deletion.');
    }

    if (publicIds.some((id) => !id)) {
      this.logger.error('One or more invalid publicIds provided for deletion.');
      throw new Error('One or more invalid publicIds provided for deletion.');
    }
    try {
      const result = await this.cloudinary.api.delete_resources(publicIds);
      if (result && result.deleted) {
        const deletedIds = [];
        const failedIds = [];

        for (const [id, status] of Object.entries(result.deleted)) {
          if (status === 'deleted') {
            deletedIds.push(id);
          } else {
            failedIds.push(id);
          }
        }

        if (failedIds.length > 0) {
          this.logger.warn(
            `Failed to delete some images. Status: ${JSON.stringify(
              result.deleted,
            )}`,
          );
        }

        return {
          deleted: deletedIds,
          failed: failedIds,
        };
      }
      return {
        deleted: [],
        failed: publicIds,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Failed to delete images. Error: ${error.message}`);
        throw error;
      } else {
        // Handle non-Error objects
        this.logger.error('An unknown error occurred', error);
      }
    }
  }

  /**
   * It returns a signed upload URL.
   * @see https://cloudinary.com/documentation/signatures#using_cloudinary_backend_sdks_to_generate_sha_authentication_signatures
   * @param {string} publicId - This is the public id of the file.
   * @param {ResourceType} resourceType - The type of the resource. See ./node_modules/cloudinary/types/index.d.ts
   * @param {ISignedUploadUrlOptions} [options] - This is an object that contains the options for signing.
   * @returns string
   */
  async createSignedUploadUrl(
    publicId: string,
    resourceType: ResourceType,
    options?: ISignedUploadUrlOptions,
  ) {
    options = { ...defaultCreateSignedUploadUrlOptions, ...options };

    const url = `https://api.cloudinary.com/v1_1/${this.options.cloud_name}/${resourceType}/upload`;
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const signature = this.cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder: options.folder,
        eager: options.eager,
        public_id: publicId,
      },
      this.options.api_secret,
    );

    return {
      url,
      publicId,
      apiKey: this.options.api_key,
      timestamp,
      eager: options.eager,
      folder: options.folder,
      signature,
    };
  }

  /**
   * validateImageUrl
   * @param url
   * @returns
   */
  async validateImageUrl(url: string): Promise<boolean> {
    this.logger.debug(`validateImageUrl ${url}`);
    // 0. Check if URL is not an empty string
    if (!url || url.trim() === '') {
      this.logger.error('URL is empty');
      return false;
    }
    // 1. URL Format Validation
    const urlRegex = /^https?:\/\/[^ ]+\.[^ ]+$/;

    if (!urlRegex.test(url)) {
      this.logger.error('Invalid URL format');
      return false;
    }

    let response;
    // 2. URL Response Validation
    try {
      response = await axios.head(url);
    } catch (error) {
      return false;
    }

    // 3. Content-Type Validation
    const contentType = response.headers['content-type'];
    if (!contentType.startsWith('image/')) {
      this.logger.error(`Invalid content-type: ${contentType}`);
      return false;
    }

    // 4. Image Size Validation (example: 5MB)
    // 5. Actual Image () Validation
    // 6. Content Safety Validation
    this.logger.debug(`content-type ` + response.headers['content-type']);
    return true;
  }

  /**
   * getFilenameFromImageUrl
   * @param url
   * @returns
   */
  getFilenameFromImageUrl(url: string): string {
    this.logger.debug(`getFilenameFromImageUrl`, url);
    let filename = url.split('/').pop()?.split('?')[0] || '';
    this.logger.debug(` filename1: ${filename}`);
    if (filename.includes('.')) {
      const temp = filename.split('.');
      if (temp.length > 2) {
        filename = temp.slice(0, -1).join('-');
      } else {
        filename = temp[0];
      }
    }
    this.logger.debug(` filename2: ${filename}`);
    this.logger.debug(` filename3: ${filename.replace(/[?#%<>]+/g, '')}`);
    return filename.replace(/[?#%<>]+/g, '');
  }
}
