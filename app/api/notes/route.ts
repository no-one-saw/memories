import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionCookie, isValidSessionCookieValue } from '@/lib/auth';

function requireAuth() {
  const sid = getSessionCookie();
  if (!isValidSessionCookieValue(sid)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const unauth = requireAuth();
  if (unauth) return unauth;

  try {
    const db = await getDb();
    const notes = db.collection('notes');

    await notes.createIndex({ createdAt: -1 });

    const docs = await notes
      .find({}, { projection: { title: 1, body: 1, emoji: 1, color: 1, createdAt: 1, updatedAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(1000)
      .toArray();

    const items = docs.map((d: any) => ({
      id: String(d._id),
      title: d.title,
      body: d.body,
      emoji: d.emoji || '',
      color: d.color || '',
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: 'server_error', detail: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const unauth = requireAuth();
  if (unauth) return unauth;

  try {
    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const noteBody = typeof body?.body === 'string' ? body.body.trim() : '';
    const emoji = typeof body?.emoji === 'string' ? body.emoji.trim().slice(0, 8) : '';
    const color = typeof body?.color === 'string' ? body.color.trim().slice(0, 24) : '';

    if (!title) {
      return NextResponse.json({ error: 'missing_title' }, { status: 400 });
    }

    const db = await getDb();
    const notes = db.collection('notes');

    const doc = {
      title,
      body: noteBody,
      emoji,
      color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await notes.insertOne(doc);
    return NextResponse.json({
      item: {
        id: String(result.insertedId),
        ...doc
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'server_error', detail: String(e?.message || e) }, { status: 500 });
  }
}
