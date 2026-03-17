import { Global, Module } from '@nestjs/common';

import { SystemLogService } from './application/system-log.service';
import { SystemLogRepository } from './data/system-log.repository';
import { SystemLogsController } from './presentation/system-logs.controller';

@Global()
@Module({
  controllers: [SystemLogsController],
  providers: [SystemLogRepository, SystemLogService],
  exports: [SystemLogService],
})
export class LoggingModule {}
