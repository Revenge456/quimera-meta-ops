import { Module } from '@nestjs/common';

import { InsightsRepository } from './data/insights.repository';

@Module({
  providers: [InsightsRepository],
  exports: [InsightsRepository],
})
export class InsightsModule {}
