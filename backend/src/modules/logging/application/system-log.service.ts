import { Injectable } from '@nestjs/common';
import { LogLevel, Prisma } from '@prisma/client';

import { SystemLogRepository } from '../data/system-log.repository';

type LogMetadata = Record<string, unknown> | undefined;

@Injectable()
export class SystemLogService {
  constructor(private readonly repository: SystemLogRepository) {}

  async log(params: {
    level: LogLevel;
    module: string;
    eventName: string;
    message: string;
    metadata?: LogMetadata;
    persist?: boolean;
  }) {
    const payload = {
      timestamp: new Date().toISOString(),
      ...params,
    };

    console.log(JSON.stringify(payload));

    if (params.persist ?? params.level !== 'debug') {
      await this.repository.create({
        level: params.level,
        module: params.module,
        eventName: params.eventName,
        message: params.message,
        metadataJson: params.metadata as Prisma.InputJsonValue | undefined,
      });
    }
  }
}
