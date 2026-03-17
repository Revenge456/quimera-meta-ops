import { Module } from '@nestjs/common';

import { AdAccountsService } from './application/ad-accounts.service';
import { AdAccountsRepository } from './data/ad-accounts.repository';
import { AdAccountsController } from './presentation/ad-accounts.controller';

@Module({
  controllers: [AdAccountsController],
  providers: [AdAccountsRepository, AdAccountsService],
})
export class AdAccountsModule {}
