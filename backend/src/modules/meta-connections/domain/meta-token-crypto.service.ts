import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

@Injectable()
export class MetaTokenCryptoService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(plainText: string) {
    const key = this.resolveKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
  }

  decrypt(payload: string) {
    const [ivEncoded, authTagEncoded, encryptedEncoded] = payload.split('.');
    if (!ivEncoded || !authTagEncoded || !encryptedEncoded) {
      throw new ServiceUnavailableException(
        'No se pudo descifrar la credencial Meta almacenada',
      );
    }

    const key = this.resolveKey();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivEncoded, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTagEncoded, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  private resolveKey() {
    const secret =
      this.configService.get<string>('META_CONNECTIONS_ENCRYPTION_KEY') ??
      this.configService.get<string>('JWT_SECRET');

    if (!secret || secret === 'change-me') {
      throw new ServiceUnavailableException(
        'META_CONNECTIONS_ENCRYPTION_KEY o JWT_SECRET debe estar configurada para cifrar tokens Meta',
      );
    }

    return createHash('sha256').update(secret).digest();
  }
}
