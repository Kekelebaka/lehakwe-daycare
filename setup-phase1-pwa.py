#!/usr/bin/env python3
"""
Lehakwe Daycare Manager — Phase 1 PWA Shell
Run from: /Users/keke/projects/lehakwe-daycare

Creates / updates 6 files:
  inbox/public/icon.svg           (new — app icon)
  inbox/public/manifest.json      (new — PWA manifest)
  inbox/public/sw.js              (new — service worker)
  inbox/index.html                (update — PWA tags + SW registration)
  inbox/src/App.tsx               (update — Forge-pattern redesign)
  inbox/src/components/BottomNav.tsx   (new)
  inbox/src/components/ComingSoon.tsx  (new)
"""

import os, sys

# ── Verify directory ────────────────────────────────────────────────────────
for d in ['inbox', 'worker', 'site', 'db']:
    if not os.path.isdir(d):
        print(f"❌  Run this script from the lehakwe-daycare root. Missing: {d}/")
        sys.exit(1)

# ── File contents ────────────────────────────────────────────────────────────

ICON_SVG = '''\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1A3D7C"/>
  <path d="M256 72 L424 148 L424 284 Q424 388 256 456 Q88 388 88 284 L88 148 Z"
        fill="#F59E0B" opacity="0.95"/>
  <path d="M256 120 L392 184 L392 284 Q392 368 256 424 Q120 368 120 284 L120 184 Z"
        fill="#1A3D7C"/>
  <text x="256" y="310" text-anchor="middle"
        font-size="160" font-family="system-ui,sans-serif">🛡️</text>
  <text x="256" y="200" text-anchor="middle"
        font-size="56" font-weight="900" fill="#F59E0B"
        font-family="system-ui,sans-serif">L</text>
</svg>
'''

MANIFEST_JSON = '''\
{
  "name": "Lehakwe Daycare Manager",
  "short_name": "Lehakwe",
  "description": "Official management app for Lehakwe Daycare staff",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#1A3D7C",
  "theme_color": "#1A3D7C",
  "orientation": "portrait-primary",
  "lang": "en-ZA",
  "categories": ["education", "productivity"],
  "icons": [
    {
      "src": "/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "Inbox",
      "url": "/?tab=inbox",
      "description": "View parent messages"
    }
  ]
}
'''

SW_JS = '''\
/* Lehakwe Daycare Manager — Service Worker v1 */
const CACHE = 'lehakwe-v1';
const SHELL = ['/', '/index.html'];

/* Install: pre-cache the app shell */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

/* Activate: remove old caches */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Fetch: strategy by request type */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* API calls — network first, offline JSON fallback */
  if (url.pathname.startsWith('/api')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          /* Cache successful GET responses */
          if (e.request.method === 'GET' && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(async () => {
          /* Try stale cache for GET, else offline error */
          if (e.request.method === 'GET') {
            const cached = await caches.match(e.request);
            if (cached) return cached;
          }
          return new Response(
            JSON.stringify({ ok: false, error: 'You are offline. Please reconnect to send or receive messages.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  /* Navigation — serve app shell, fallback to cache */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/') || caches.match('/index.html'))
    );
    return;
  }

  /* Static assets — cache first */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
'''

INDEX_HTML = '''\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Lehakwe Daycare Manager</title>

  <!-- PWA -->
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#1A3D7C" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Lehakwe" />
  <link rel="apple-touch-icon" href="/icon.svg" />

  <!-- SEO -->
  <meta name="description" content="Staff management app for Lehakwe Daycare" />
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #F8FAFC; }
    #root { height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
  <script>
    if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(r => console.log('[SW] Registered:', r.scope))
          .catch(e => console.warn('[SW] Registration failed:', e));
      });
    }
  </script>
</body>
</html>
'''

