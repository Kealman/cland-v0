// Passwords stay at the HTTP boundary; encoded records contain a fresh salt and scrypt output.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const derive = (password: string, salt: string): Promise<Buffer> => new Promise((resolve, reject) => {
  scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => error ? reject(error) : resolve(key));
});
export async function hashPassword(password: string): Promise<string> {
  if ([...password].length < 12 || Buffer.byteLength(password) > 1024) throw new Error('Password must contain at least 12 characters and at most 1024 bytes');
  const salt = randomBytes(32).toString('hex');
  return `scrypt$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (Buffer.byteLength(password) > 1024) return false;
  const parts = /^scrypt\$([a-f0-9]{64})\$([a-f0-9]{128})$/.exec(hash);
  return parts ? timingSafeEqual(await derive(password, parts[1]!), Buffer.from(parts[2]!, 'hex')) : false;
}
