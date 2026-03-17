import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LogLevel } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { SystemLogRepository } from '../data/system-log.repository';

class SystemLogsQueryDto {
  @IsOptional()
  @IsEnum(LogLevel)
  level?: LogLevel;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

@Controller('system-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SystemLogsController {
  constructor(private readonly repository: SystemLogRepository) {}

  @Get()
  async list(@Query() query: SystemLogsQueryDto) {
    const { rows, total } = await this.repository.findMany({
      level: query.level,
      module: query.module,
      take: query.pageSize,
      skip: (query.page - 1) * query.pageSize,
    });

    return {
      data: rows,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
      },
    };
  }
}
