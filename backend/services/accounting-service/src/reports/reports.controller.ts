import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SummaryQueryDto } from './dto/summary-query.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getSummary(@Query() query: SummaryQueryDto) {
    return this.reportsService.getSummary(query.companyId);
  }
}
