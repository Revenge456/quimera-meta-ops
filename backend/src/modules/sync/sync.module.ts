import { Module } from '@nestjs/common';

import { InsightsModule } from '../insights/insights.module';
import { LoggingModule } from '../logging/logging.module';
import { MetaConnectionsModule } from '../meta-connections/meta-connections.module';
import { SyncEngineService } from './application/sync-engine.service';
import { SyncRepository } from './data/sync.repository';
import { SyncController } from './presentation/sync.controller';
import { MetaAdsClient } from './integration/meta-ads.client';
import { SyncLockService } from './domain/sync-lock.service';

@Module({
  imports: [LoggingModule, InsightsModule, MetaConnectionsModule],
  controllers: [SyncController],
  providers: [
    SyncRepository,
    SyncEngineService,
    MetaAdsClient,
    SyncLockService,
  ],
})
export class SyncModule {}
