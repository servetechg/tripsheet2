import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SettlementsService } from './settlements.service';

describe('SettlementsService', () => {
  let service: SettlementsService;
  let prisma: {
    settlement: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      settlement: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new SettlementsService(prisma as any);
  });

  describe('create', () => {
    it('computes totalAmount as sum of lines', async () => {
      prisma.settlement.create.mockResolvedValue({
        id: 's1',
        totalAmount: 350,
        status: 'draft',
      });

      await service.create({
        companyId: 'c1',
        driverId: 'd1',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-15',
        lines: [
          { label: 'Mileage', amount: 200 },
          { label: 'Bonus', amount: 150 },
        ],
      } as any);

      expect(prisma.settlement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalAmount: 350,
            status: 'draft',
          }),
        }),
      );
    });
  });

  describe('approve', () => {
    it('allows draft → approved', async () => {
      prisma.settlement.findUnique.mockResolvedValue({
        id: 's1',
        status: 'draft',
      });
      prisma.settlement.update.mockResolvedValue({
        id: 's1',
        status: 'approved',
      });

      await expect(service.approve('s1')).resolves.toMatchObject({
        status: 'approved',
      });
    });

    it('rejects approved → approved', async () => {
      prisma.settlement.findUnique.mockResolvedValue({
        id: 's1',
        status: 'approved',
      });

      await expect(service.approve('s1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws when settlement missing', async () => {
      prisma.settlement.findUnique.mockResolvedValue(null);

      await expect(service.approve('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('pay', () => {
    it('allows approved → paid', async () => {
      prisma.settlement.findUnique.mockResolvedValue({
        id: 's1',
        status: 'approved',
      });
      prisma.settlement.update.mockResolvedValue({
        id: 's1',
        status: 'paid',
      });

      await expect(service.pay('s1')).resolves.toMatchObject({
        status: 'paid',
      });
    });

    it('rejects draft → paid', async () => {
      prisma.settlement.findUnique.mockResolvedValue({
        id: 's1',
        status: 'draft',
      });

      await expect(service.pay('s1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects paid → paid', async () => {
      prisma.settlement.findUnique.mockResolvedValue({
        id: 's1',
        status: 'paid',
      });

      await expect(service.pay('s1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
