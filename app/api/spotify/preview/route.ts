import { NextResponse } from 'next/server';
import { getSessionCookie, isValidSessionCookieValue } from '@/lib/auth';

function requireAuth() {
  const sid = getSessionCookie();
  if (!isValidSessionCookieValue(sid)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(req: Request) {
  const unauth = requireAuth();
  if (unauth) return unauth;

  return NextResponse.json({ error: 'gone' }, { status: 410 });
}
