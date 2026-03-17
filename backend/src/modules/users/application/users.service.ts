import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PasswordHashService } from '../../auth/domain/password-hash.service';
import { SystemLogService } from '../../logging/application/system-log.service';
import { UsersRepository } from '../data/users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly passwordHashService: PasswordHashService,
    private readonly systemLogService: SystemLogService,
  ) {}

  async list() {
    return this.repository.list();
  }

  async createUser(input: {
    email: string;
    nombre: string;
    password: string;
    role: UserRole;
  }) {
    const existing = await this.repository.existsByEmail(input.email);
    if (existing > 0) {
      throw new BadRequestException('El email ya existe');
    }

    const passwordHash = await this.passwordHashService.hash(input.password);
    const user = await this.repository.create({
      email: input.email,
      nombre: input.nombre,
      passwordHash,
      role: input.role,
    });

    await this.systemLogService.log({
      level: 'info',
      module: 'users',
      eventName: 'user_created',
      message: 'Usuario creado',
      metadata: {
        userId: user.id,
        role: user.role,
      },
    });

    return user;
  }
}
