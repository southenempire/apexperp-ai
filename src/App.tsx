import { useCallback, useEffect, useState } from 'react';
import { getAddress, isAddress, type Address } from 'viem';
import { Nav } from './components/Nav';
import { Dashboard } from './pages/Dashboard';
import { Landing } from './pages/Landing';
import { getPerps } from './lib/hooks';

/** Hash routes: `#/` landing, `#/app` dashboard, `#/app/0x…` a shareable watched address. */
function parseHash(hash: string): { page: 'landing' | 'app'; watched: Address | null } {
  const m = hash.match(/^#\/app(?:\/(0x[0-9a-fA-F]{40}))?/);
  if (!m) return { page: 'landing', watched: null };
  return { page: 'app', watched: m[1] && isAddress(m[1]) ? getAddress(m[1]) : null };
}

export function App() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  // Warm the market list so the dashboard's first account read skips it.
  useEffect(() => {
    getPerps().catch(() => {});
  }, []);

  useEffect(() => {
    const onHash = () => {
      const next = parseHash(window.location.hash);
      setRoute((prev) => {
        if (prev.page !== next.page) window.scrollTo(0, 0);
        return next;
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const launch = useCallback(() => {
    window.location.hash = '#/app';
  }, []);
  const watch = useCallback((a: Address | null) => {
    window.location.hash = a ? `#/app/${a}` : '#/app';
  }, []);

  return (
    <div className="min-h-screen">
      <Nav variant={route.page} onLaunch={launch} />
      {route.page === 'landing' ? <Landing onLaunch={launch} /> : <Dashboard watched={route.watched} onWatch={watch} />}
    </div>
  );
}

export default App;
