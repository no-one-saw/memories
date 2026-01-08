import crypto from 'crypto';
import { cookies } from 'next/headers';

const cookieName = 'mv_session';

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const secret = () => requiredEnv('SESSION_SECRET');

function sign(raw: string) {
  return crypto.createHmac('sha256', secret()).update(raw).digest('hex');
}

export function createSessionCookieValue() {
  const raw = crypto.randomBytes(32).toString('hex');
  const sig = sign(raw);
  return `${raw}.${sig}`;
}

export function isValidSessionCookieValue(value: string | undefined) {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 2) return false;
  const [raw, sig] = parts;
  const expected = sign(raw);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function getSessionCookie() {
  return cookies().get(cookieName)?.value;
}

export function setSessionCookie(value: string) {
  cookies().set(cookieName, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production'
  });
}

export function clearSessionCookie() {
  cookies().set(cookieName, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}