APP_TSX = '''\
import { useState, useEffect, useCallback } from \'react\';
import { api, StaffMember } from \'./lib/api\';
import Inbox from \'./components/Inbox\';
import ThreadView from \'./components/ThreadView\';
import BottomNav, { Tab } from \'./components/BottomNav\';
import ComingSoon from \'./components/ComingSoon\';

export default function App() {
  const [me, setMe] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(\'\');
  const [tab, setTab] = useState<Tab>(\'inbox\');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  /* Auth */
  const loadMe = useCallback(async () => {
    try {
      setMe(await api.getMe());
    } catch (e) {
      setError(e instanceof Error ? e.message : \'Not authenticated\');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener(\'online\', goOnline);
    window.addEventListener(\'offline\', goOffline);

    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener(\'beforeinstallprompt\', handler);

    return () => {
      window.removeEventListener(\'online\', goOnline);
      window.removeEventListener(\'offline\', goOffline);
      window.removeEventListener(\'beforeinstallprompt\', handler);
    };
  }, [loadMe]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  /* Loading screen */
  if (loading) {
    return (
      <div style={{
        display: \'flex\', alignItems: \'center\', justifyContent: \'center\',
        height: \'100vh\', background: \'#1A3D7C\', flexDirection: \'column\', gap: 16,
      }}>
        <div style={{ fontSize: \'3rem\' }}>🛡️</div>
        <div style={{ color: \'#F59E0B\', fontWeight: 700, fontSize: \'1.1rem\' }}>Lehakwe Daycare</div>
        <div style={{ color: \'rgba(255,255,255,0.5)\', fontSize: \'0.85rem\' }}>Loading...</div>
      </div>
    );
  }

  /* Access denied */
  if (error || !me) {
    return (
      <div style={{
        display: \'flex\', alignItems: \'center\', justifyContent: \'center\',
        height: \'100vh\', background: \'#1A3D7C\', flexDirection: \'column\', gap: 16, padding: 24,
      }}>
        <div style={{ fontSize: \'3rem\' }}>🔒</div>
        <div style={{ color: \'#fff\', fontWeight: 700, fontSize: \'1.2rem\' }}>Access Restricted</div>
        <div style={{ color: \'rgba(255,255,255,0.6)\', fontSize: \'0.9rem\', textAlign: \'center\', maxWidth: 320 }}>
          {error || \'Please sign in with your Lehakwe staff email to continue.\'}
        </div>
      </div>
    );
  }

  const inThread = tab === \'inbox\' && threadId !== null;

  return (
    <div style={{ display: \'flex\', flexDirection: \'column\', height: \'100vh\', background: \'#F8FAFC\' }}>

      {/* ── Top bar ── */}
      <div style={{
        background: \'#1A3D7C\', height: 52, flexShrink: 0,
        display: \'flex\', alignItems: \'center\', padding: \'0 16px\', gap: 10,
        paddingTop: \'env(safe-area-inset-top)\',
      }}>
        {inThread ? (
          <button
            onClick={() => setThreadId(null)}
            style={{
              background: \'rgba(255,255,255,0.12)\', border: \'none\', color: \'#F59E0B\',
              padding: \'6px 12px\', borderRadius: 8, cursor: \'pointer\',
              fontWeight: 700, fontSize: \'0.85rem\',
            }}
          >
            ← Back
          </button>
        ) : (
          <span style={{ fontSize: \'1.3rem\' }}>🛡️</span>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: \'#F59E0B\', fontWeight: 800, fontSize: \'0.95rem\', lineHeight: 1 }}>
            Lehakwe Manager
          </div>
          {!inThread && (
            <div style={{ color: \'rgba(255,255,255,0.55)\', fontSize: \'0.7rem\', marginTop: 1 }}>
              {me.name} · {me.role}
            </div>
          )}
        </div>

        {/* Install prompt */}
        {installPrompt && (
          <button
            onClick={handleInstall}
            style={{
              background: \'#F59E0B\', border: \'none\', color: \'#1A3D7C\',
              padding: \'5px 10px\', borderRadius: 8, cursor: \'pointer\',
              fontWeight: 700, fontSize: \'0.72rem\', flexShrink: 0,
            }}
          >
            📲 Install
          </button>
        )}

        {/* Offline dot */}
        <div style={{
          width: 8, height: 8, borderRadius: \'50\', flexShrink: 0,
          background: online ? \'#10B981\' : \'#EF4444\',
          boxShadow: online ? \'0 0 6px #10B981\' : \'0 0 6px #EF4444\',
        }} title={online ? \'Online\' : \'Offline\'} />
      </div>

      {/* ── Offline banner ── */}
      {!online && (
        <div style={{
          background: \'#FEF3C7\', borderBottom: \'1px solid #F59E0B\',
          padding: \'8px 16px\', textAlign: \'center\',
          fontSize: \'0.8rem\', fontWeight: 600, color: \'#92400E\', flexShrink: 0,
        }}>
          📵 No connection — showing cached data. New messages will send when you reconnect.
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflow: \'auto\', WebkitOverflowScrolling: \'touch\' } as any}>
        {tab === \'inbox\' && !inThread && (
          <Inbox onOpenThread={setThreadId} currentStaffId={me.id} />
        )}
        {tab === \'inbox\' && inThread && (
          <ThreadView
            threadId={threadId!}
            staffId={me.id}
            staffName={me.name}
            onBack={() => setThreadId(null)}
          />
        )}
        {tab === \'children\' && <ComingSoon icon="👶" title="Children" desc="Child profiles, attendance, milestones, and document storage." />}
        {tab === \'staff\' && <ComingSoon icon="👩‍💼" title="Staff" desc="Staff records, leave tracking, and UIF/PAYE management." />}
        {tab === \'payslips\' && <ComingSoon icon="💰" title="Payslips" desc="Generate branded A4 payslips and track monthly payments." />}
        {tab === \'settings\' && (
          <div style={{ padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: \'1.1rem\', marginBottom: 20 }}>Settings</div>
            <div style={{
              background: \'white\', borderRadius: 12, padding: \'20px 16px\',
              boxShadow: \'0 1px 3px rgba(0,0,0,0.06)\',
            }}>
              <div style={{ fontSize: \'0.75rem\', color: \'#6B7280\', textTransform: \'uppercase\', letterSpacing: \'0.08em\', marginBottom: 12 }}>Signed In As</div>
              <div style={{ fontWeight: 700 }}>{me.name}</div>
              <div style={{ fontSize: \'0.85rem\', color: \'#6B7280\', marginTop: 2 }}>{me.email}</div>
              <div style={{
                marginTop: 8, display: \'inline-block\',
                background: \'#EEF2FF\', color: \'#3730A3\',
                padding: \'3px 10px\', borderRadius: 20, fontSize: \'0.72rem\', fontWeight: 700,
              }}>
                {me.role}
              </div>
            </div>

            <div style={{
              background: \'white\', borderRadius: 12, padding: \'20px 16px\',
              boxShadow: \'0 1px 3px rgba(0,0,0,0.06)\', marginTop: 12,
            }}>
              <div style={{ fontSize: \'0.75rem\', color: \'#6B7280\', textTransform: \'uppercase\', letterSpacing: \'0.08em\', marginBottom: 12 }}>System</div>
              <div style={{ display: \'flex\', justifyContent: \'space-between\', padding: \'8px 0\', borderBottom: \'1px solid #F3F4F6\', fontSize: \'0.9rem\' }}>
                <span>Official email</span><span style={{ color: \'#6B7280\' }}>info@lehakwedaycare.co.za</span>
              </div>
              <div style={{ display: \'flex\', justifyContent: \'space-between\', padding: \'8px 0\', borderBottom: \'1px solid #F3F4F6\', fontSize: \'0.9rem\' }}>
                <span>Phone</span><span style={{ color: \'#6B7280\' }}>061 549 1701</span>
              </div>
              <div style={{ display: \'flex\', justifyContent: \'space-between\', padding: \'8px 0\', fontSize: \'0.9rem\' }}>
                <span>Connection</span>
                <span style={{ color: online ? \'#10B981\' : \'#EF4444\', fontWeight: 600 }}>
                  {online ? \'✓ Online\' : \'✗ Offline\'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 24, textAlign: \'center\', color: \'#9CA3AF\', fontSize: \'0.72rem\' }}>
              Lehakwe Daycare Manager v1.0<br/>
              Powered by ChiefOps AI · Ubuntu Town ECD OS
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom navigation ── */}
      <BottomNav active={inThread ? \'inbox\' : tab} onSelect={t => { setTab(t); if (t !== \'inbox\') setThreadId(null); }} />
    </div>
  );
}
'''

