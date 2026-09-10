import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function requireDriverRecordId(
  prisma: PrismaService,
  reference: string,
  companyId?: string,
): Promise<string> {
  const driver = await prisma.driver.findFirst({
    where: {
      ...(companyId ? { companyId } : {}),
      OR: [{ id: reference }, { userId: reference }],
    },
    select: { id: true },
  });
  if (!driver) {
    throw new NotFoundException(
      'Driver profile not found. Refresh the roster or complete driver onboarding first.',
    );
  }
  return driver.id;
}
