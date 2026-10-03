/*
 * The sidebar's extra slot.
 *
 * The calendar page carries a mini calendar and the service legend in the
 * sidebar (Main.dc.html). The sidebar belongs to the shell, the content to the
 * page, so the page reaches into the sidebar with a React portal:
 *
 *     const inSidebar = useHasSidebarSlot();
 *     ...
 *     <SidebarPortal>
 *       <MiniCalendar />
 *       <ServiceLegend />
 *     </SidebarPortal>
 *     {!inSidebar && <MiniCalendar />}      // tablet / phone: the page shows it itself
 *
 * - `SidebarSlot` is drawn by the shell on the desktop sidebar, between the
 *   navigation and the account row. It is empty (and takes no space) until a
 *   page portals something into it.
 * - `SidebarPortal` renders its children into that slot on desktop and
 *   NOTHING on tablet and phone, and nothing on a settings route (where the
 *   sidebar is the settings one). A page that wants its content on every
 *   device draws it itself where `useHasSidebarSlot()` is false.
 * - The portal's children keep their React context (query client, router,
 *   theme), they only live elsewhere in the DOM. Give them their own spacing;
 *   the slot adds none.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Box } from '@mui/material';

interface SlotContextValue {
  /** Is the desktop sidebar's slot being drawn at all right now? */
  available: boolean;
  el: HTMLElement | null;
  setEl: (el: HTMLElement | null) => void;
}

const SlotContext = createContext<SlotContextValue | null>(null);

/** The shell mounts this once around the sidebar and the page; `available` = desktop and not in settings. */
export function SidebarSlotProvider({ available, children }: { available: boolean; children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ available, el, setEl }), [available, el]);
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>;
}

/** Where the desktop sidebar shows what a page put there. */
export function SidebarSlot() {
  const ctx = useContext(SlotContext);
  return <Box ref={ctx?.setEl} data-sidebar-slot="" sx={{ '&:empty': { display: 'none' } }} />;
}

/**
 * True when `SidebarPortal` will draw into the sidebar (desktop, main
 * navigation). Where it is false the page must show that content itself.
 */
export function useHasSidebarSlot(): boolean {
  return useContext(SlotContext)?.available ?? false;
}

/** Render children into the desktop sidebar's slot; nothing anywhere else. */
export function SidebarPortal({ children }: { children: ReactNode }) {
  const ctx = useContext(SlotContext);
  if (!ctx || !ctx.available || ctx.el === null) return null;
  return createPortal(children, ctx.el);
}
