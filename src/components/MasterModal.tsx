/* ══════════════════════════════════════════════════════════════
   MASTER MODAL — Responsive, accessible modal dialog
   Features: backdrop click close, Escape key, animation,
   title, subtitle, max-width control, portal rendering
   ══════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Close } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface MasterModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Default 560px */
  maxWidth?: number;
  /** Show close X button (default true) */
  showClose?: boolean;
  /** Footer actions (buttons) */
  footer?: ReactNode;
  /** Disable backdrop click close */
  disableBackdropClose?: boolean;
  /** Unique id for aria-labelledby */
  id?: string;
}

export default function MasterModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 560,
  showClose = true,
  footer,
  disableBackdropClose = false,
  id,
}: MasterModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  /* ── Escape key handler ── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, onClose]);

  /* ── Focus trap ── */
  useEffect(() => {
    if (!open) return;

    /* Save previously focused element */
    previousActiveElement.current = document.activeElement as HTMLElement;

    /* Focus the modal content */
    setTimeout(() => contentRef.current?.focus(), 50);

    /* On close, restore focus */
    return () => {
      previousActiveElement.current?.focus();
    };
  }, [open]);

  /* ── Prevent body scroll when open ── */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleBackdropClick = useCallback(() => {
    if (!disableBackdropClose) onClose();
  }, [disableBackdropClose, onClose]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const labelId = id || (title ? `modal-title-${title.replace(/\s/g, '-')}` : undefined);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop modal-backdrop--open"
          onClick={handleBackdropClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelId}
        >
          <motion.div
            ref={contentRef}
            className="modal-content"
            style={{ maxWidth }}
            onClick={handleContentClick}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            {(title || showClose) && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                padding: '20px 24px 0',
              }}>
                <div>
                  {title && (
                    <h2
                      id={labelId}
                      style={{
                        margin: 0, fontSize: 18, fontWeight: 700,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p style={{
                      margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)',
                    }}>
                      {subtitle}
                    </p>
                  )}
                </div>
                {showClose && (
                  <button
                    onClick={onClose}
                    className="btn btn--ghost"
                    style={{ minWidth: 32, minHeight: 32, padding: 4 }}
                    aria-label="Zavřít dialog"
                    data-tooltip="Zavřít"
                  >
                    <Close sx={{ fontSize: 20 }} />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div style={{ padding: '16px 24px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
                padding: '0 24px 20px',
              }}>
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