BOTTOM_NAV_TSX = '''\
export type Tab = \'inbox\' | \'children\' | \'staff\' | \'payslips\' | \'settings\';

interface Props {
  active: Tab;
  onSelect: (tab: Tab) => void;
}

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: \'inbox\',    icon: \'📬\', label: \'Inbox\'    },
  { id: \'children\', icon: \'👶\', label: \'Children\' },
  { id: \'staff\',    icon: \'👩‍💼\', label: \'Staff\'    },
  { id: \'payslips\', icon: \'💰\', label: \'Payslips\' },
  { id: \'settings\', icon: \'⚙️\', label: \'Settings\' },
];

export default function BottomNav({ active, onSelect }: Props) {
  return (
    <nav style={{
      background: \'#1A3D7C\',
      display: \'flex\',
      borderTop: \'1px solid rgba(255,255,255,0.1)\',
      flexShrink: 0,
      paddingBottom: \'env(safe-area-inset-bottom)\',
    }}>
      {TABS.map(t => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              flex: 1, border: \'none\', background: \'transparent\',
              display: \'flex\', flexDirection: \'column\', alignItems: \'center\',
              justifyContent: \'center\', gap: 3, padding: \'8px 4px\',
              cursor: \'pointer\',
              borderTop: isActive ? \'2px solid #F59E0B\' : \'2px solid transparent\',
              transition: \'all 0.15s\',
            }}
          >
            <span style={{ fontSize: \'1.3rem\', lineHeight: 1 }}>{t.icon}</span>
            <span style={{
              fontSize: \'0.62rem\', fontWeight: isActive ? 700 : 500,
              color: isActive ? \'#F59E0B\' : \'rgba(255,255,255,0.5)\',
              letterSpacing: \'0.03em\',
            }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
'''

