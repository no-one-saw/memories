import { NextResponse } from 'next/server';
import { getSessionCookie, isValidSessionCookieValue } from '@/lib/auth';

export const runtime = 'nodejs';

function requireAuth() {
  const sid = getSessionCookie();
  if (!isValidSessionCookieValue(sid)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

type SpotifyTokenCache = {
  accessToken: string;
  expiresAt: number;
};

async function getSpotifyAccessToken(): Promise<string> {
  const g = globalThis as unknown as { __mv_spotify_token_cache?: SpotifyTokenCache };
  const now = Date.now();
  const cached = g.__mv_spotify_token_cache;
  if (cached && cached.accessToken && cached.expiresAt - now > 60_000) {
    return cached.accessToken;
  }

  const clientId = requiredEnv('SPOTIFY_CLIENT_ID');
  const clientSecret = requiredEnv('SPOTIFY_CLIENT_SECRET');
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString()
  });

  if (!res.ok) {
    return Promise.reject(new Error(`spotify_token_failed:${res.status}`));
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  const accessToken = data?.access_token || '';
  const expiresIn = typeof data?.expires_in === 'number' ? data.expires_in : 3600;

  if (!accessToken) {
    return Promise.reject(new Error('spotify_token_missing'));
  }

  g.__mv_spotify_token_cache = {
    accessToken,
    expiresAt: now + expiresIn * 1000
  };

  return accessToken;
}

export async function GET(req: Request) {
  const unauth = requireAuth();
  if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const limitRaw = Number(searchParams.get('limit') || '10');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 10;

  if (!q) {
    return NextResponse.json({ error: 'missing_query' }, { status: 400 });
  }

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return NextResponse.json({ error: 'spotify_not_configured' }, { status: 503 });
  }

  const token = await getSpotifyAccessToken();
  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', q);
  url.searchParams.set('type', 'track');
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json'
    }
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'spotify_search_failed', status: res.status }, { status: 502 });
  }

  const data = await res.json();
  const items = (data?.tracks?.items || []) as any[];

  const tracks = items.map((t) => {
    const artists = Array.isArray(t?.artists) ? t.artists.map((a: any) => a?.name).filter(Boolean) : [];
    const images = Array.isArray(t?.album?.images) ? t.album.images : [];
    const image = images?.[images.length - 1]?.url || images?.[0]?.url || '';
    return {
      id: String(t?.id || ''),
      name: String(t?.name || ''),
      artists,
      album: String(t?.album?.name || ''),
      image,
      durationMs: typeof t?.duration_ms === 'number' ? t.duration_ms : 0,
      externalUrl: String(t?.external_urls?.spotify || ''),
      uri: String(t?.uri || '')
    };
  });

  return NextResponse.json({ tracks });
}
