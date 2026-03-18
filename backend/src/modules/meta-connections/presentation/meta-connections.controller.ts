import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  MetaConnectionStatus,
} from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { MetaConnectionsService } from '../application/meta-connections.service';

class ListMetaConnectionsQueryDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsEnum(MetaConnectionStatus)
  status?: MetaConnectionStatus;
}

class CreateMetaConnectionDto {
  @IsString()
  clientId!: string;

  @IsString()
  accessToken!: string;

  @IsOptional()
  @IsString()
  tokenType?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  metaBusinessId?: string;

  @IsOptional()
  @IsString()
  metaBusinessName?: string;
}

class AttachMetaAccountItemDto {
  @IsString()
  metaAccountId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  metaBusinessId?: string;

  @IsOptional()
  @IsString()
  metaBusinessName?: string;
}

class AttachMetaAccountsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttachMetaAccountItemDto)
  accounts!: AttachMetaAccountItemDto[];
}

@Controller('meta-connections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MetaConnectionsController {
  constructor(private readonly service: MetaConnectionsService) {}

  @Post()
  @Roles('admin')
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateMetaConnectionDto,
  ) {
    return this.service.createConnection(user, body);
  }

  @Get()
  @Roles('admin', 'commercial_manager')
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListMetaConnectionsQueryDto,
  ) {
    return this.service.listConnections(user, query);
  }

  @Get(':id')
  @Roles('admin', 'commercial_manager')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getConnection(user, id);
  }

  @Post(':id/validate')
  @Roles('admin')
  validate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.validateConnection(user, id);
  }

  @Post(':id/discover-ad-accounts')
  @Roles('admin')
  discover(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.discoverAdAccounts(user, id);
  }

  @Post(':id/attach-ad-accounts')
  @Roles('admin')
  attach(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: AttachMetaAccountsDto,
  ) {
    return this.service.attachAdAccounts(user, id, body);
  }
}
