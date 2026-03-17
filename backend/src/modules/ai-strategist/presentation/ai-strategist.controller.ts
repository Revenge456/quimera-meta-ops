import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { AdsStrategistService } from '../application/ads-strategist.service';

class AnalyzeFiltersDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  adAccountId?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  adSetId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

class AnalyzeAdsStrategistDto {
  @IsString()
  clientId!: string;

  @IsIn(['campaign', 'ad_set', 'ad'])
  level!: 'campaign' | 'ad_set' | 'ad';

  @IsString()
  dateFrom!: string;

  @IsString()
  dateTo!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AnalyzeFiltersDto)
  filters?: AnalyzeFiltersDto;
}

class StrategistHistoryQueryDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsIn(['campaign', 'ad_set', 'ad'])
  level?: 'campaign' | 'ad_set' | 'ad';

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  generatedFrom?: string;

  @IsOptional()
  @IsString()
  generatedTo?: string;

  @IsOptional()
  @IsString()
  contextHash?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;
}

@Controller('ai-strategist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'commercial_manager')
export class AiStrategistController {
  constructor(private readonly adsStrategistService: AdsStrategistService) {}

  @Post('analyze')
  analyze(
    @CurrentUser() user: AuthUser,
    @Body() body: AnalyzeAdsStrategistDto,
  ) {
    return this.adsStrategistService.analyzeAndPersist(user, body);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query() query: StrategistHistoryQueryDto) {
    return this.adsStrategistService.listHistory(user, query);
  }

  @Get('history/:id')
  historyById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.adsStrategistService.getHistoryById(user, id);
  }
}
