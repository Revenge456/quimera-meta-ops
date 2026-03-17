import { Module } from '@nestjs/common';

import { AiStrategistModule } from '../ai-strategist/ai-strategist.module';
import { CommercialAdvisorService } from './application/commercial-advisor.service';
import { CommercialAdvisorRepository } from './data/commercial-advisor.repository';
import { CommercialAdvisorController } from './presentation/commercial-advisor.controller';

@Module({
  imports: [AiStrategistModule],
  controllers: [CommercialAdvisorController],
  providers: [CommercialAdvisorRepository, CommercialAdvisorService],
})
export class CommercialAdvisorModule {}
