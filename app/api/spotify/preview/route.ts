import { NextResponse } from 'next/server';
import { getSessionCookie, isValidSessionCookieValue } from '@/lib/auth';

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

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

async function getSpotifyAccessToken() {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - 10_000 > now) return tokenCache.accessToken;

  let clientId = '';
  let clientSecret = '';
  try {
    clientId = requiredEnv('SPOTIFY_CLIENT_ID');
    clientSecret = requiredEnv('SPOTIFY_CLIENT_SECRET');
  } catch (e: any) {
    throw new Error(String(e?.message || e || 'Missing Spotify credentials'));
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Spotify token failed (${res.status}) ${text}`);
  }

  const data = (await res.json().catch(() => null)) as any;
  const accessToken = typeof data?.access_token === 'string' ? data.access_token : '';
  const expiresIn = typeof data?.expires_in === 'number' ? data.expires_in : 0;
  if (!accessToken || !expiresIn) throw new Error('Spotify token invalid response');

  tokenCache = { accessToken, expiresAt: now + expiresIn * 1000 };
  return accessToken;
}

function parseSpotifyTrackId(raw: string) {
  const s = raw.trim();
  if (!s) return null;

  const uri = /^spotify:track:([A-Za-z0-9]+)$/i.exec(s);
  if (uri) return uri[1];

  const m = /^https?:\/\/(open\.)?spotify\.com\/track\/([A-Za-z0-9]+)(\?.*)?$/i.exec(s);
  if (m) return m[2];

  return null;
}

export async function GET(req: Request) {
  const unauth = requireAuth();
  if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') || '';
  const id = parseSpotifyTrackId(url);

  if (!id) {
    return NextResponse.json({ error: 'invalid_spotify_track' }, { status: 400 });
  }

  try {
    const token = await getSpotifyAccessToken();

    const res = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({ error: 'spotify_track_fetch_failed', detail: `${res.status} ${text}` }, { status: 502 });
    }

    const data = (await res.json().catch(() => null)) as any;

    const previewUrl = typeof data?.preview_url === 'string' ? data.preview_url : '';
    const title = typeof data?.name === 'string' ? data.name : '';
    const artists = Array.isArray(data?.artists) ? data.artists.map((a: any) => a?.name).filter(Boolean).join(', ') : '';
    const images = Array.isArray(data?.album?.images) ? data.album.images : [];
    const imageUrl = typeof images?.[1]?.url === 'string' ? images[1].url : typeof images?.[0]?.url === 'string' ? images[0].url : '';
    const openUrl = typeof data?.external_urls?.spotify === 'string' ? data.external_urls.spotify : url;

    if (!previewUrl) {
      return NextResponse.json({ error: 'no_preview', id, title, artists, imageUrl, openUrl }, { status: 200 });
    }

    return NextResponse.json({
      id,
      title,
      artists,
      imageUrl,
      previewUrl,
      openUrl
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (/Missing env: SPOTIFY_CLIENT_ID|Missing env: SPOTIFY_CLIENT_SECRET/i.test(msg)) {
      return NextResponse.json({ error: 'missing_spotify_credentials', detail: msg }, { status: 500 });
    }
    return NextResponse.json({ error: 'server_error', detail: msg }, { status: 500 });
  }
}
