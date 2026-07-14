import { NotFoundException } from '@nestjs/common';
import { DriversService } from './drivers.service';

describe('DriversService.dispatchReady', () => {
  let service: DriversService;
  let prisma: {
    driver: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      driver: {
        findUnique: jest.fn(),
      },
    };
    service = new DriversService(prisma as any);
  });

  it('throws when driver missing', async () => {
    prisma.driver.findUnique.mockResolvedValue(null);
    await expect(service.dispatchReady('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reports missing required docs', async () => {
    prisma.driver.findUnique.mockResolvedValue({
      id: 'd1',
      documents: [{ type: 'license', status: 'uploaded', expiryDate: '2099-01-01' }],
    });

    const result = await service.dispatchReady('d1');
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(['abstract', 'medical']));
  });

  it('treats expired status as not ready', async () => {
    prisma.driver.findUnique.mockResolvedValue({
      id: 'd1',
      documents: [
        { type: 'license', status: 'expired', expiryDate: '2099-01-01' },
        { type: 'abstract', status: 'uploaded', expiryDate: '2099-01-01' },
        { type: 'medical', status: 'uploaded', expiryDate: '2099-01-01' },
      ],
    });

    const result = await service.dispatchReady('d1');
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('license');
  });

  it('treats past expiryDate as not ready', async () => {
    prisma.driver.findUnique.mockResolvedValue({
      id: 'd1',
      documents: [
        { type: 'license', status: 'uploaded', expiryDate: '2000-01-01' },
        { type: 'abstract', status: 'uploaded', expiryDate: '2099-01-01' },
        { type: 'medical', status: 'uploaded', expiryDate: '2099-01-01' },
      ],
    });

    const result = await service.dispatchReady('d1');
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('license');
  });

  it('is ready when license, abstract, medical are valid', async () => {
    prisma.driver.findUnique.mockResolvedValue({
      id: 'd1',
      documents: [
        { type: 'license', status: 'uploaded', expiryDate: '2099-01-01' },
        { type: 'abstract', status: 'uploaded', expiryDate: null },
        { type: 'medical', status: 'uploaded', expiryDate: '2099-06-01' },
      ],
    });

    const result = await service.dispatchReady('d1');
    expect(result).toEqual({ ready: true, missing: [] });
  });
});
