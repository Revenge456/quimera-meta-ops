import { Module } from '@nestjs/common';

import { ClientsService } from './application/clients.service';
import { ClientsRepository } from './data/clients.repository';
import { ClientsController } from './presentation/clients.controller';

@Module({
  controllers: [ClientsController],
  providers: [ClientsRepository, ClientsService],
})
export class ClientsModule {}
