import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const PASSWORD_PREFIX = 'scrypt';
const KEY_LENGTH = 64;

export function getPasswordPolicyError(password: string) {
  if (password.length < 10) return 'Password must be at least 10 characters';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return 'Password must include uppercase and lowercase letters';
  }
  if (!/\d/.test(password)) return 'Password must include a number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a special character';
  return null;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${PASSWORD_PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;

  const [prefix, salt, hash] = storedHash.split('$');
  if (prefix !== PASSWORD_PREFIX || !salt || !hash) return false;

  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  if (actual.length !== expected.length) return false;

  return timingSafeEqual(actual, expected);
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
