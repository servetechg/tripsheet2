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
import { ManifestsService } from './manifests.service';
import { CreateManifestDto } from './dto/create-manifest.dto';
import { UpdateManifestDto } from './dto/update-manifest.dto';
import { RejectManifestDto } from './dto/reject-manifest.dto';

@Controller('manifests')
export class ManifestsController {
  constructor(private readonly manifestsService: ManifestsService) {}

  @Get()
  findAll(@Query('companyId') companyId?: string) {
    return this.manifestsService.findAll(companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.manifestsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateManifestDto) {
    return this.manifestsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateManifestDto) {
    return this.manifestsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.manifestsService.remove(id);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.manifestsService.submit(id);
  }

  @Post(':id/accept')
  accept(@Param('id') id: string) {
    return this.manifestsService.accept(id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectManifestDto) {
    return this.manifestsService.reject(id, dto);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.manifestsService.cancel(id);
  }
}
