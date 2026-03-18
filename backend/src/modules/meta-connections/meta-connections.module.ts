import { Module } from '@nestjs/common';

import { LoggingModule } from '../logging/logging.module';
import { MetaAdsClient } from '../sync/integration/meta-ads.client';
import { MetaConnectionsService } from './application/meta-connections.service';
import { MetaConnectionsRepository } from './data/meta-connections.repository';
import { MetaTokenCryptoService } from './domain/meta-token-crypto.service';
import { MetaConnectionsController } from './presentation/meta-connections.controller';

@Module({
  imports: [LoggingModule],
  controllers: [MetaConnectionsController],
  providers: [
    MetaConnectionsRepository,
    MetaConnectionsService,
    MetaTokenCryptoService,
    MetaAdsClient,
  ],
  exports: [MetaConnectionsService],
})
export class MetaConnectionsModule {}
