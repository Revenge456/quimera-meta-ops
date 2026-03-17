import { Injectable } from '@nestjs/common';

import type { AuthUser } from '../../shared/types/auth-user.type';
import { AdCreativesRepository } from '../data/ad-creatives.repository';

@Injectable()
export class AdCreativesService {
  constructor(private readonly repository: AdCreativesRepository) {}

  list(
    actor: AuthUser,
    filters: {
      clienteId?: string;
      adAccountId?: string;
      campaignId?: string;
      adSetId?: string;
      adId?: string;
      search?: string;
    },
  ) {
    return this.repository.list(actor, filters);
  }

  detail(actor: AuthUser, id: string) {
    return this.repository.detail(actor, id);
  }
}
