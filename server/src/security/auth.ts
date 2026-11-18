// Session tokens (random, stored hashed) and scrypt password hashing.
import crypto from 'node:crypto';

export function newToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const SCRYPT_N = 16384;
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await new Promise<Buffer>((res, rej) =>
    crypto.scrypt(password, salt, 64, { N: SCRYPT_N, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))),
  );
  return `scrypt$${SCRYPT_N}$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algo, n, saltB64, keyB64] = stored.split('$');
  if (algo !== 'scrypt') return false;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(keyB64, 'base64');
  const key = await new Promise<Buffer>((res, rej) =>
    crypto.scrypt(password, salt, expected.length, { N: Number(n), r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))),
  );
  return crypto.timingSafeEqual(key, expected);
}
export function validatePassword(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 6 || pw.length > 100) return 'Password must be 6-100 characters';
  return null;
}
