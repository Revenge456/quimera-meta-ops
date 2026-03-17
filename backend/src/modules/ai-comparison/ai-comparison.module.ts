import { Module } from '@nestjs/common';

import { AiStrategistModule } from '../ai-strategist/ai-strategist.module';
import { AiComparisonService } from './application/ai-comparison.service';
import { AiComparisonRepository } from './data/ai-comparison.repository';
import { AiComparisonController } from './presentation/ai-comparison.controller';

@Module({
  imports: [AiStrategistModule],
  controllers: [AiComparisonController],
  providers: [AiComparisonRepository, AiComparisonService],
})
export class AiComparisonModule {}
