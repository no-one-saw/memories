'use client';

import { useState, type ChangeEvent, type KeyboardEvent } from 'react';

export default function LoginPage() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  async function go() {
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: pw })
      });
      if (!res.ok) {
        setErr('Wrong password');
        return;
      }
      setOk(true);
      setTimeout(() => {
        window.location.href = '/';
      }, 720);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="loginShell">
      <div className="loginInner">
        <div className="navbar" role="navigation" aria-label="Login">
          <div className="navLeft" style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div className="navTitle">
              <h1>Nen's Memories</h1>
            </div>
          </div>
          <div className="navRight" style={{ minWidth: 0, flex: '0 0 auto' }}>
            <span className="pill">Protected</span>
          </div>
        </div>

        <div className="loginCard">
          <div style={{ fontWeight: 500, fontSize: 16, margin: '2px 0 6px' }}>Enter password</div>
          <div style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.55, marginBottom: 14 }}>Sign in to view and manage your memories.</div>

          <div className="field" style={{ minWidth: 0, marginBottom: 10 }}>
            <div style={{ position: 'relative' }}>
              <input
                value={pw}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPw(e.target.value)}
                type={'password'}
                placeholder="Password"
                autoComplete="current-password"
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') go();
                }}
                style={{ paddingRight: 12 }}
              />
            </div>
          </div>

          <button className="btn primary smallPillBtn" type="button" disabled={busy || !pw} onClick={go}>
            {busy ? 'Logging in…' : 'Login'}
          </button>

          <div style={{ marginTop: 10, color: '#ffb4b4', fontSize: 12, minHeight: 16 }}>{err}</div>
        </div>
      </div>

      <div
        className="overlay"
        style={{ display: ok ? 'grid' : 'none', placeItems: 'center', background: 'rgba(11,16,32,.92)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', boxShadow: '0 26px 80px rgba(0,0,0,.55)' }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: 'linear-gradient(135deg,var(--accent),var(--accent2))', animation: 'pop 800ms ease-in-out infinite' }} />
          <div style={{ fontWeight: 500, letterSpacing: '.2px', fontSize: 14 }}>Welcome back</div>
        </div>
        <style jsx>{`
          @keyframes pop { 0%,100%{transform:scale(1)} 50%{transform:scale(1.25)} }
        `}</style>
      </div>
    </div>
  );
}
