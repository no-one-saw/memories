import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/images')) {
    return NextResponse.next();
  }

  const publicPaths = ['/blocked'];
  const publicApiPrefixes = ['/api/health'];

  const isPublicPath = publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isPublicApi = publicApiPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));

  const needsClientGate = !isPublicPath && !isPublicApi;
  if (needsClientGate) {
    const approved = req.cookies.get('mv_client')?.value === '1';
    const headerSecret = req.headers.get('x-mv-client') || '';
    const expected = process.env.MV_CLIENT_SECRET || '';
    const headerApproved = Boolean(expected) && headerSecret === expected;

    const shouldSetClientCookie = !approved && headerApproved;

    if (!approved && !headerApproved) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'mobile_client_required' }, { status: 403 });
      }
      const url = req.nextUrl.clone();
      url.pathname = '/blocked';
      return NextResponse.redirect(url);
    }

    // If the client is approved via header, we set a persistent cookie on the final response
    // (we must not early-return here, otherwise we skip auth redirects).
    if (shouldSetClientCookie) {
      // store it on the request object via a symbol-less convention
      (req as any).__mv_set_client_cookie = true;
    }
  }

  // API routes handle auth themselves and should not be redirected.
  if (pathname.startsWith('/api')) {
    const res = NextResponse.next();
    if ((req as any).__mv_set_client_cookie) {
      res.cookies.set('mv_client', '1', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365
      });
    }
    return res;
  }

  if (pathname.startsWith('/blocked')) {
    const res = NextResponse.next();
    if ((req as any).__mv_set_client_cookie) {
      res.cookies.set('mv_client', '1', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365
      });
    }
    return res;
  }

  if (pathname.startsWith('/login')) {
    const res = NextResponse.next();
    if ((req as any).__mv_set_client_cookie) {
      res.cookies.set('mv_client', '1', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365
      });
    }
    return res;
  }

  const sid = req.cookies.get('mv_session')?.value;
  if (!sid) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    const res = NextResponse.redirect(url);
    if ((req as any).__mv_set_client_cookie) {
      res.cookies.set('mv_client', '1', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365
      });
    }
    return res;
  }

  const res = NextResponse.next();
  if ((req as any).__mv_set_client_cookie) {
    res.cookies.set('mv_client', '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365
    });
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
