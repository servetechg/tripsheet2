import { Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RbacService } from './rbac.service';

@Injectable()
class RbacCatalogBootstrap implements OnModuleInit {
  private readonly logger = new Logger(RbacCatalogBootstrap.name);

  constructor(private readonly rbac: RbacService) {}

  async onModuleInit() {
    try {
      await this.rbac.syncCatalog();
      this.logger.log('RBAC catalog synced');
    } catch (e) {
      this.logger.warn(
        `RBAC catalog sync skipped (run prisma migrate): ${
          e instanceof Error ? e.message : e
        }`,
      );
    }
  }
}

@Module({
  imports: [PrismaModule],
  providers: [RbacService, RbacCatalogBootstrap],
  exports: [RbacService],
})
export class RbacModule {}
