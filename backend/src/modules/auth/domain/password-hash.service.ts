import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

@Injectable()
export class PasswordHashService {
  async hash(password: string) {
    return bcrypt.hash(password, 10);
  }

  async compare(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }
}
