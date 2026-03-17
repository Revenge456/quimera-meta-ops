import { Module } from '@nestjs/common';

import { AdCreativesService } from './application/ad-creatives.service';
import { AdCreativesRepository } from './data/ad-creatives.repository';
import { AdCreativesController } from './presentation/ad-creatives.controller';

@Module({
  controllers: [AdCreativesController],
  providers: [AdCreativesRepository, AdCreativesService],
})
export class AdCreativesModule {}
