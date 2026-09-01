import { NotFoundException } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { QualificationsService } from '../qualifications/qualifications.service';

describe('DriversService.dispatchReady', () => {
  let service: DriversService;
  let documentsService: { findAll: jest.Mock };
  let prisma: {
    driver: {
      findUnique: jest.Mock;
    };
  };

  const activeDriver = (extra: Record<string, unknown> = {}) => {
    const { documents = [], ...rest } = extra as {
      documents?: Array<{ type: string; status: string; expiryDate?: string | null }>;
    };
    return {
      id: 'd1',
      companyId: 'c1',
      lifecycleStatus: 'active',
      availabilityStatus: 'available',
      qualifications: [],
      ...rest,
      _documents: documents,
    };
  };

  beforeEach(() => {
    prisma = {
      driver: {
        findUnique: jest.fn(),
      },
    };
    documentsService = { findAll: jest.fn() };
    const config = { get: jest.fn() };
    const qualifications = new QualificationsService({} as any, config as any);
    service = new DriversService(
      prisma as any,
      config as any,
      {} as any,
      qualifications,
      documentsService as any,
    );
  });

  function mockDriver(extra: Record<string, unknown> = {}) {
    const row = activeDriver(extra);
    const docs = row._documents as Array<{
      type: string;
      status: string;
      expiryDate?: string | null;
    }>;
    const { _documents: _, ...driver } = row;
    prisma.driver.findUnique.mockResolvedValue(driver);
    documentsService.findAll.mockResolvedValue(docs);
  }

  it('throws when driver missing', async () => {
    prisma.driver.findUnique.mockResolvedValue(null);
    await expect(service.dispatchReady('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reports missing required docs', async () => {
    mockDriver({
      documents: [{ type: 'license', status: 'uploaded', expiryDate: '2099-01-01' }],
    });

    const result = await service.dispatchReady('d1');
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(['abstract', 'medical']));
    expect(result.lifecycleOk).toBe(true);
    expect(result.availabilityOk).toBe(true);
  });

  it('treats expired status as not ready', async () => {
    mockDriver({
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

  it('blocks suspended lifecycle', async () => {
    mockDriver({
      lifecycleStatus: 'suspended',
      documents: [
        { type: 'license', status: 'uploaded', expiryDate: '2099-01-01' },
        { type: 'abstract', status: 'uploaded', expiryDate: null },
        { type: 'medical', status: 'uploaded', expiryDate: '2099-06-01' },
      ],
    });

    const result = await service.dispatchReady('d1');
    expect(result.ready).toBe(false);
    expect(result.lifecycleOk).toBe(false);
  });

  it('blocks unavailable availability', async () => {
    mockDriver({
      availabilityStatus: 'vacation',
      documents: [
        { type: 'license', status: 'uploaded', expiryDate: '2099-01-01' },
        { type: 'abstract', status: 'uploaded', expiryDate: null },
        { type: 'medical', status: 'uploaded', expiryDate: '2099-06-01' },
      ],
    });

    const result = await service.dispatchReady('d1');
    expect(result.ready).toBe(false);
    expect(result.availabilityOk).toBe(false);
  });

  it('is ready when license, abstract, medical are valid', async () => {
    mockDriver({
      documents: [
        { type: 'license', status: 'uploaded', expiryDate: '2099-01-01' },
        { type: 'abstract', status: 'uploaded', expiryDate: null },
        { type: 'medical', status: 'uploaded', expiryDate: '2099-06-01' },
      ],
    });

    const result = await service.dispatchReady('d1');
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.lifecycleOk).toBe(true);
    expect(result.availabilityOk).toBe(true);
  });

  it('pending_review has no compliance blockers when docs are valid', async () => {
    mockDriver({
      lifecycleStatus: 'pending_review',
      documents: [
        { type: 'license', status: 'uploaded', expiryDate: '2099-01-01' },
        { type: 'abstract', status: 'uploaded', expiryDate: null },
        { type: 'medical', status: 'uploaded', expiryDate: '2099-06-01' },
      ],
    });

    const result = await service.dispatchReady('d1');
    expect(result.missing).toEqual([]);
    expect(result.lifecycleOk).toBe(false);
    expect(result.ready).toBe(false);
  });
});
