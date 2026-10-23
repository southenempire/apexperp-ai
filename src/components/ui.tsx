import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, Copy, ExternalLink, XCircle, Loader2 } from 'lucide-react';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-accent" />
        <path d="M16 6l8 3v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V9z" fill="white" />
        <path d="M12.5 15.5l2.5 2.5 4.5-5" stroke="rgb(var(--accent))" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      ApexPerp
    </span>
  );
}

export function LiveDot({ tone = 'safe' }: { tone?: 'safe' | 'warn' | 'danger' }) {
  const color = { safe: 'bg-safe', warn: 'bg-warn', danger: 'bg-danger' }[tone];
  return <span className={`live-dot inline-block h-2 w-2 rounded-full ${color}`} aria-hidden="true" />;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`block animate-pulse rounded-md bg-surface-2 ${className}`} aria-hidden="true" />;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn-secondary min-h-9 px-3 text-xs" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <CheckCircle2 className="h-4 w-4 text-safe" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}

export function ExternalA({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 underline-offset-4 hover:underline ${className}`}>
      {children}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

/* ---------- Toasts ---------- */

type ToastTone = 'pending' | 'success' | 'error';
interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
  copy?: string;
}

const ToastContext = createContext<{ push: (t: Omit<Toast, 'id'>) => number; update: (id: number, t: Omit<Toast, 'id'>) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const schedule = useCallback((t: Toast) => {
    if (t.tone !== 'pending') setTimeout(() => dismiss(t.id), 8000);
  }, [dismiss]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const toast = { ...t, id: Date.now() + Math.random() };
    setToasts((all) => [...all, toast]);
    schedule(toast);
    return toast.id;
  }, [schedule]);
  const update = useCallback((id: number, t: Omit<Toast, 'id'>) => {
    setToasts((all) => all.map((x) => (x.id === id ? { ...t, id } : x)));
    schedule({ ...t, id });
  }, [schedule]);

  return (
    <ToastContext.Provider value={{ push, update }}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-surface-2 p-3 shadow-2xl shadow-black/40">
            {t.tone === 'pending' && <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-accent" aria-hidden="true" />}
            {t.tone === 'success' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-safe" aria-hidden="true" />}
            {t.tone === 'error' && <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.detail && <p className="mt-0.5 break-all text-xs text-muted">{t.detail}</p>}
            </div>
            {t.copy && <CopyButton text={t.copy} label="Copy transaction hash" />}
            <button type="button" aria-label="Dismiss" className="h-10 w-10 shrink-0 rounded-lg text-muted hover:bg-surface hover:text-fg" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
