import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SyncType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { SyncEngineService } from '../application/sync-engine.service';

class TriggerSyncDto {
  @IsOptional()
  @IsEnum(SyncType)
  syncType: SyncType = SyncType.incremental;
}

class TriggerInsightsSyncDto {
  @IsOptional()
  @IsEnum(SyncType)
  syncType: SyncType = SyncType.incremental;

  @IsOptional()
  dateFrom?: string;

  @IsOptional()
  dateTo?: string;
}

@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SyncController {
  constructor(private readonly syncEngineService: SyncEngineService) {}

  @Post('clients/:clientId/catalog')
  triggerClientCatalogSync(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Body() body: TriggerSyncDto,
  ) {
    return this.syncEngineService.triggerClientSync(
      user,
      clientId,
      body.syncType,
    );
  }

  @Post('clients/:clientId/insights')
  triggerClientInsightsSync(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Body() body: TriggerInsightsSyncDto,
  ) {
    return this.syncEngineService.triggerClientInsightsSync(
      user,
      clientId,
      body.syncType,
      body.dateFrom,
      body.dateTo,
    );
  }

  @Get('logs')
  listLogs(@CurrentUser() user: AuthUser) {
    return this.syncEngineService.listSyncLogs(user);
  }
}
