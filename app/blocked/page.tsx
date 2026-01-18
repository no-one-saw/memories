'use client';

export default function BlockedPage() {
  return (
    <div className="loginShell">
      <div className="loginInner">
        <div className="navbar" role="navigation" aria-label="Blocked">
          <div className="navLeft" style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div className="navTitle">
              <img className="navLogo" src="/images/icon.png" alt="Nen's Memories" />
            </div>
          </div>
          <div className="navRight" style={{ minWidth: 0, flex: '0 0 auto' }}>
            <span className="pill">Blocked</span>
          </div>
        </div>

        <div className="loginCard">
          <div style={{ fontWeight: 600, fontSize: 16, margin: '2px 0 6px' }}>Access denied</div>
          <div style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.55, marginBottom: 14 }}>
            This site can only be accessed from the mobile client.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.55 }}>
            If you don&apos;t have the mobile client, you don&apos;t have access.
          </div>
        </div>
      </div>
    </div>
  );
}
