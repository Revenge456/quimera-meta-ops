import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AdsStrategistRepository } from './data/ads-strategist.repository';
import { AdsStrategistAnalyzer } from './domain/ads-strategist-analyzer';
import { AiLlmService } from './application/ai-llm.service';
import { AdsStrategistService } from './application/ads-strategist.service';
import { AiStrategistController } from './presentation/ai-strategist.controller';

@Module({
  imports: [ConfigModule],
  controllers: [AiStrategistController],
  providers: [
    AdsStrategistRepository,
    AdsStrategistAnalyzer,
    AiLlmService,
    AdsStrategistService,
  ],
  exports: [AiLlmService, AdsStrategistService],
})
export class AiStrategistModule {}
