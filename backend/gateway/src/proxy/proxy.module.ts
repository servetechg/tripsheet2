import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ProxyService } from './proxy.service';
import { AuthProxyController } from './auth.proxy.controller';
import { CompaniesProxyController } from './companies.proxy.controller';
import { DriversProxyController } from './drivers.proxy.controller';
import { LoadsProxyController } from './loads.proxy.controller';
import { AssetsProxyController } from './assets.proxy.controller';
import { ManifestsProxyController } from './manifests.proxy.controller';
import { TripSheetsProxyController } from './trip-sheets.proxy.controller';
import { InvitesProxyController } from './invites.proxy.controller';
import { DocumentsProxyController } from './documents.proxy.controller';
import { ContractsProxyController } from './contracts.proxy.controller';
import { CarrierProfilesProxyController } from './carrier-profiles.proxy.controller';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [
    AuthProxyController,
    CompaniesProxyController,
    DriversProxyController,
    LoadsProxyController,
    AssetsProxyController,
    ManifestsProxyController,
    TripSheetsProxyController,
    InvitesProxyController,
    DocumentsProxyController,
    ContractsProxyController,
    CarrierProfilesProxyController,
  ],
  providers: [ProxyService],
})
export class ProxyModule {}
