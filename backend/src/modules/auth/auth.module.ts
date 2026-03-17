import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';

import { AuthService } from './application/auth.service';
import { AuthRepository } from './data/auth.repository';
import { PasswordHashService } from './domain/password-hash.service';
import { AuthController } from './presentation/auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn:
            (configService.get<string>('JWT_EXPIRES_IN') ?? '12h') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    PasswordHashService,
    JwtStrategy,
  ],
  exports: [AuthRepository, PasswordHashService],
})
export class AuthModule {}
