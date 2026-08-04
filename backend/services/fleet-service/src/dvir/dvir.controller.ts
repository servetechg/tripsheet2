import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DvirService } from './dvir.service';

@Controller('dvir')
export class DvirController {
  constructor(private readonly service: DvirService) {}

  @Get()
  list(
    @Query('companyId') companyId?: string,
    @Query('assetId') assetId?: string,
  ) {
    return this.service.list({ companyId, assetId });
  }

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
