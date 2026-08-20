import { Controller, Get, Param } from '@nestjs/common';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list() {
    return this.plans.list();
  }

  @Get(':code')
  byCode(@Param('code') code: string) {
    return this.plans.findByCode(code);
  }
}
