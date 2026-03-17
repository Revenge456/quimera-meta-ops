import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        assignments: {
          include: {
            client: true,
          },
        },
      },
    });
  }

  async create(data: {
    email: string;
    nombre: string;
    passwordHash: string;
    role: UserRole;
    active?: boolean;
  }) {
    return this.prisma.user.create({
      data,
    });
  }

  async existsByEmail(email: string) {
    return this.prisma.user.count({
      where: { email },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
}
