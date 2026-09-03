import { NotFoundException } from '@nestjs/common';
import { EquipmentService } from './equipment.service';

describe('EquipmentService.assign', () => {
  let service: EquipmentService;
  let prisma: {
    driver: { findUnique: jest.Mock };
    driverEquipmentAssignment: {
      updateMany: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      driver: {
        findUnique: jest.fn().mockResolvedValue({ id: 'd1', companyId: 'c1' }),
      },
      driverEquipmentAssignment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({
          id: 'a2',
          driverId: 'd1',
          assetType: 'truck',
          role: 'primary',
          assetId: 'truck-B',
          unassignedAt: null,
        }),
      },
    };
    const config = { get: jest.fn(() => '') };
    service = new EquipmentService(prisma as any, config as any);
  });

  it('closes prior primary assignment before creating new primary', async () => {
    await service.assign('d1', {
      companyId: 'c1',
      assetId: 'truck-B',
      assetType: 'truck',
      role: 'primary',
    });

    expect(prisma.driverEquipmentAssignment.updateMany).toHaveBeenCalledWith({
      where: {
        driverId: 'd1',
        assetType: 'truck',
        role: 'primary',
        unassignedAt: null,
      },
      data: { unassignedAt: expect.any(Date) },
    });
    expect(prisma.driverEquipmentAssignment.create).toHaveBeenCalled();
  });

  it('throws when driver missing', async () => {
    prisma.driver.findUnique.mockResolvedValue(null);
    await expect(
      service.assign('missing', {
        companyId: 'c1',
        assetId: 'x',
        assetType: 'truck',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
