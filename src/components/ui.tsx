import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Check, Copy, ExternalLink, X, Loader2 } from 'lucide-react';
import { LETTER_ADVANCE, MARK_FLOOR, MARK_LINE, MARK_STROKE, WORD_GLYPHS } from './brandPaths';

/** The ApexPerp mark: a falling price line that stops above the floor. */
export function Mark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" className={className} aria-hidden="true">
      <rect width="14" height="14" fill="rgb(var(--accent))" />
      <path d={MARK_LINE} fill="none" stroke="rgb(var(--accent-fg))" strokeWidth={MARK_STROKE} strokeLinecap="butt" strokeLinejoin="miter" />
      <path d={MARK_FLOOR} fill="rgb(var(--accent-fg))" />
    </svg>
  );
}

/** Mark plus the block-letter wordmark, drawn from the same shapes as public/brand. */
export function Logo({ className = '' }: { className?: string }) {
  const width = WORD_GLYPHS.length * LETTER_ADVANCE - 2;
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark />
      <svg viewBox={`0 0 ${width} 14`} className="h-4 w-auto fill-fg" role="img" aria-label="ApexPerp">
        {WORD_GLYPHS.map((d, i) => (
          <path key={i} d={d} transform={`translate(${i * LETTER_ADVANCE} 0)`} fillRule="evenodd" />
        ))}
      </svg>
    </span>
  );
}

export function LiveDot({ tone = 'safe' }: { tone?: 'safe' | 'warn' | 'danger' }) {
  const color = { safe: 'bg-safe', warn: 'bg-warn', danger: 'bg-danger' }[tone];
  return <span className={`live-dot inline-block h-2 w-2 rounded-full ${color}`} aria-hidden="true" />;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`block animate-pulse bg-surface-2 ${className}`} aria-hidden="true" />;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-danger bg-danger/10 px-4 py-3 text-sm">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn-secondary min-h-9 px-3 text-xs" onClick={onRetry}>
          Try again
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
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-muted hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check className="h-4 w-4 text-safe" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}

export function ExternalA({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 underline decoration-1 underline-offset-4 hover:text-accent-ink ${className}`}>
      {children}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

/** Panel header bar: stencilled label on the left, optional slot on the right. */
export function PanelHead({ id, label, children }: { id?: string; label: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border px-4 sm:px-5">
      <h2 id={id} className="label">
        {label}
      </h2>
      {children}
    </div>
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

  const edge = { pending: 'border-l-accent', success: 'border-l-safe', error: 'border-l-danger' };
  return (
    <ToastContext.Provider value={{ push, update }}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 border border-border border-l-4 bg-surface-2 p-3 ${edge[t.tone]}`}>
            {t.tone === 'pending' && <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-accent-ink" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.detail && <p className="num mt-0.5 break-all text-xs text-muted">{t.detail}</p>}
            </div>
            {t.copy && <CopyButton text={t.copy} label="Copy transaction hash" />}
            <button type="button" aria-label="Dismiss" className="flex h-10 w-10 shrink-0 items-center justify-center text-muted hover:text-fg" onClick={() => dismiss(t.id)}>
              <X className="h-4 w-4" aria-hidden="true" />
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
