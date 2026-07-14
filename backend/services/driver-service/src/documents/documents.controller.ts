import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { UpsertDocumentDto } from './dto/upsert-document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(
    @Query('driverId') driverId?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.documentsService.findAll({ driverId, companyId });
  }

  @Post()
  upsert(@Body() dto: UpsertDocumentDto) {
    return this.documentsService.upsert(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
