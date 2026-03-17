import { Module } from '@nestjs/common';

import { AdSetsService } from './application/ad-sets.service';
import { AdSetsRepository } from './data/ad-sets.repository';
import { AdSetsController } from './presentation/ad-sets.controller';

@Module({
  controllers: [AdSetsController],
  providers: [AdSetsRepository, AdSetsService],
})
export class AdSetsModule {}
