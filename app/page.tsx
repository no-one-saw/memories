'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type NoteItem = {
  id: string;
  title: string;
  body: string;
  emoji?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
};

function dateKeyFromIso(iso: string) {
  const d = new Date(iso);
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayKey(key: string) {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(key);
  if (!m) return key;
  const [y, mo, d] = key.split('-').map((v) => Number(v));
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return key;
  return dt.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function TitlePill({ title }: { title: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const next = el.scrollWidth > el.clientWidth + 1;
      setFade(next);
    };

    const raf = requestAnimationFrame(measure);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }

    window.addEventListener('resize', measure, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [title]);

  return (
    <div className="titlePill">
      <span ref={ref} className={fade ? 'titleText fade' : 'titleText'}>
        {title}
      </span>
    </div>
  );
}

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHexColor(input: string) {
  const s = input.trim();
  if (!s.startsWith('#')) return null;
  const hex = s.slice(1);
  if (hex.length === 3) {
    const r = Number.parseInt(hex[0] + hex[0], 16);
    const g = Number.parseInt(hex[1] + hex[1], 16);
    const b = Number.parseInt(hex[2] + hex[2], 16);
    return { r, g, b };
  }
  if (hex.length === 6) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function toRgba(rgb: { r: number; g: number; b: number }, alpha: number) {
  return `rgba(${clampByte(rgb.r)},${clampByte(rgb.g)},${clampByte(rgb.b)},${Math.max(0, Math.min(1, alpha))})`;
}

function cardTopGradient(base?: string) {
  const fallback = 'rgba(255,255,255,.06)';
  const c = (base || '').trim();
  if (!c) return fallback;

  const rgb = parseHexColor(c);
  if (!rgb) {
    return `linear-gradient(90deg, ${c} 0%, rgba(255,255,255,.22) 48%, ${c} 100%)`;
  }

  const light = {
    r: mix(rgb.r, 255, 0.22),
    g: mix(rgb.g, 255, 0.22),
    b: mix(rgb.b, 255, 0.22)
  };
  const dark = {
    r: mix(rgb.r, 0, 0.12),
    g: mix(rgb.g, 0, 0.12),
    b: mix(rgb.b, 0, 0.12)
  };

  return `linear-gradient(90deg, ${toRgba(dark, 0.95)} 0%, ${toRgba(light, 0.92)} 52%, ${toRgba(rgb, 0.88)} 100%)`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatDateTimeFull(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default function HomePage() {
  const [items, setItems] = useState<NoteItem[]>([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'view'>('view');
  const [active, setActive] = useState<NoteItem | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [emoji, setEmoji] = useState('');
  const [color, setColor] = useState('');
  const [editing, setEditing] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [showCreatedFull, setShowCreatedFull] = useState(false);
  const [showUpdatedFull, setShowUpdatedFull] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!successMsg) return;
    const t = window.setTimeout(() => setSuccessMsg(''), 2400);
    return () => window.clearTimeout(t);
  }, [successMsg]);

  const colorOptions = useMemo(
    () => ['#6ea8ff', '#9d7bff', '#ff4fd8', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#ffffff'],
    []
  );

  const emojiOptions = useMemo(
    () => [
      '📝',
      '✨',
      '💭',
      '🧠',
      '📌',
      '🔥',
      // Hearts
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🤎',
      '🖤',
      '🤍',
      '💔',
      '❣️',
      '💕',
      '💞',
      '💓',
      '💗',
      '💖',
      '💘',
      '💝',
      '💟',
      '❤️‍🔥',
      '❤️‍🩹',
      '🫶',
      // Misc
      '😴',
      '😂',
      '🥶',
      '🎧',
      '☕',
      '🍀',
      '🌙',
      '⭐'
    ],
    []
  );

  async function load() {
    const res = await fetch('/api/notes');
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      setApiError(`GET /api/notes failed (${res.status}) ${text}`);
      return;
    }
    const data = await res.json();
    const next = Array.isArray(data?.items) ? (data.items as NoteItem[]) : [];
    next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setItems(next);
    setApiError('');
  }

  async function updateMeta() {
    if (!active) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(active.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body, emoji, color })
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setApiError(`PATCH /api/notes/${active.id} failed (${res.status}) ${text}`);
        return;
      }
      const data = await res.json().catch(() => null);
      const updated = data?.item as NoteItem | undefined;
      if (updated?.id) {
        setItems((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
        setActive(updated);
        setTitle(updated.title);
        setBody(updated.body || '');
        setEmoji(updated.emoji || '');
        setColor(updated.color || '');
      } else {
        await load();
      }
      setEmojiOpen(false);
      setApiError('');
      setOpen(false);
      setSuccessMsg('Updated successfully.');
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!emojiOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEmojiOpen(false);
    };

    const onPointerDown = (e: MouseEvent) => {
      const root = emojiPickerRef.current;
      const t = e.target as Node | null;
      if (!root || !t) return;
      if (!root.contains(t)) setEmojiOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [emojiOpen]);

  const filtered = useMemo(() => items, [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, NoteItem[]>();
    for (const it of filtered) {
      const dk = dateKeyFromIso(it.createdAt);
      const arr = map.get(dk) || [];
      arr.push(it);
      map.set(dk, arr);
    }
    const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    return keys.map((k) => ({ key: k, items: map.get(k) || [] }));
  }, [filtered]);

  function openCreate() {
    setMode('create');
    setActive(null);
    setTitle('');
    setBody('');
    setEmoji('');
    setColor(colorOptions[0] || '');
    setEditing(true);
    setEmojiOpen(false);
    setShowCreatedFull(false);
    setShowUpdatedFull(false);
    setOpen(true);
    setTimeout(() => {
      const el = document.getElementById('noteTitle') as HTMLInputElement | null;
      el?.focus();
    }, 0);
  }

  function openView(it: NoteItem) {
    setMode('view');
    setActive(it);
    setTitle(it.title);
    setBody(it.body || '');
    setEmoji(it.emoji || '');
    setColor(it.color || '');
    setEditing(false);
    setEmojiOpen(false);
    setShowCreatedFull(false);
    setShowUpdatedFull(false);
    setOpen(true);
  }

  function cancelEdit() {
    if (!active) return;
    setTitle(active.title);
    setBody(active.body || '');
    setEmoji(active.emoji || '');
    setColor(active.color || '');
    setEditing(false);
    setEmojiOpen(false);
  }

  async function save() {
    if (mode !== 'create') return;
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: t, body, emoji, color })
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setApiError(`POST /api/notes failed (${res.status}) ${text}`);
        return;
      }
      setOpen(false);
      setApiError('');
      setSuccessMsg('Saved successfully.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!active) return;
    const ok = window.confirm('Delete this note?');
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(active.id)}`, { method: 'DELETE' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) return;
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header>
        <div className="wrap">
          <div className="navbar" role="navigation" aria-label="Notes">
            <div className="navLeft">
              <div className="navTitle">
                <h1>Nen's Memories</h1>
              </div>
              <div className="navStatus">
                <span className="pill">{items.length} notes</span>
              </div>
            </div>
            <div className="navRight">
              <button className="btn primary" type="button" onClick={openCreate}>
                <svg className="btnIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                New Note
              </button>
            </div>
          </div>
          {successMsg ? <div className="successBanner">{successMsg}</div> : null}
          {apiError ? <div className="errorBanner">{apiError}</div> : null}
        </div>
      </header>

      <main className="main">
        <div className="wrap">
          {filtered.length === 0 ? (
            <div className="empty">
              <h2>No items</h2>
              <p>Create your first note.</p>
            </div>
          ) : (
            <div className="days" aria-live="polite">
              {grouped.map((g) => (
                <section key={g.key} className="daySection">
                  <div className="dayHead">
                    <div className="date">{formatDayKey(g.key)}</div>
                    <div className="counts">{g.items.length} notes</div>
                  </div>
                  <div className="subGrid">
                    {g.items.map((it) => (
                      <div key={it.id} className="card" role="button" tabIndex={0} onClick={() => openView(it)}>
                        <div className="cardTop" style={{ background: cardTopGradient(it.color) }} />
                        <div className="titleRow">
                          {it.emoji ? <div className="emojiBadge">{it.emoji}</div> : null}
                          <TitlePill title={it.title} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>

      <div
        className={open ? 'overlay open' : 'overlay'}
        role="dialog"
        aria-modal="true"
        aria-label="Note"
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className="modal">
          <div className="modalHead">
            <div className="modalTitle">
              <div className="file">{mode === 'create' ? 'New note' : active?.title || '-'}</div>
              <div className="modalMetaPills">
                {mode === 'create' || !active ? null : (
                  <>
                    <button
                      className="metaPill metaPillBtn"
                      type="button"
                      aria-label={showCreatedFull ? 'Hide created date' : 'Show created date'}
                      aria-expanded={showCreatedFull}
                      onClick={() => setShowCreatedFull((v) => !v)}
                    >
                      <svg className="pillIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 2v4" />
                        <path d="M16 2v4" />
                        <path d="M3 10h18" />
                        <path d="M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
                      </svg>
                      {showCreatedFull ? formatDateTimeFull(active.createdAt) : null}
                    </button>
                    <button
                      className="metaPill metaPillBtn"
                      type="button"
                      aria-label={showUpdatedFull ? 'Hide updated date' : 'Show updated date'}
                      aria-expanded={showUpdatedFull}
                      onClick={() => setShowUpdatedFull((v) => !v)}
                    >
                      <svg className="pillIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-3-6.7" />
                        <path d="M21 3v6h-6" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                      {showUpdatedFull ? `Updated ${formatDateTimeFull(active.updatedAt)}` : null}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="modalActions">
              {mode !== 'create' ? (
                <button className="iconBtn" type="button" disabled={!active || busy} onClick={del}>
                  <svg className="btnIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M6 6l1 16h10l1-16" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                  Delete
                </button>
              ) : null}
              {mode !== 'create' && !editing ? (
                <button className="iconBtn" type="button" disabled={!active || busy} onClick={() => setEditing(true)}>
                  <svg className="btnIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Edit
                </button>
              ) : null}

              {mode === 'create' ? (
                <button className="iconBtn" type="button" disabled={busy || !title.trim()} onClick={save}>
                  <svg className="btnIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                    <path d="M17 21v-8H7v8" />
                    <path d="M7 3v5h8" />
                  </svg>
                  Save
                </button>
              ) : (
                <>
                  {editing ? (
                    <button className="iconBtn" type="button" disabled={busy || !active || !title.trim()} onClick={updateMeta}>
                      <svg className="btnIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                        <path d="M17 21v-8H7v8" />
                        <path d="M7 3v5h8" />
                      </svg>
                      Save changes
                    </button>
                  ) : null}
                  {editing ? (
                    <button className="iconBtn" type="button" disabled={busy || !active} onClick={cancelEdit}>
                      <svg className="btnIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-9-9" />
                        <path d="M3 12h9" />
                        <path d="M3 12l3-3" />
                        <path d="M3 12l3 3" />
                      </svg>
                      Cancel
                    </button>
                  ) : null}
                </>
              )}
              <button className="iconBtn" type="button" onClick={() => setOpen(false)}>
                <svg className="btnIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="M6 6l12 12" />
                </svg>
                Close
              </button>
            </div>
          </div>

          {mode === 'create' || (active && editing) ? (
            <div className="metaRow">
              <div ref={emojiPickerRef} className={emojiOpen ? 'emojiPicker open' : 'emojiPicker'}>
                <button
                  className="emojiBtn"
                  type="button"
                  onClick={() => setEmojiOpen((v) => !v)}
                >
                  <span className="emojiBtnInner">
                    <span className={emoji ? 'emojiBtnBadge on' : 'emojiBtnBadge'} aria-hidden="true">
                      {emoji || '🙂'}
                    </span>
                    <span className="emojiBtnLabel">Emoji</span>
                  </span>
                </button>
                {emojiOpen ? (
                  <div className="emojiMenu" role="dialog" aria-label="Emoji picker">
                    <div className="emojiHeader">
                      <div className="emojiHeaderTitle">Pick an emoji</div>
                      <button className="emojiClose" type="button" onClick={() => setEmojiOpen(false)} aria-label="Close">
                        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18" />
                          <path d="M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="emojiGrid" role="list">
                      {emojiOptions.map((em) => (
                        <button
                          key={em}
                          type="button"
                          className={emoji === em ? 'emojiOpt selected' : 'emojiOpt'}
                          onClick={() => {
                            setEmoji(em);
                            setEmojiOpen(false);
                          }}
                          role="listitem"
                          aria-label={`Emoji ${em}`}
                        >
                          <span className="emojiGlyph" aria-hidden="true">
                            {em}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="emojiFooter">
                      <button
                        type="button"
                        className="emojiClear"
                        onClick={() => {
                          setEmoji('');
                          setEmojiOpen(false);
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="swatches" aria-label="Cover color">
                {colorOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={c === color ? 'swatch selected' : 'swatch'}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {mode === 'create' || editing ? (
            <>
              <div className="field" style={{ marginTop: 10 }}>
                <div className="label">
                  <svg className="labelIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h10" />
                  </svg>
                  Title
                </div>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
              </div>
              <div className="field" style={{ marginTop: 10 }}>
                <div className="label">
                  <svg className="labelIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16v16H4z" />
                    <path d="M8 9h8" />
                    <path d="M8 13h8" />
                    <path d="M8 17h6" />
                  </svg>
                  Note
                </div>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your note..." />
              </div>
            </>
          ) : (
            <div className="noteView" style={{ marginTop: 10 }}>
              <div className="noteViewTitle">
                {emoji ? <span className="noteViewEmoji" aria-hidden="true">{emoji}</span> : null}
                <span className="noteViewTitleText">{active?.title || ''}</span>
              </div>
              <div className="noteViewBody">{active?.body || ''}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
