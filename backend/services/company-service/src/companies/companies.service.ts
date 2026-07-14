import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.company.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company ${id} not found`);
    }
    return company;
  }

  create(dto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: {
        ...(dto.id ? { id: dto.id } : {}),
        name: dto.name,
        shortName: dto.shortName,
        tagline: dto.tagline,
        address: dto.address,
        active: dto.active ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.ensureExists(id);
    return this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name,
        shortName: dto.shortName,
        tagline: dto.tagline,
        address: dto.address,
        active: dto.active,
      },
    });
  }

  async toggleActive(id: string) {
    const company = await this.ensureExists(id);
    return this.prisma.company.update({
      where: { id },
      data: { active: !company.active },
    });
  }

  private async ensureExists(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company ${id} not found`);
    }
    return company;
  }
}
