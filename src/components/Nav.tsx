import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, LogOut, Wallet } from 'lucide-react';
import { useWallet } from '../lib/wallet';
import { useBlockNumber } from '../lib/hooks';
import { shortAddress } from '../lib/format';
import { CopyButton, LiveDot, Logo } from './ui';

export function NetworkBadge() {
  const { data: block, error } = useBlockNumber();
  return (
    <span className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted md:inline-flex">
      <LiveDot tone={error ? 'danger' : 'safe'} />
      Somnia Tokyo
      {block !== null && <span className="num text-fg">#{block.toLocaleString()}</span>}
    </span>
  );
}

export function WalletButton({ onConnected }: { onConnected?: () => void }) {
  const { address, connect, connecting, disconnect, onRightChain, switchChain, error } = useWallet();
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

  if (!address) {
    return (
      <div className="flex flex-col items-end">
        <button type="button" className="btn-primary" disabled={connecting} onClick={async () => (await connect()) && onConnected?.()}>
          <Wallet className="h-4 w-4" aria-hidden="true" />
          {connecting ? 'Check your wallet…' : 'Connect wallet'}
        </button>
        {error && <span className="sr-only" role="alert">{error}</span>}
      </div>
    );
  }

  if (!onRightChain) {
    return (
      <button type="button" className="btn border border-warn/40 bg-warn/10 text-warn hover:bg-warn/20" onClick={switchChain}>
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Switch to Somnia Tokyo
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
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-border bg-surface-2 p-2 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <span className="num truncate text-sm">{shortAddress(address)}</span>
            <CopyButton text={address} label="Copy address" />
          </div>
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
    <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="#/" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="ApexPerp home">
          <Logo className="text-lg" />
        </a>
        {variant === 'landing' ? (
          <>
            <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Sections">
              <a className="btn-ghost" href="#how">How it works</a>
              <a className="btn-ghost" href="#rules">Rules</a>
              <a className="btn-ghost" href="#proof">Proof</a>
            </nav>
            <button type="button" className="btn-primary" onClick={onLaunch}>
              Launch app
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <NetworkBadge />
            <WalletButton />
          </div>
        )}
      </div>
    </header>
  );
}
