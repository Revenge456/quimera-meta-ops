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
import { CommercialAdvisorService } from '../application/commercial-advisor.service';

class GenerateAdvisorFiltersDto {
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

class GenerateCommercialAdvisorDto {
  @IsString()
  clientId!: string;

  @IsIn(['campaign', 'ad_set', 'ad'])
  level!: 'campaign' | 'ad_set' | 'ad';

  @IsString()
  dateFrom!: string;

  @IsString()
  dateTo!: string;

  @IsOptional()
  @IsString()
  strategistAnalysisId?: string;

  @IsOptional()
  @IsString()
  contextHash?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => GenerateAdvisorFiltersDto)
  filters?: GenerateAdvisorFiltersDto;
}

class CommercialAdvisorHistoryQueryDto {
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

@Controller('commercial-advisor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'commercial_manager')
export class CommercialAdvisorController {
  constructor(private readonly commercialAdvisorService: CommercialAdvisorService) {}

  @Post('generate')
  generate(
    @CurrentUser() user: AuthUser,
    @Body() body: GenerateCommercialAdvisorDto,
  ) {
    return this.commercialAdvisorService.generateWithHistory(user, body);
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthUser,
    @Query() query: CommercialAdvisorHistoryQueryDto,
  ) {
    return this.commercialAdvisorService.listHistory(user, query);
  }

  @Get('history/:id')
  historyById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commercialAdvisorService.getHistoryById(user, id);
  }
}
