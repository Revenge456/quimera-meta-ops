import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL es requerida para ejecutar el seed');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString: removeSslModeParam(connectionString),
      ssl: {
        rejectUnauthorized: false,
      },
    }),
  ),
});

async function main() {
  const adminPasswordHash = await bcrypt.hash('admin123456', 10);
  const managerPasswordHash = await bcrypt.hash('manager123456', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@quimera.local' },
    update: {},
    create: {
      email: 'admin@quimera.local',
      nombre: 'Administrador Quimera',
      passwordHash: adminPasswordHash,
      role: UserRole.admin,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'comercial@quimera.local' },
    update: {},
    create: {
      email: 'comercial@quimera.local',
      nombre: 'Responsable Comercial',
      passwordHash: managerPasswordHash,
      role: UserRole.commercial_manager,
    },
  });

  const cliente = await prisma.client.upsert({
    where: { id: 'seed-client-quimera' },
    update: {
      nombre: 'Quimera Growth',
      empresa: 'Quimera',
      metaAdAccountIds: ['act_100000000000001'],
    },
    create: {
      id: 'seed-client-quimera',
      nombre: 'Quimera Growth',
      empresa: 'Quimera',
      metaAdAccountIds: ['act_100000000000001'],
    },
  });

  await prisma.clientAssignment.upsert({
    where: {
      userId_clienteId: {
        userId: manager.id,
        clienteId: cliente.id,
      },
    },
    update: {},
    create: {
      userId: manager.id,
      clienteId: cliente.id,
    },
  });

  const adAccount = await prisma.adAccount.upsert({
    where: { metaAccountId: 'act_100000000000001' },
    update: {
      clienteId: cliente.id,
      name: 'Quimera Main Account',
      currency: 'USD',
      timezone: 'America/Lima',
      status: 'ACTIVE',
    },
    create: {
      clienteId: cliente.id,
      metaAccountId: 'act_100000000000001',
      name: 'Quimera Main Account',
      currency: 'USD',
      timezone: 'America/Lima',
      status: 'ACTIVE',
      amountSpent: '0',
    },
  });

  const campaign = await prisma.campaign.upsert({
    where: { metaCampaignId: 'cmp_100000000000001' },
    update: {
      adAccountId: adAccount.id,
      name: 'Prospecting Peru',
      objective: 'LEADS',
      effectiveStatus: 'ACTIVE',
      configuredStatus: 'ACTIVE',
    },
    create: {
      adAccountId: adAccount.id,
      metaCampaignId: 'cmp_100000000000001',
      name: 'Prospecting Peru',
      objective: 'LEADS',
      effectiveStatus: 'ACTIVE',
      configuredStatus: 'ACTIVE',
    },
  });

  const adSet = await prisma.adSet.upsert({
    where: { metaAdsetId: 'adset_100000000000001' },
    update: {
      campaignId: campaign.id,
      name: 'Broad Interest LATAM',
      optimizationGoal: 'LEAD_GENERATION',
      effectiveStatus: 'ACTIVE',
    },
    create: {
      campaignId: campaign.id,
      metaAdsetId: 'adset_100000000000001',
      name: 'Broad Interest LATAM',
      optimizationGoal: 'LEAD_GENERATION',
      effectiveStatus: 'ACTIVE',
    },
  });

  const ad = await prisma.ad.upsert({
    where: { metaAdId: 'ad_100000000000001' },
    update: {
      adsetId: adSet.id,
      campaignId: campaign.id,
      name: 'Video Lead Ad',
      effectiveStatus: 'ACTIVE',
      configuredStatus: 'ACTIVE',
    },
    create: {
      adsetId: adSet.id,
      campaignId: campaign.id,
      metaAdId: 'ad_100000000000001',
      name: 'Video Lead Ad',
      effectiveStatus: 'ACTIVE',
      configuredStatus: 'ACTIVE',
    },
  });

  await prisma.adCreative.upsert({
    where: { metaCreativeId: 'crt_100000000000001' },
    update: {
      adId: ad.id,
      name: 'Video Lead Creative',
      headline: 'Impulsa tu crecimiento',
      callToAction: 'LEARN_MORE',
      assetType: 'video',
    },
    create: {
      adId: ad.id,
      metaCreativeId: 'crt_100000000000001',
      name: 'Video Lead Creative',
      headline: 'Impulsa tu crecimiento',
      callToAction: 'LEARN_MORE',
      assetType: 'video',
      landingUrl: 'https://quimera.local/demo',
    },
  });

  console.log('Seed completado.');
  console.log('Admin:', admin.email, 'password: admin123456');
  console.log('Manager:', manager.email, 'password: manager123456');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

function removeSslModeParam(value: string) {
  const url = new URL(value);
  url.searchParams.delete('sslmode');
  return url.toString();
}
