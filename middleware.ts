import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/images')) {
    return NextResponse.next();
  }

  const publicPaths = ['/login', '/blocked'];
  const publicApiPrefixes = ['/api/login', '/api/health'];

  const isPublicPath = publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isPublicApi = publicApiPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));

  const needsClientGate = !isPublicPath && !isPublicApi;
  if (needsClientGate) {
    const approved = req.cookies.get('mv_client')?.value === '1';
    const headerSecret = req.headers.get('x-mv-client') || '';
    const expected = process.env.MV_CLIENT_SECRET || '';
    const headerApproved = Boolean(expected) && headerSecret === expected;

    if (!approved && !headerApproved) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'mobile_client_required' }, { status: 403 });
      }
      const url = req.nextUrl.clone();
      url.pathname = '/blocked';
      return NextResponse.redirect(url);
    }

    if (!approved && headerApproved) {
      const res = NextResponse.next();
      res.cookies.set('mv_client', '1', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365
      });
      return res;
    }
  }

  // API routes handle auth themselves and should not be redirected.
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  const sid = req.cookies.get('mv_session')?.value;
  if (!sid) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
