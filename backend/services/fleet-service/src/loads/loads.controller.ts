import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertPermission, getTenantStore } from '@tripsheet/tenant-runtime';
import { ActiveLoadsDto } from './dto/active-loads.dto';
import { CreateLoadDto } from './dto/create-load.dto';
import { ListLoadsDto } from './dto/list-loads.dto';
import { UpdateLoadDto } from './dto/update-load.dto';
import { UpdateLoadStatusDto } from './dto/update-load-status.dto';
import { LoadsService } from './loads.service';
import { driverScopeId, requireDispatchWrite, requirePerm } from '../rbac/assert';

@Controller('loads')
export class LoadsController {
  constructor(
    private readonly loadsService: LoadsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  findAll(@Query() query: ListLoadsDto) {
    requirePerm('dispatch.view');
    const own = driverScopeId();
    return this.loadsService.findAll({
      ...query,
      ...(own ? { driverId: own === '__none__' ? '___no_driver___' : own } : {}),
    });
  }

  @Get('active')
  findActive(@Query() query: ActiveLoadsDto) {
    requirePerm('dispatch.view');
    return this.loadsService.findActive(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    requirePerm('dispatch.view');
    const load = await this.loadsService.findOne(id);
    this.assertOwnLoad(load);
    return load;
  }

  @Post()
  async create(@Body() dto: CreateLoadDto) {
    await requireDispatchWrite(this.config, 'dispatch.create', {
      method: 'POST',
      path: '/loads',
    });
    return this.loadsService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateLoadDto) {
    await requireDispatchWrite(this.config, 'dispatch.edit', {
      method: 'PATCH',
      path: `/loads/${id}`,
    });
    const existing = await this.loadsService.findOne(id);
    this.assertOwnLoad(existing);
    return this.loadsService.update(id, dto);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateLoadStatusDto) {
    const existing = await this.loadsService.findOne(id);
    const store = getTenantStore();
    const isDriver = store?.role === 'driver';

    if (isDriver) {
      this.assertOwnLoad(existing);
      if (dto.status === 'in_transit') {
        assertPermission('dispatch.trip.start');
        if (existing.status !== 'assigned') {
          throw new BadRequestException(
            'Only assigned loads can be started',
          );
        }
      } else if (dto.status === 'delivered') {
        assertPermission('dispatch.trip.complete');
        if (existing.status !== 'in_transit') {
          throw new BadRequestException(
            'Only in-transit loads can be marked delivered',
          );
        }
      } else {
        throw new ForbiddenException(
          'Drivers cannot perform this status change',
        );
      }
      return this.loadsService.updateStatus(id, dto);
    }

    const allowed =
      dto.status === 'cancelled'
        ? 'dispatch.cancel'
        : dto.status === 'delivered'
          ? 'dispatch.close'
          : 'dispatch.edit';
    await requireDispatchWrite(this.config, allowed, {
      method: 'PATCH',
      path: `/loads/${id}/status`,
    });
    return this.loadsService.updateStatus(id, dto);
  }

  @Post(':id/simulate-track')
  async simulateTrack(@Param('id') id: string) {
    requirePerm('dispatch.view');
    return this.loadsService.simulateTrack(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await requireDispatchWrite(this.config, 'dispatch.delete', {
      method: 'DELETE',
      path: `/loads/${id}`,
    });
    return this.loadsService.remove(id);
  }

  private assertOwnLoad(load: { driverId?: string | null }) {
    const own = driverScopeId();
    if (!own) return;
    if (own === '__none__') {
      throw new ForbiddenException('Drivers may only access their own dispatches');
    }
    const store = getTenantStore();
    const ids = new Set<string>([own]);
    if (store?.userId) ids.add(store.userId);
    if (!load.driverId || !ids.has(load.driverId)) {
      throw new ForbiddenException('Drivers may only access their own dispatches');
    }
  }
}
