import { Injectable } from '@nestjs/common';

import type { AuthUser } from '../../shared/types/auth-user.type';
import { AdsRepository } from '../data/ads.repository';

@Injectable()
export class AdsService {
  constructor(private readonly repository: AdsRepository) {}

  list(
    actor: AuthUser,
    filters: {
      clienteId?: string;
      adAccountId?: string;
      campaignId?: string;
      adSetId?: string;
      status?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number | string;
      pageSize?: number | string;
      sortBy?: string;
      sortOrder?: string;
    },
  ) {
    return this.repository.list(actor, filters);
  }

  detail(
    actor: AuthUser,
    id: string,
    filters: {
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    return this.repository.detail(actor, id, filters);
  }

  dailyChart(
    actor: AuthUser,
    id: string,
    filters: {
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    return this.repository.dailyChart(actor, id, filters);
  }
}
