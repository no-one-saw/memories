import { NextResponse } from 'next/server';
import { createSessionCookieValue, setSessionCookie } from '@/lib/auth';

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';
  const expected = requiredEnv('APP_PASSWORD');

  if (password !== expected) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 });
  }

  const sid = createSessionCookieValue();
  setSessionCookie(sid);
  return NextResponse.json({ ok: true });
}
