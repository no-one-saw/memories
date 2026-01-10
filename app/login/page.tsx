'use client';

import { useState, type ChangeEvent, type KeyboardEvent } from 'react';

export default function LoginPage() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [leaving, setLeaving] = useState(false);

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
      setLeaving(true);
      setTimeout(() => {
        window.location.href = '/';
      }, 460);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={leaving ? 'loginShell leaving' : 'loginShell'}>
      <div className="loginInner">
        <div className="navbar" role="navigation" aria-label="Login">
          <div className="navLeft" style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div className="navTitle">
              <img className="navLogo" src="/images/icon.png" alt="Nen's Memories" />
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
        style={{ display: ok ? 'grid' : 'none', placeItems: 'center' }}
      >
        <div className="loginSuccessOverlay" style={{ position: 'absolute', inset: 0 }} />
        <div
          className="loginSuccessPill"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 999, position: 'relative' }}
        >
          <div className="loginSuccessDot" style={{ width: 10, height: 10, borderRadius: 999 }} />
          <div style={{ fontWeight: 500, letterSpacing: '.2px', fontSize: 14 }}>Welcome back</div>
        </div>
      </div>
    </div>
  );
}
