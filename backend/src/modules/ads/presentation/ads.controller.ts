import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { AdsService } from '../application/ads.service';

class ListAdsQueryDto {
  @IsOptional()
  @IsString()
  clienteId?: string;

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
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: string;
}

@Controller('ads')
@UseGuards(JwtAuthGuard)
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListAdsQueryDto) {
    return this.adsService.list(user, query);
  }

  @Get(':id')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: ListAdsQueryDto,
  ) {
    return this.adsService.detail(user, id, query);
  }

  @Get(':id/daily-chart')
  dailyChart(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: ListAdsQueryDto,
  ) {
    return this.adsService.dailyChart(user, id, query);
  }
}
