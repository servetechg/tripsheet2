import { FilesService } from './files.service';

describe('FilesService', () => {
  it('reports not configured when Cloudinary env is missing', () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    };
    const files = new FilesService(config as any);
    expect(files.isConfigured()).toBe(false);
  });

  it('reports configured when all Cloudinary env vars are set', () => {
    const config = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          CLOUDINARY_CLOUD_NAME: 'demo',
          CLOUDINARY_API_KEY: 'key',
          CLOUDINARY_API_SECRET: 'secret',
        };
        return map[key];
      }),
    };
    const files = new FilesService(config as any);
    expect(files.isConfigured()).toBe(true);
  });
});
