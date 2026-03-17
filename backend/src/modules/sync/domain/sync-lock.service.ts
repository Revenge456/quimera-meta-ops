import { Injectable } from '@nestjs/common';

@Injectable()
export class SyncLockService {
  private readonly locks = new Set<string>();

  acquire(key: string) {
    if (this.locks.has(key)) {
      return false;
    }

    this.locks.add(key);
    return true;
  }

  release(key: string) {
    this.locks.delete(key);
  }
}
