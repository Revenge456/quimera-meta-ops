import { Injectable } from '@nestjs/common';

import type { AuthUser } from '../../shared/types/auth-user.type';
import { AdAccountsRepository } from '../data/ad-accounts.repository';

@Injectable()
export class AdAccountsService {
  constructor(private readonly repository: AdAccountsRepository) {}

  list(
    actor: AuthUser,
    filters: { clienteId?: string; status?: string; search?: string },
  ) {
    return this.repository.list(actor, filters);
  }

  detail(actor: AuthUser, id: string) {
    return this.repository.detail(actor, id);
  }
}
