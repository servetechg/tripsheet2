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
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { ListAssetsDto } from './dto/list-assets.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  findAll(@Query() query: ListAssetsDto) {
    return this.assetsService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateAssetDto) {
    return this.assetsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assetsService.update(id, dto);
  }

  @Patch(':id/toggle-active')
  toggleActive(@Param('id') id: string) {
    return this.assetsService.toggleActive(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assetsService.remove(id);
  }
}
