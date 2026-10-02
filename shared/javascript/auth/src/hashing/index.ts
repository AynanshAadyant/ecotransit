import crypto from 'crypto';
import type { IPasswordHasher } from '@ecotransit/contracts';

export class Argon2PasswordHasher implements IPasswordHasher {
  private readonly saltLength = 16;
  private readonly keyLength = 64;

  async hash(plaintext: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(this.saltLength).toString('hex');
      crypto.scrypt(plaintext, salt, this.keyLength, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`);
      });
    });
  }

  async verify(plaintext: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const parts = hash.split('$');
      if (parts.length !== 3 || parts[0] !== 'scrypt') {
        return resolve(false);
      }

      const salt = parts[1]!;
      const originalHash = parts[2]!;

      crypto.scrypt(plaintext, salt, this.keyLength, (err, derivedKey) => {
        if (err) return reject(err);
        const derivedHash = derivedKey.toString('hex');
        try {
          const match = crypto.timingSafeEqual(
            Buffer.from(originalHash, 'hex'),
            Buffer.from(derivedHash, 'hex'),
          );
          resolve(match);
        } catch {
          resolve(false);
        }
      });
    });
  }
}
