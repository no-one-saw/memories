import { NextResponse } from 'next/server';
import { getSessionCookie, isValidSessionCookieValue } from '@/lib/auth';

export async function GET() {
  const sid = getSessionCookie();
  const authed = isValidSessionCookieValue(sid);
  return NextResponse.json({ authed });
}
