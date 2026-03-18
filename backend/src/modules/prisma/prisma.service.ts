import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');
    const runtimeConnectionString = removeSslModeParam(connectionString);

    super({
      adapter: new PrismaPg(
        new Pool({
          connectionString: runtimeConnectionString,
          // Supabase pooler commonly presents a cert chain that node-postgres
          // rejects by default under Prisma 7 driver adapters.
          ssl: {
            rejectUnauthorized: false,
          },
        }),
      ),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

function removeSslModeParam(connectionString: string) {
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  return url.toString();
}
