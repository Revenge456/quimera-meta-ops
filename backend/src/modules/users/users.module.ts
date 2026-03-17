import { Module } from '@nestjs/common';

import { PasswordHashService } from '../auth/domain/password-hash.service';
import { UsersService } from './application/users.service';
import { UsersRepository } from './data/users.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    UsersRepository,
    UsersService,
    PasswordHashService,
  ],
})
export class UsersModule {}
