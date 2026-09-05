/* ══════════════════════════════════════════════════════════════
   DROPDOWN MENU — Customizable dropdown with sub-menus & disabled items
   Features: keyboard navigation, sub-menu support, disabled items,
   separator, icon support, accessible, click-outside close
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { KeyboardArrowRight } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Menu item type ── */
export interface DropdownItem {
  /** Unique key */
  key: string;
  /** Display label */
  label: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Disabled state */
  disabled?: boolean;
  /** Danger / destructive style */
  danger?: boolean;
  /** Separator before this item */
  separator?: boolean;
  /** Sub-menu items */
  children?: DropdownItem[];
  /** Custom render */
  render?: (item: DropdownItem) => ReactNode;
}

interface DropdownMenuProps {
  /** Array of menu items */
  items: DropdownItem[];
  /** Called when an item is clicked */
  onSelect: (key: string) => void;
  /** Trigger element (button, icon, etc.) */
  trigger: ReactNode;
  /** Position relative to trigger (default: bottom-right) */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Menu width */
  minWidth?: number;
  /** Controlled open state */
  open?: boolean;
  /** Called when open state changes */
  onOpenChange?: (open: boolean) => void;
}

function MenuItem({
  item,
  onSelect,
  onSubmenuOpen,
}: {
  item: DropdownItem;
  onSelect: (key: string) => void;
  onSubmenuOpen?: (key: string | null) => void;
}) {
  const hasChildren = item.children && item.children.length > 0;

  const handleClick = () => {
    if (item.disabled) return;
    if (hasChildren) {
      onSubmenuOpen?.(item.key);
    } else {
      onSelect(item.key);
    }
  };

  const handleMouseEnter = () => {
    if (hasChildren && !item.disabled) {
      onSubmenuOpen?.(item.key);
    }
  };

  if (item.render) {
    return <>{item.render(item)}</>;
  }

  return (
    <>
      {item.separator && <div className="dropdown__separator" />}
      <button
        className={`dropdown__item ${item.disabled ? 'dropdown__item--disabled' : ''}`}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        disabled={item.disabled}
        style={item.danger ? { color: 'var(--color-critical)' } : undefined}
        role="menuitem"
        aria-disabled={item.disabled}
        aria-haspopup={hasChildren ? 'true' : undefined}
      >
        {item.icon && (
          <span style={{ display: 'flex', fontSize: 18, flexShrink: 0 }} aria-hidden="true">
            {item.icon}
          </span>
        )}
        <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
        {hasChildren && (
          <KeyboardArrowRight sx={{ fontSize: 16, ml: 1, opacity: 0.5 }} aria-hidden="true" />
        )}
      </button>
    </>
  );
}

export default function DropdownMenu({
  items,
  onSelect,
  trigger,
  position = 'bottom-right',
  minWidth = 180,
  open: controlledOpen,
  onOpenChange,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(v);
      onOpenChange?.(v);
      if (!v) setActiveSubmenu(null);
    },
    [controlledOpen, onOpenChange],
  );

  /* ── Click outside to close ── */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, setOpen]);

  /* ── Escape to close ── */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, setOpen]);

  /* ── Keyboard navigation ── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;
      const flatItems = items.filter((i) => !i.disabled && !i.separator);
      const currentIndex = flatItems.findIndex((i) => i.key === activeSubmenu);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveSubmenu(flatItems[Math.min(currentIndex + 1, flatItems.length - 1)]?.key ?? null);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveSubmenu(flatItems[Math.max(currentIndex - 1, 0)]?.key ?? null);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (activeSubmenu) onSelect(activeSubmenu);
          setOpen(false);
          break;
        case 'Escape':
          setOpen(false);
          break;
      }
    },
    [isOpen, items, activeSubmenu, onSelect, setOpen],
  );

  const positionStyles: Record<string, React.CSSProperties> = {
    'bottom-right': { top: '100%', right: 0, marginTop: 4 },
    'bottom-left': { top: '100%', left: 0, marginTop: 4 },
    'top-right': { bottom: '100%', right: 0, marginBottom: 4 },
    'top-left': { bottom: '100%', left: 0, marginBottom: 4 },
  };

  const selectedItem = items.find((i) => i.key === activeSubmenu);
  const submenuItems = selectedItem?.children || [];

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }} ref={triggerRef}>
      {/* Trigger */}
      <div
        onClick={() => setOpen(!isOpen)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!isOpen); } }}
        role="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        tabIndex={0}
        style={{ cursor: 'pointer' }}
      >
        {trigger}
      </div>

      {/* Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            className="dropdown"
            style={{ ...positionStyles[position], minWidth }}
            role="menu"
            aria-label="Menu"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            onKeyDown={handleKeyDown}
          >
            {/* Main items */}
            <div style={{ position: 'relative' }}>
              {items.map((item) => (
                <MenuItem
                  key={item.key}
                  item={item}
                  onSelect={(key) => { onSelect(key); setOpen(false); }}
                  onSubmenuOpen={setActiveSubmenu}
                />
              ))}
            </div>

            {/* Sub-menu (renders adjacent if item has children) */}
            {submenuItems.length > 0 && activeSubmenu && (
              <div
                className="dropdown"
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: 0,
                  marginLeft: 2,
                  minWidth: 160,
                }}
                role="menu"
                aria-label={`Podmenu: ${selectedItem?.label}`}
              >
                {submenuItems.map((sub) => (
                  <MenuItem
                    key={sub.key}
                    item={sub}
                    onSelect={(key) => { onSelect(key); setOpen(false); }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
