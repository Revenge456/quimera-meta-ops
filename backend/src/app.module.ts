import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AiComparisonModule } from './modules/ai-comparison/ai-comparison.module';
import { AiStrategistModule } from './modules/ai-strategist/ai-strategist.module';
import { AdAccountsModule } from './modules/ad-accounts/ad-accounts.module';
import { AdCreativesModule } from './modules/ad-creatives/ad-creatives.module';
import { AdsModule } from './modules/ads/ads.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdSetsModule } from './modules/ad-sets/ad-sets.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { CommercialAdvisorModule } from './modules/commercial-advisor/commercial-advisor.module';
import { ClientsModule } from './modules/clients/clients.module';
import { HealthModule } from './modules/health/health.module';
import { InsightsModule } from './modules/insights/insights.module';
import { LoggingModule } from './modules/logging/logging.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { SyncModule } from './modules/sync/sync.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    LoggingModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    AiComparisonModule,
    AiStrategistModule,
    CommercialAdvisorModule,
    AdAccountsModule,
    CampaignsModule,
    AdSetsModule,
    AdsModule,
    AdCreativesModule,
    InsightsModule,
    SyncModule,
    HealthModule,
  ],
})
export class AppModule {}
