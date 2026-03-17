import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { SystemLogService } from '../../logging/application/system-log.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { AuthRepository } from '../data/auth.repository';
import { PasswordHashService } from '../domain/password-hash.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly passwordHashService: PasswordHashService,
    private readonly jwtService: JwtService,
    private readonly systemLogService: SystemLogService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.repository.findByEmail(email);

    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const isValid = await this.passwordHashService.compare(
      password,
      user.passwordHash,
    );

    if (!isValid) {
      await this.systemLogService.log({
        level: 'warn',
        module: 'auth',
        eventName: 'login_failed',
        message: 'Intento de login fallido',
        metadata: { email },
      });
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const authUser: AuthUser = {
      sub: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role,
    };

    await this.systemLogService.log({
      level: 'info',
      module: 'auth',
      eventName: 'login_success',
      message: 'Usuario autenticado',
      metadata: {
        userId: user.id,
        role: user.role,
      },
    });

    return {
      accessToken: await this.jwtService.signAsync(authUser),
      user: authUser,
    };
  }

  async me(userId: string) {
    const user = await this.repository.findById(userId);

    if (!user || !user.active) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role,
      active: user.active,
    };
  }
}
