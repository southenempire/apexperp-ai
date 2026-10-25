import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, LogOut, Moon, Sun, Wallet } from 'lucide-react';
import { useWallet } from '../lib/wallet';
import { useBlockNumber } from '../lib/hooks';
import { shortAddress } from '../lib/format';
import { CopyButton, LiveDot, Logo } from './ui';

type Theme = 'dark' | 'light';

/** Two-position breaker switch for the colour theme. The choice is saved; until then it follows the system. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  const light = theme === 'light';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={light}
      aria-label="Light theme"
      title={light ? 'Switch to dark' : 'Switch to light'}
      onClick={() => {
        const next: Theme = light ? 'dark' : 'light';
        setTheme(next);
        try {
          localStorage.setItem('apexperp:theme', next);
        } catch {}
      }}
      className="relative grid h-10 w-[72px] shrink-0 grid-cols-2 border border-border p-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
    >
      <span
        className={`absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] bg-accent transition-transform duration-200 ease-out ${light ? 'translate-x-full' : ''}`}
        aria-hidden="true"
      />
      <span className={`relative flex items-center justify-center ${light ? 'text-muted' : 'text-accent-fg'}`} aria-hidden="true">
        <Moon className="h-4 w-4" />
      </span>
      <span className={`relative flex items-center justify-center ${light ? 'text-accent-fg' : 'text-muted'}`} aria-hidden="true">
        <Sun className="h-4 w-4" />
      </span>
    </button>
  );
}

export function NetworkBadge() {
  const { data: block, error } = useBlockNumber();
  return (
    <span className="hidden min-h-10 items-center gap-2 border border-border px-3 text-xs text-muted md:inline-flex">
      <LiveDot tone={error ? 'danger' : 'safe'} />
      <span className="font-display font-bold uppercase tracking-wider">Somnia Tokyo</span>
      {block !== null && <span className="num text-fg">#{block.toLocaleString()}</span>}
    </span>
  );
}

export function WalletButton({ onConnected }: { onConnected?: () => void }) {
  const { address, owner, viaSmartAccount, resolving, connect, connecting, disconnect, onRightChain, switchChain, error } = useWallet();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  if (resolving) {
    return (
      <button type="button" className="btn-secondary" disabled>
        Finding your account
      </button>
    );
  }

  if (!address) {
    return (
      <div className="flex flex-col items-end">
        <button type="button" className="btn-primary" disabled={connecting} onClick={async () => (await connect()) && onConnected?.()}>
          <Wallet className="h-4 w-4" aria-hidden="true" />
          {connecting ? (
            'Check your wallet'
          ) : (
            <>
              Connect<span className="hidden sm:inline"> wallet</span>
            </>
          )}
        </button>
        {error && <span className="sr-only" role="alert">{error}</span>}
      </div>
    );
  }

  if (!onRightChain) {
    return (
      <button type="button" className="btn hazard-yellow text-accent-fg" onClick={switchChain}>
        <span className="flex items-center gap-2 bg-accent px-2 py-1">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Wrong network, switch
        </span>
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button type="button" className="btn-secondary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="h-2 w-2 rounded-full bg-safe" aria-hidden="true" />
        <span className="num">{shortAddress(address)}</span>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 border border-border bg-surface-2 p-2">
          <div className="px-2 pt-1">
            <p className="label">{viaSmartAccount ? 'Somnia Account' : 'Wallet'}</p>
          </div>
          <div className="flex items-center justify-between gap-2 px-2">
            <span className="num truncate text-sm">{shortAddress(address)}</span>
            <CopyButton text={address} label="Copy address" />
          </div>
          {viaSmartAccount && owner && (
            <p className="px-2 pb-2 text-xs text-muted">
              Signing with <span className="num">{shortAddress(owner)}</span>
            </p>
          )}
          <button
            type="button"
            role="menuitem"
            className="btn-ghost w-full justify-start"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

export function Nav({ variant, onLaunch }: { variant: 'landing' | 'app'; onLaunch: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <a href="#/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink" aria-label="ApexPerp home">
          <Logo />
        </a>
        {variant === 'landing' ? (
          <>
            <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Sections">
              <a className="btn-ghost" href="#how">How it works</a>
              <a className="btn-ghost" href="#rules">The rules</a>
              <a className="btn-ghost" href="#proof">Proof</a>
            </nav>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button type="button" className="btn-primary" onClick={onLaunch}>
                Launch app
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <NetworkBadge />
            <ThemeToggle />
            <WalletButton />
          </div>
        )}
      </div>
    </header>
  );
}
