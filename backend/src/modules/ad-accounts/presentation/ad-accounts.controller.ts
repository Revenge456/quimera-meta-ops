import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { AdAccountsService } from '../application/ad-accounts.service';

class ListAdAccountsQueryDto {
  @IsOptional()
  @IsString()
  clienteId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

@Controller('ad-accounts')
@UseGuards(JwtAuthGuard)
export class AdAccountsController {
  constructor(private readonly adAccountsService: AdAccountsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAdAccountsQueryDto,
  ) {
    return this.adAccountsService.list(user, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.adAccountsService.detail(user, id);
  }
}
