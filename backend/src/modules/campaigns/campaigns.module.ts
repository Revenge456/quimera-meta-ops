import { Module } from '@nestjs/common';

import { CampaignsService } from './application/campaigns.service';
import { CampaignsRepository } from './data/campaigns.repository';
import { CampaignsController } from './presentation/campaigns.controller';

@Module({
  controllers: [CampaignsController],
  providers: [CampaignsRepository, CampaignsService],
})
export class CampaignsModule {}
