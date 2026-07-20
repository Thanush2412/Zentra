"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

/* ─────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────── */
type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

/* ─────────────────────────────────────────────────────────
   CONTEXT
───────────────────────────────────────────────────────── */
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/* ─────────────────────────────────────────────────────────
   ICONS (inline SVG to avoid extra imports)
───────────────────────────────────────────────────────── */
const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="tt-icon">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="tt-icon">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="tt-icon">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="tt-icon">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
};

/* ─────────────────────────────────────────────────────────
   PROVIDER
───────────────────────────────────────────────────────── */
let _nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Confirm modal state
  const [confirmState, setConfirmState] = useState<ConfirmOptions & { visible: boolean }>({
    visible: false,
    message: "",
  });
  const confirmResolve = useRef<((value: boolean) => void) | null>(null);

  /* -- toast API -- */
  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++_nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* -- confirm API -- */
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setConfirmState({ ...options, visible: true });
    return new Promise<boolean>((resolve) => {
      confirmResolve.current = resolve;
    });
  }, []);

  const handleConfirmChoice = (result: boolean) => {
    setConfirmState((s) => ({ ...s, visible: false }));
    if (confirmResolve.current) {
      confirmResolve.current(result);
      confirmResolve.current = null;
    }
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* ── Toast Stack ─────────────────────────── */}
      <div className="tt-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`tt-item tt-${t.type}`} role="alert">
            {ICONS[t.type]}
            <span className="tt-msg">{t.message}</span>
            <button
              className="tt-close"
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* ── Confirm Modal ───────────────────────── */}
      {confirmState.visible && (
        <div className="tt-backdrop" role="dialog" aria-modal="true">
          <div className="tt-modal">
            {confirmState.title && (
              <h3 className="tt-modal-title">{confirmState.title}</h3>
            )}
            <p className="tt-modal-msg">{confirmState.message}</p>
            <div className="tt-modal-actions">
              <button
                className="tt-btn tt-btn-cancel"
                onClick={() => handleConfirmChoice(false)}
              >
                {confirmState.cancelLabel ?? "Cancel"}
              </button>
              <button
                className={`tt-btn ${confirmState.danger ? "tt-btn-danger" : "tt-btn-confirm"}`}
                onClick={() => handleConfirmChoice(true)}
              >
                {confirmState.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Toast stack */
        .tt-stack {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: .625rem;
          max-width: 22rem;
          pointer-events: none;
        }

        /* Individual toast */
        .tt-item {
          display: flex;
          align-items: flex-start;
          gap: .625rem;
          padding: .75rem 1rem;
          border-radius: .75rem;
          font-size: .875rem;
          font-weight: 500;
          line-height: 1.4;
          box-shadow: 0 8px 30px rgba(0,0,0,.18);
          backdrop-filter: blur(12px);
          pointer-events: all;
          animation: tt-slide-in .38s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          border: 1px solid transparent;
        }
        @keyframes tt-slide-in {
          from { opacity: 0; transform: translateY(24px) scale(.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .tt-success { background: rgba(16,185,129,.15); border-color: rgba(16,185,129,.35); color: #10b981; }
        .tt-error   { background: rgba(239,68,68,.15);  border-color: rgba(239,68,68,.35);  color: #ef4444; }
        .tt-info    { background: rgba(99,102,241,.15); border-color: rgba(99,102,241,.35); color: #818cf8; }
        .tt-warning { background: rgba(245,158,11,.15); border-color: rgba(245,158,11,.35); color: #f59e0b; }

        /* Dark mode override — readable text */
        :root:not(.dark) .tt-success { color: #047857; }
        :root:not(.dark) .tt-error   { color: #b91c1c; }
        :root:not(.dark) .tt-info    { color: #4338ca; }
        :root:not(.dark) .tt-warning { color: #92400e; }

        .tt-icon { width: 1.125rem; height: 1.125rem; flex-shrink: 0; margin-top: .1rem; }
        .tt-msg  { flex: 1; }
        .tt-close {
          background: none; border: none; cursor: pointer;
          font-size: 1.1rem; line-height: 1;
          opacity: .6; padding: 0 .1rem;
          color: inherit;
        }
        .tt-close:hover { opacity: 1; }

        /* Confirm modal backdrop */
        .tt-backdrop {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(0,0,0,.55);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          animation: tt-fade-in .25s ease;
        }
        @keyframes tt-fade-in {
          from { opacity:0; } to { opacity:1; }
        }

        /* Modal card */
        .tt-modal {
          background: var(--modal-bg, #1e1e2e);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 1rem;
          padding: 1.75rem 2rem;
          max-width: 26rem;
          width: 90%;
          box-shadow: 0 24px 64px rgba(0,0,0,.4);
          animation: tt-pop-in .42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes tt-pop-in {
          from { opacity: 0; transform: scale(.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        :root:not(.dark) .tt-modal {
          background: #fff;
          border-color: rgba(0,0,0,.1);
          box-shadow: 0 16px 48px rgba(0,0,0,.15);
        }

        .tt-modal-title {
          font-size: 1.05rem; font-weight: 700;
          margin: 0 0 .5rem; color: inherit;
        }
        .tt-modal-msg {
          font-size: .9rem; line-height: 1.55;
          color: rgba(255,255,255,.7);
          margin: 0 0 1.5rem;
        }
        :root:not(.dark) .tt-modal-msg { color: #374151; }

        .tt-modal-actions {
          display: flex; justify-content: flex-end; gap: .625rem;
        }
        .tt-btn {
          padding: .5rem 1.1rem; border-radius: .5rem;
          font-size: .875rem; font-weight: 600;
          cursor: pointer; border: none; transition: opacity .15s;
        }
        .tt-btn:hover { opacity: .85; }
        .tt-btn-cancel  { background: rgba(255,255,255,.1); color: inherit; }
        :root:not(.dark) .tt-btn-cancel { background: #e5e7eb; color: #374151; }
        .tt-btn-confirm { background: #6366f1; color: #fff; }
        .tt-btn-danger  { background: #ef4444; color: #fff; }
      `}</style>
    </ToastContext.Provider>
  );
}
