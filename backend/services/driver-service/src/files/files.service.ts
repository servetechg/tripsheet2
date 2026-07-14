import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
  bytes?: number;
  format?: string;
  resourceType: string;
};

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    this.configured = Boolean(cloudName && apiKey && apiSecret);

    if (this.configured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    } else {
      this.logger.warn(
        'Cloudinary is not configured — document uploads will keep inline fileData (dev only)',
      );
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Upload a data URL (or raw base64) to Cloudinary.
   * Returns secure URL + public_id; DB should store these, not the blob.
   */
  async uploadDataUrl(
    dataUrl: string,
    options: {
      folder?: string;
      publicId?: string;
      fileName?: string;
    } = {},
  ): Promise<CloudinaryUploadResult> {
    if (!this.configured) {
      throw new BadRequestException(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.',
      );
    }

    if (!dataUrl?.trim()) {
      throw new BadRequestException('fileData is required for upload');
    }

    const folder =
      options.folder ??
      this.config.get<string>('CLOUDINARY_FOLDER') ??
      'tripsheet/documents';

    try {
      const result: UploadApiResponse = await cloudinary.uploader.upload(
        dataUrl,
        {
          folder,
          public_id: options.publicId,
          resource_type: 'auto',
          overwrite: true,
          invalidate: true,
        },
      );

      return {
        url: result.secure_url,
        publicId: result.public_id,
        bytes: result.bytes,
        format: result.format,
        resourceType: result.resource_type,
      };
    } catch (err) {
      this.logger.error(`Cloudinary upload failed: ${String(err)}`);
      throw new BadRequestException('Failed to upload file to Cloudinary');
    }
  }

  async destroy(publicId: string): Promise<void> {
    if (!this.configured || !publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
    } catch (err) {
      this.logger.warn(`Cloudinary destroy failed for ${publicId}: ${String(err)}`);
    }
  }
}
