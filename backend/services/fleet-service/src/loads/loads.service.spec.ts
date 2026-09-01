import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LoadsService } from './loads.service';

describe('LoadsService', () => {
  let service: LoadsService;
  let prisma: {
    load: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    asset: {
      findUnique: jest.Mock;
    };
  };
  const config = {
    get: jest.fn() as jest.Mock,
  };

  beforeEach(() => {
    prisma = {
      load: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      asset: {
        findUnique: jest.fn(),
      },
    };
    config.get.mockImplementation((key: string) => {
      if (key === 'DRIVER_SERVICE_URL') return '';
      return undefined;
    });
    service = new LoadsService(prisma as any, config as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as any).fetch;
  });

  describe('create', () => {
    it('requires driverId, origin, destination', async () => {
      await expect(
        service.create({
          companyId: 'c1',
          driverId: '',
          origin: 'A',
          destination: 'B',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when driver already has an active load', async () => {
      prisma.load.findFirst.mockResolvedValue({ id: 'L-old', status: 'assigned' });
      await expect(
        service.create({
          companyId: 'c1',
          driverId: 'd1',
          origin: 'Calgary',
          destination: 'Toronto',
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.load.create).not.toHaveBeenCalled();
    });

    it('creates an assigned load when driver is free', async () => {
      prisma.load.findFirst.mockResolvedValue(null);
      prisma.load.create.mockResolvedValue({
        id: 'L1',
        status: 'assigned',
        driverId: 'd1',
      });

      const result = await service.create({
        companyId: 'c1',
        driverId: 'd1',
        origin: 'Calgary',
        destination: 'Toronto',
      } as any);

      expect(result.id).toBe('L1');
      expect(prisma.load.create).toHaveBeenCalled();
    });

    it('rejects driver not dispatch-ready (expired medical)', async () => {
      prisma.load.findFirst.mockResolvedValue(null);
      config.get.mockImplementation((key: string) => {
        if (key === 'DRIVER_SERVICE_URL') return 'http://driver.test';
        return undefined;
      });
      const fetchMock = jest.fn(async (url: string) => {
        if (String(url).includes('/dispatch-ready')) {
          return {
            ok: true,
            json: async () => ({
              ready: false,
              missing: ['medical'],
              lifecycleOk: true,
              availabilityOk: true,
            }),
          };
        }
        if (String(url).includes('/drivers/d1')) {
          return {
            ok: true,
            json: async () => ({
              name: 'Test Driver',
              lifecycleStatus: 'active',
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      });
      global.fetch = fetchMock as any;

      await expect(
        service.create({
          companyId: 'c1',
          driverId: 'd1',
          origin: 'Calgary',
          destination: 'Toronto',
        } as any),
      ).rejects.toThrow(/medical/);
      expect(prisma.load.create).not.toHaveBeenCalled();
    });

    it('rejects Out of Service truck', async () => {
      prisma.load.findFirst.mockResolvedValue(null);
      global.fetch = jest.fn(async () => ({ ok: false })) as any;
      prisma.asset.findUnique.mockResolvedValue({
        id: 't1',
        companyId: 'c1',
        unitNo: 'T-101',
        status: 'out_of_service',
      });
      await expect(
        service.create({
          companyId: 'c1',
          driverId: 'd1',
          truckId: 't1',
          origin: 'Calgary',
          destination: 'Toronto',
        } as any),
      ).rejects.toThrow(/Out of Service/);
      expect(prisma.load.create).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('allows assigned → in_transit', async () => {
      prisma.load.findUnique.mockResolvedValue({
        id: 'L1',
        status: 'assigned',
      });
      prisma.load.update.mockResolvedValue({ id: 'L1', status: 'in_transit' });

      await expect(
        service.updateStatus('L1', { status: 'in_transit' }),
      ).resolves.toMatchObject({ status: 'in_transit' });
    });

    it('rejects assigned → delivered', async () => {
      prisma.load.findUnique.mockResolvedValue({
        id: 'L1',
        status: 'assigned',
      });

      await expect(
        service.updateStatus('L1', { status: 'delivered' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects transitions from delivered', async () => {
      prisma.load.findUnique.mockResolvedValue({
        id: 'L1',
        status: 'delivered',
      });

      await expect(
        service.updateStatus('L1', { status: 'in_transit' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when load missing', async () => {
      prisma.load.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus('missing', { status: 'in_transit' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('simulateTrack', () => {
    it('only works for in_transit loads', async () => {
      prisma.load.findUnique.mockResolvedValue({
        id: 'L1',
        status: 'assigned',
      });
      await expect(service.simulateTrack('L1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
