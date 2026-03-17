import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { AdCreativesService } from '../application/ad-creatives.service';

class ListAdCreativesQueryDto {
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
  adId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

@Controller('ad-creatives')
@UseGuards(JwtAuthGuard)
export class AdCreativesController {
  constructor(private readonly adCreativesService: AdCreativesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAdCreativesQueryDto,
  ) {
    return this.adCreativesService.list(user, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.adCreativesService.detail(user, id);
  }
}
