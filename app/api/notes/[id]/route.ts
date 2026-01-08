import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getSessionCookie, isValidSessionCookieValue } from '@/lib/auth';

function requireAuth() {
  const sid = getSessionCookie();
  if (!isValidSessionCookieValue(sid)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const unauth = requireAuth();
  if (unauth) return unauth;

  const id = ctx.params.id;
  let _id: ObjectId;
  try {
    _id = new ObjectId(id);
  } catch {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const db = await getDb();
  const notes = db.collection('notes');
  const result = await notes.deleteOne({ _id });

  if (!result.deletedCount) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const unauth = requireAuth();
  if (unauth) return unauth;

  const id = ctx.params.id;
  let _id: ObjectId;
  try {
    _id = new ObjectId(id);
  } catch {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const emoji = typeof body?.emoji === 'string' ? body.emoji.trim().slice(0, 8) : undefined;
  const color = typeof body?.color === 'string' ? body.color.trim().slice(0, 24) : undefined;

  if (emoji === undefined && color === undefined) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 });
  }

  const $set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (emoji !== undefined) $set.emoji = emoji;
  if (color !== undefined) $set.color = color;

  const db = await getDb();
  const notes = db.collection('notes');
  const result = await notes.updateOne({ _id }, { $set });

  if (!result.matchedCount) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const updated = await notes.findOne(
    { _id },
    { projection: { title: 1, body: 1, emoji: 1, color: 1, createdAt: 1, updatedAt: 1 } }
  );

  return NextResponse.json({
    item: updated
      ? {
          id,
          title: (updated as any).title,
          body: (updated as any).body,
          emoji: (updated as any).emoji || '',
          color: (updated as any).color || '',
          createdAt: (updated as any).createdAt,
          updatedAt: (updated as any).updatedAt
        }
      : { ok: true }
  });
}