COMING_SOON_TSX = '''\
interface Props {
  icon: string;
  title: string;
  desc: string;
}

export default function ComingSoon({ icon, title, desc }: Props) {
  return (
    <div style={{
      display: \'flex\', flexDirection: \'column\', alignItems: \'center\',
      justifyContent: \'center\', height: \'100%\', padding: 40, textAlign: \'center\',
      minHeight: 300,
    }}>
      <div style={{ fontSize: \'3.5rem\', marginBottom: 16 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: \'1.3rem\', marginBottom: 8 }}>{title}</div>
      <div style={{ color: \'#6B7280\', fontSize: \'0.9rem\', maxWidth: 280, lineHeight: 1.6, marginBottom: 20 }}>
        {desc}
      </div>
      <div style={{
        background: \'#EEF2FF\', color: \'#3730A3\', padding: \'6px 16px\',
        borderRadius: 20, fontSize: \'0.75rem\', fontWeight: 700,
        letterSpacing: \'0.05em\', textTransform: \'uppercase\',
      }}>
        Coming in Phase 2
      </div>
    </div>
  );
}
'''

# ── Write files ──────────────────────────────────────────────────────────────

FILES = {
    'inbox/public/icon.svg':                  ICON_SVG,
    'inbox/public/manifest.json':             MANIFEST_JSON,
    'inbox/public/sw.js':                     SW_JS,
    'inbox/index.html':                       INDEX_HTML,
    'inbox/src/App.tsx':                      APP_TSX,
    'inbox/src/components/BottomNav.tsx':     BOTTOM_NAV_TSX,
    'inbox/src/components/ComingSoon.tsx':    COMING_SOON_TSX,
}

print('\n🛡️  Lehakwe Daycare Manager — Phase 1 PWA Shell\n')

ok = 0
for path, content in FILES.items():
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  ✅  {path}')
        ok += 1
    except Exception as e:
        print(f'  ❌  {path}  →  {e}')

print(f'\n{ok}/{len(FILES)} files written.\n')

if ok == len(FILES):
    print('Next steps:')
    print('  1.  cd inbox && npm install && cd ..')
    print('  2.  git add -A')
    print('  3.  git commit -m "feat: Phase 1 — PWA shell, offline support, bottom nav"')
    print('  4.  git push')
    print('  5.  cd inbox && npm run build')
    print('  6.  wrangler pages deploy dist --project-name=lehakwe-inbox')
    print('  7.  cd ..\n')
