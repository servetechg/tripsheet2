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
import { SettlementsProxyController } from './settlements.proxy.controller';
import { ReportsProxyController } from './reports.proxy.controller';
import { NotificationsProxyController } from './notifications.proxy.controller';
import {
  AccountsProxyController,
  AuditProxyController,
  BillsProxyController,
  CommentsProxyController,
  DvirProxyController,
  InvoicesProxyController,
  MaintenanceProxyController,
  MessagesProxyController,
  PaymentsProxyController,
} from './extended.proxy.controllers';
import {
  PlansProxyController,
  TenantsProxyController,
} from './platform.proxy.controllers';

@Module({
  imports: [
    HttpModule.register({
      timeout: 120000,
      maxRedirects: 3,
      maxBodyLength: 30 * 1024 * 1024,
      maxContentLength: 30 * 1024 * 1024,
    }),
    ConfigModule,
  ],
  controllers: [
    AuthProxyController,
    CompaniesProxyController,
    PlansProxyController,
    TenantsProxyController,
    DriversProxyController,
    LoadsProxyController,
    AssetsProxyController,
    ManifestsProxyController,
    TripSheetsProxyController,
    InvitesProxyController,
    DocumentsProxyController,
    ContractsProxyController,
    CarrierProfilesProxyController,
    SettlementsProxyController,
    ReportsProxyController,
    NotificationsProxyController,
    MaintenanceProxyController,
    DvirProxyController,
    InvoicesProxyController,
    BillsProxyController,
    PaymentsProxyController,
    AccountsProxyController,
    MessagesProxyController,
    CommentsProxyController,
    AuditProxyController,
  ],
  providers: [ProxyService],
})
export class ProxyModule {}
