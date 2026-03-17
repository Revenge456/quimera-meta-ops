import {
  buildListMeta,
  buildMetricSummaryFromAggregate,
  resolveEntityListSort,
  resolvePagination,
  sortIdsByMetric,
} from './entity-list-query';

describe('entity-list-query', () => {
  it('falls back to safe defaults for invalid pagination params', () => {
    expect(resolvePagination('0', '-10')).toEqual({
      page: 1,
      pageSize: 1,
      skip: 0,
      take: 1,
    });

    expect(resolvePagination('not-a-number', '999')).toEqual({
      page: 1,
      pageSize: 100,
      skip: 0,
      take: 100,
    });
  });

  it('falls back to a safe default sort when sort params are invalid', () => {
    expect(resolveEntityListSort('drop table' as never, 'up')).toEqual({
      field: 'createdAt',
      order: 'desc',
      mode: 'entity',
    });
  });

  it('builds paginated meta consistently', () => {
    expect(
      buildListMeta({
        total: 41,
        pagination: {
          page: 2,
          pageSize: 10,
          skip: 10,
          take: 10,
        },
        sort: {
          field: 'spend',
          order: 'asc',
          mode: 'metric',
        },
      }),
    ).toEqual({
      page: 2,
      pageSize: 10,
      total: 41,
      totalPages: 5,
      sortBy: 'spend',
      sortOrder: 'asc',
    });
  });

  it('keeps entities without daily data behind entities with actual metric values on metric sort', () => {
    const summaries = new Map([
      [
        'entity-1',
        buildMetricSummaryFromAggregate({
          spend: '10',
          impressions: 100,
          clicks: 5,
          results: '1',
          purchases: '0',
          purchaseValue: '0',
        }),
      ],
      [
        'entity-2',
        buildMetricSummaryFromAggregate({
          spend: '0',
          impressions: 0,
          clicks: 0,
          results: null,
          purchases: '0',
          purchaseValue: '0',
        }),
      ],
    ]);

    expect(
      sortIdsByMetric({
        ids: ['entity-2', 'entity-3', 'entity-1'],
        summaries,
        field: 'results',
        order: 'desc',
      }),
    ).toEqual(['entity-1', 'entity-2', 'entity-3']);
  });

  it('treats missing summaries as empty metrics when sorting by numeric metrics', () => {
    const summaries = new Map([
      [
        'entity-1',
        buildMetricSummaryFromAggregate({
          spend: '10',
          impressions: 100,
          clicks: 5,
          results: '1',
          purchases: '0',
          purchaseValue: '0',
        }),
      ],
    ]);

    expect(
      sortIdsByMetric({
        ids: ['entity-2', 'entity-1'],
        summaries,
        field: 'spend',
        order: 'desc',
      }),
    ).toEqual(['entity-1', 'entity-2']);
  });
});
