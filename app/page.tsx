'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type NoteItem = {
  id: string;
  title: string;
  body: string;
  emoji?: string;
  color?: string;
  theme?: string;
  spotifyUrl?: string;
  createdAt: string;
  updatedAt: string;
};

function spotifyEmbedSrc(input: string) {
  const s = (input || '').trim();
  if (!s) return '';

  const uri = /^spotify:(track|album|playlist):([A-Za-z0-9]+)$/i.exec(s);
  if (uri) return `https://open.spotify.com/embed/${uri[1].toLowerCase()}/${uri[2]}`;

  try {
    const u = new URL(s);
    if (!/spotify\.com$/i.test(u.hostname.replace(/^open\./i, ''))) return '';
    const m = /^\/(track|album|playlist)\/([A-Za-z0-9]+)/i.exec(u.pathname);
    if (!m) return '';
    return `https://open.spotify.com/embed/${m[1].toLowerCase()}/${m[2]}`;
  } catch {
    return '';
  }
}

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
  const [theme, setTheme] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [editing, setEditing] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    if (!successMsg) return;
    const t = window.setTimeout(() => setSuccessMsg(''), 2400);
    return () => window.clearTimeout(t);
  }, [successMsg]);

  const colorOptions = useMemo(
    () => ['#6ea8ff', '#9d7bff', '#ff4fd8', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6'],
    []
  );

  const themeOptions = useMemo(() => ['', 'love'], []);

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

  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.body.classList.add('pageFadeIn');
    const t = window.setTimeout(() => document.body.classList.remove('pageFadeIn'), 420);
    return () => {
      window.clearTimeout(t);
      document.body.classList.remove('pageFadeIn');
    };
  }, []);

  useEffect(() => {
    if (!emojiOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEmojiOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [emojiOpen]);

  const filtered = useMemo(() => items, [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, NoteItem[]>();
    for (const it of filtered) {
      const key = dateKeyFromIso(it.createdAt);
      const arr = map.get(key);
      if (arr) arr.push(it);
      else map.set(key, [it]);
    }
    const out = Array.from(map.entries()).map(([key, its]) => ({
      key,
      items: its.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }));
    out.sort((a, b) => b.key.localeCompare(a.key));
    return out;
  }, [filtered]);

  function openCreate() {
    setMode('create');
    setActive(null);
    setTitle('');
    setBody('');
    setEmoji('');
    setColor(colorOptions[0] || '');
    setTheme('');
    setSpotifyUrl('');
    setEditing(true);
    setEmojiOpen(false);
    setOpen(true);
  }

  function openView(it: NoteItem) {
    setMode('view');
    setActive(it);
    setTitle(it.title);
    setBody(it.body || '');
    setEmoji(it.emoji || '');
    setColor(it.color || '');
    setTheme(it.theme || '');
    setSpotifyUrl(it.spotifyUrl || '');
    setEditing(false);
    setEmojiOpen(false);
    setOpen(true);
  }

  function cancelEdit() {
    if (!active) return;
    setTitle(active.title);
    setBody(active.body || '');
    setEmoji(active.emoji || '');
    setColor(active.color || '');
    setTheme(active.theme || '');
    setSpotifyUrl(active.spotifyUrl || '');
    setEditing(false);
    setEmojiOpen(false);
  }

  async function save() {
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: t, body, emoji, color, theme, spotifyUrl })
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

  async function updateMeta() {
    if (!active) return;
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(active.id)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: t, body, emoji, color, theme, spotifyUrl })
        }
      );
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
        setTheme(updated.theme || '');
        setSpotifyUrl(updated.spotifyUrl || '');
        setEditing(false);
        setEmojiOpen(false);
        setApiError('');
        setSuccessMsg('Updated successfully.');
      } else {
        await load();
      }
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
                <img className="navLogo" src="/images/icon.png" alt="Nen's Memories" />
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
                  </div>
                  <div className="subGrid">
                    {g.items.map((it) => (
                      <div
                        key={it.id}
                        className={it.theme === 'love' ? 'card theme-love' : 'card'}
                        role="button"
                        tabIndex={0}
                        onClick={() => openView(it)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openView(it);
                          }
                        }}
                      >
                        <div
                          className={it.theme === 'love' ? 'cardTop theme-love' : 'cardTop'}
                          style={it.theme === 'love' ? undefined : { background: cardTopGradient(it.color) }}
                        />
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
          <div className={theme === 'love' ? 'modal theme-love' : 'modal'}>
          <div className="modalHead">
            <div className="modalTitle">
              <div className="file">{mode === 'create' ? 'New note' : active?.title || '-'}</div>
              <div className="modalMetaPills">
                {mode === 'create' || !active ? null : (
                  <>
                    <div className="metaPill">
                      <svg className="pillIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 2v4" />
                        <path d="M16 2v4" />
                        <path d="M3 10h18" />
                        <path d="M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
                      </svg>
                      {formatDateTimeFull(active.createdAt)}
                    </div>
                    <div className="metaPill">
                      <svg className="pillIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-3-6.7" />
                        <path d="M21 3v6h-6" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                      {`Updated ${formatDateTimeFull(active.updatedAt)}`}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="modalActions">
              {mode !== 'create' ? (
                <button className="btn danger smallPillBtn" type="button" disabled={!active || busy} onClick={del}>
                  Delete
                </button>
              ) : null}
              {mode !== 'create' && !editing ? (
                <button className="btn smallPillBtn" type="button" disabled={!active || busy} onClick={() => setEditing(true)}>
                  Edit
                </button>
              ) : null}

              {mode === 'create' ? (
                <button className="btn primary smallPillBtn" type="button" disabled={busy || !title.trim()} onClick={save}>
                  Save
                </button>
              ) : (
                <>
                  {editing ? (
                    <button className="btn primary smallPillBtn" type="button" disabled={busy || !active || !title.trim()} onClick={updateMeta}>
                      Save changes
                    </button>
                  ) : null}
                  {editing ? (
                    <button className="btn smallPillBtn" type="button" disabled={busy || !active} onClick={cancelEdit}>
                      Cancel
                    </button>
                  ) : null}
                </>
              )}
              <button className="btn smallPillBtn" type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>

          {mode === 'create' || (active && editing) ? (
            <>
              <div className="metaRow metaRowControls">
                <div className="metaLeftControls">
                  <div className="emojiPicker">
                    <button
                      className="emojiBtn smallPillBtn"
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
                  </div>

                  <div className="themePicker" aria-label="Theme">
                    {themeOptions.map((t) => (
                      <button
                        key={t || 'none'}
                        type="button"
                        className={(t === theme ? 'themeBtn selected' : 'themeBtn') + ' smallPillBtn'}
                        onClick={() => setTheme(t)}
                        aria-label={t ? `Theme ${t}` : 'Theme none'}
                      >
                        {t ? (t === 'love' ? 'Love' : t) : 'None'}
                      </button>
                    ))}
                  </div>
                </div>

                {theme === 'love' ? (
                  <div className="metaRight" aria-hidden="true" />
                ) : (
                  <div className="metaRight">
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
                )}
              </div>
            </>
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

              <div className="field" style={{ marginTop: 10 }}>
                <div className="label">Spotify link</div>
                <input
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  placeholder="https://open.spotify.com/track/..."
                />
              </div>

              {spotifyUrl.trim() && spotifyEmbedSrc(spotifyUrl) ? (
                <div className="spotifyIframe" style={{ marginTop: 10 }}>
                  <iframe
                    title="Spotify"
                    style={{ borderRadius: 16, border: 'none', width: '100%', height: 152 }}
                    src={spotifyEmbedSrc(spotifyUrl)}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="noteView" style={{ marginTop: 10 }}>
              <div className="noteViewTitle">
                {emoji ? <span className="noteViewEmoji" aria-hidden="true">{emoji}</span> : null}
                <span className="noteViewTitleText">{active?.title || ''}</span>
              </div>
              <div className="noteViewBody">{active?.body || ''}</div>
              {active?.spotifyUrl && spotifyEmbedSrc(active.spotifyUrl) ? (
                <div className="spotifyIframe" style={{ marginTop: 10 }}>
                  <iframe
                    title="Spotify"
                    style={{ borderRadius: 16, border: 'none', width: '100%', height: 152 }}
                    src={spotifyEmbedSrc(active.spotifyUrl)}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {emojiOpen ? (
        <div
          className="emojiOverlay open"
          role="dialog"
          aria-modal="true"
          aria-label="Emoji picker"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEmojiOpen(false);
          }}
        >
          <div className="emojiDialog">
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
        </div>
      ) : null}
    </>
  );
}
