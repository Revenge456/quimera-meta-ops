import { InsightsRepository } from './insights.repository';

describe('InsightsRepository', () => {
  const prisma = {
    $transaction: jest.fn(),
    campaignInsightDaily: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
    adSetInsightDaily: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
    adInsightDaily: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  let repository: InsightsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new InsightsRepository(prisma as never);
  });

  it('uses campaignId + date as the idempotent key for campaign daily upserts', async () => {
    prisma.campaignInsightDaily.upsert.mockResolvedValue({ id: 'campaign-insight-1' });

    await repository.upsertCampaignInsightDaily({
      campaignId: 'campaign-1',
      date: new Date('2026-03-16'),
      rawJson: { foo: 'bar' },
    });

    expect(prisma.campaignInsightDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignId_date: {
            campaignId: 'campaign-1',
            date: new Date('2026-03-16'),
          },
        },
      }),
    );
  });

  it('uses adSetId + date as the idempotent key for ad set daily upserts', async () => {
    prisma.adSetInsightDaily.upsert.mockResolvedValue({ id: 'adset-insight-1' });

    await repository.upsertAdSetInsightDaily({
      adSetId: 'adset-1',
      date: new Date('2026-03-16'),
      rawJson: { foo: 'bar' },
    });

    expect(prisma.adSetInsightDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          adSetId_date: {
            adSetId: 'adset-1',
            date: new Date('2026-03-16'),
          },
        },
      }),
    );
  });

  it('uses adId + date as the idempotent key for ad daily upserts', async () => {
    prisma.adInsightDaily.upsert.mockResolvedValue({ id: 'ad-insight-1' });

    await repository.upsertAdInsightDaily({
      adId: 'ad-1',
      date: new Date('2026-03-16'),
      rawJson: { foo: 'bar' },
    });

    expect(prisma.adInsightDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          adId_date: {
            adId: 'ad-1',
            date: new Date('2026-03-16'),
          },
        },
      }),
    );
  });
});
