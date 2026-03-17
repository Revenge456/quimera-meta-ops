import { Injectable } from '@nestjs/common';
import { LogLevel, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SystemLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    level: LogLevel;
    module: string;
    eventName: string;
    message: string;
    metadataJson?: Prisma.InputJsonValue;
  }) {
    return this.prisma.systemLog.create({
      data,
    });
  }

  async findMany(params: {
    level?: LogLevel;
    module?: string;
    take: number;
    skip: number;
  }) {
    const where = {
      ...(params.level ? { level: params.level } : {}),
      ...(params.module ? { module: params.module } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.take,
        skip: params.skip,
      }),
      this.prisma.systemLog.count({ where }),
    ]);

    return { rows, total };
  }
}
