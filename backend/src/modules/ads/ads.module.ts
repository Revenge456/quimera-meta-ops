import { Module } from '@nestjs/common';

import { AdsService } from './application/ads.service';
import { AdsRepository } from './data/ads.repository';
import { AdsController } from './presentation/ads.controller';

@Module({
  controllers: [AdsController],
  providers: [AdsRepository, AdsService],
})
export class AdsModule {}
