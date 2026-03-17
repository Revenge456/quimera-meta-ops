import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { ClientsService } from '../application/clients.service';

class ListClientsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ClientStatus)
  estado?: ClientStatus;
}

class CreateClientDto {
  @IsString()
  nombre!: string;

  @IsString()
  empresa!: string;

  @IsOptional()
  @IsEnum(ClientStatus)
  estado?: ClientStatus;
}

class AssignUserDto {
  @IsString()
  userId!: string;
}

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListClientsQueryDto) {
    return this.clientsService.list(user, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateClientDto) {
    return this.clientsService.create(user, body);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.clientsService.summary(user);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clientsService.detail(user, id);
  }

  @Post(':id/assignments')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: AssignUserDto,
  ) {
    return this.clientsService.assign(user, id, body.userId);
  }

  @Delete(':id/assignments/:userId')
  unassign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.clientsService.unassign(user, id, userId);
  }
}
