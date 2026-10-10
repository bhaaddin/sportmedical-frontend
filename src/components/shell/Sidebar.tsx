/*
 * The full sidebar (desktop ≥1280, and the tablet's overlay when it is opened).
 *
 * Taken from the board's artboards (Main.dc.html, P-Pacient.dc.html): 258px,
 * white, a hairline on its right, padding 22/20; the brand as text, a 44px
 * button "Nová objednávka", the six entries as 44px rows (the open one on the
 * soft accent with accent text at 600), and what hangs under the OPEN entry
 * indented beneath it - nothing is shown for the others. Between the
 * navigation and the account row sits the slot a page can portal into (the
 * calendar's mini calendar and service legend, see SidebarSlot.tsx).
 *
 * On a settings route the whole content is replaced - never two sidebars:
 * "← Zpět do aplikace", the brand, the settings search and its groups.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Box, Button, ButtonBase, IconButton } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowBack, Search } from '@mui/icons-material';
import NotificationCenter from '../NotificationCenter';
import { openUniversalSearch } from '../UniversalSearch';
import { SettingsNav } from '../../pages/settings/SettingsFrame';
import { NewOrderChooser } from '../booking/NewOrderChooser';
import { SidebarSlot } from './SidebarSlot';
import { STAFF_HOME_PATH } from '../../web/sitePaths';
import { childIsActive, entryState, mainEntries, sectionGroups, sectionOf } from './shellModel';
import { SIDEBAR_WIDTH, activeBg, focusRing } from './shellStyles';
import type { MenuEntry, ShellNav } from './shellTypes';

/** The row every entry shares: 44px, 14px, the open one soft with accent text. */
const rowSx = (active: boolean, inSection = false, child = false) => ({
  display: 'flex',
  alignItems: 'center',
  minHeight: child ? 40 : 44,
  px: '13px',
  py: child ? '8px' : '11px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: 14,
  lineHeight: 1.3,
  fontWeight: active || inSection ? 600 : 400,
  color: active || inSection ? 'primary.main' : 'text.secondary',
  bgcolor: active ? activeBg : 'transparent',
  '&:hover': {
    bgcolor: active ? activeBg : 'action.hover',
    color: active || inSection ? 'primary.main' : 'text.primary',
  },
  ...focusRing,
});

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Box
      component={Link}
      to={STAFF_HOME_PATH}
      onClick={onNavigate}
      aria-label="SportMedical — přehled"
      sx={{
        alignSelf: 'flex-start',
        color: 'text.primary',
        textDecoration: 'none',
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: '24px',
        ...focusRing,
      }}
    >
      SportMedical
    </Box>
  );
}

/** "Nová objednávka": opens the chooser (the shell variant owns its state). */
export function NewAppointmentButton({ onNewOrder, onNavigate }: { onNewOrder: () => void; onNavigate?: () => void }) {
  return (
    <Button
      variant="contained"
      fullWidth
      onClick={() => { onNavigate?.(); onNewOrder(); }}
      sx={{ height: 44, minHeight: 44, flexShrink: 0, fontSize: 14 }}
    >
      Nová objednávka
    </Button>
  );
}

/** The six entries, and under the open one what belongs to it. */
export function MainNav({ nav, onNavigate }: { nav: ShellNav; onNavigate?: () => void }) {
  return (
    <Box component="nav" aria-label="Hlavní navigace" sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {mainEntries(nav.menu).map((entry) => {
        const state = entryState(nav, entry);
        return (
          <Box key={entry.path}>
            <Box
              component={Link}
              to={entry.path}
              onClick={onNavigate}
              aria-current={state.self ? 'page' : undefined}
              sx={rowSx(state.self, state.childActive)}
            >
              {entry.text}
            </Box>
            {state.inSection && state.items.length > 0 && (
              <Box
                sx={{
                  ml: '20px',
                  pl: '6px',
                  mt: '2px',
                  mb: '6px',
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1px',
                }}
              >
                {state.items.map((child: MenuEntry) => {
                  const active = childIsActive(nav, child, state.items, state.exact);
                  return (
                    <Box
                      key={child.path}
                      component={Link}
                      to={child.path}
                      state={child.state}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      sx={rowSx(active, false, true)}
                    >
                      {child.text}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/** "← Všechny sekce": the way from a section back to the home menu. */
export function AllSectionsLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ButtonBase
      component={Link}
      to={STAFF_HOME_PATH}
      onClick={onNavigate}
      sx={{
        alignSelf: 'stretch',
        justifyContent: 'flex-start',
        gap: 1,
        minHeight: 44,
        px: '13px',
        borderRadius: '8px',
        color: 'text.secondary',
        fontSize: 14,
        fontWeight: 600,
        '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
        ...focusRing,
      }}
    >
      <ArrowBack sx={{ fontSize: 20 }} />
      Všechny sekce
    </ButtonBase>
  );
}

/**
 * One section's own sidebar: its title and ONLY its items - the other
 * sections are not drawn at all (Matko, 4. 10. 2026: "everything in the
 * sidebar changes to only calendar").
 */
export function SectionNav({ nav, entry, onNavigate }: { nav: ShellNav; entry: MenuEntry; onNavigate?: () => void }) {
  return (
    <Box component="nav" aria-label={`Sekce ${entry.text}`} sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {sectionGroups(nav, entry).map((group, gi) => (
        <Box key={gi} sx={{ display: 'flex', flexDirection: 'column', gap: '2px', mt: gi > 0 ? 1.5 : 0 }}>
          {group.heading && (
            <Box component="h3" sx={{ m: 0, px: '13px', pb: '4px', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.secondary' }}>
              {group.heading}
            </Box>
          )}
          {group.items.map((child: MenuEntry) => {
            const active = childIsActive(nav, child, group.items, group.exact);
            return (
              <Box
                key={child.path + child.text}
                component={Link}
                to={child.path}
                state={child.state}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                sx={rowSx(active)}
              >
                {child.text}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

/**
 * The sidebar's middle: the navigation and the page's slot, scrolling on its
 * own between the fixed top (brand, button) and the account row below it.
 *
 * The account row is a flex footer AFTER this box, never over it - but with a
 * tall slot (the calendar's mini calendar plus the service legend) the last
 * rows are clipped exactly at the footer's top border, with no scrollbar to
 * speak of, so they read as "covered by the account widget" (Etapa 12 bug).
 * Hence: bottom padding so the last row never sits flush under the divider,
 * and a fade over the bottom edge for as long as something is hidden below,
 * which goes away once the list is scrolled to its end.
 */
export function SidebarScrollArea({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const check = () => setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
    check();
    el.addEventListener('scroll', check, { passive: true });
    /* The slot fills after mount (a portal) and the legend grows with the services: watch the content, not only the box. */
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    sizes?.observe(el);
    for (const child of Array.from(el.children)) sizes?.observe(child);
    const tree = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => {
      check();
      for (const child of Array.from(el.children)) sizes?.observe(child);
    });
    tree?.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener('scroll', check);
      sizes?.disconnect();
      tree?.disconnect();
    };
  }, []);

  return (
    <Box sx={{ position: 'relative', flex: '1 1 0%', minHeight: 0, display: 'flex', flexDirection: 'column', mt: 2.5 }}>
      <Box
        ref={ref}
        data-shell-scroll=""
        data-more-below={moreBelow ? '' : undefined}
        sx={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', mx: '-6px', px: '6px', pb: 1.5 }}
      >
        {children}
      </Box>
      <Box
        aria-hidden
        data-shell-scroll-hint=""
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 36,
          pointerEvents: 'none',
          opacity: moreBelow ? 1 : 0,
          transition: 'opacity 120ms',
          background: (t) => `linear-gradient(to bottom, ${alpha(t.palette.background.paper, 0)}, ${t.palette.background.paper})`,
        }}
      />
    </Box>
  );
}

/** The signed-in person, search and the bell: reachable on every width. */
export function AccountRow({ nav }: { nav: ShellNav }) {
  const name = [nav.user.firstName, nav.user.lastName].filter(Boolean).join(' ') || 'Účet';
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        pt: 1.5,
        borderTop: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      <ButtonBase
        onClick={(e) => nav.onOpenAccountMenu(e.currentTarget)}
        aria-label="Účet a vzhled"
        aria-haspopup="menu"
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 1.25,
          borderRadius: '8px',
          textAlign: 'left',
          '&:hover': { bgcolor: 'action.hover' },
          ...focusRing,
        }}
      >
        <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: '#FFF', fontSize: 13, fontWeight: 600 }}>
          {nav.user.firstName?.[0]}{nav.user.lastName?.[0]}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </Box>
          <Box sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nav.user.role || ''}
          </Box>
        </Box>
      </ButtonBase>
      <IconButton title="Hledat (Ctrl+K)" aria-label="Hledat" onClick={openUniversalSearch} sx={{ width: 40, height: 40 }}>
        <Search fontSize="small" />
      </IconButton>
      <NotificationCenter placement="side" buttonSx={{ width: 40, height: 40 }} />
    </Box>
  );
}

/**
 * The sidebar's content for one width. `onNavigate` runs on every link, so an
 * overlay can close itself even when the click does not change the address.
 */
export function SidebarBody({
  nav,
  onNavigate,
  onNewOrder,
  withSlot,
}: {
  nav: ShellNav;
  onNavigate?: () => void;
  /** Opens the "Nová objednávka" chooser. */
  onNewOrder: () => void;
  /** Draw the page's slot (desktop only; tablet and phone pages show that content themselves). */
  withSlot: boolean;
}) {
  if (nav.settingsMode) {
    return (
      <>
        <ButtonBase
          component={Link}
          to={nav.backToAppPath}
          onClick={onNavigate}
          sx={{
            alignSelf: 'stretch',
            justifyContent: 'flex-start',
            gap: 1,
            minHeight: 44,
            px: '13px',
            mb: 2,
            borderRadius: '8px',
            color: 'text.secondary',
            fontSize: 14,
            fontWeight: 600,
            '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
            ...focusRing,
          }}
        >
          <ArrowBack sx={{ fontSize: 20 }} />
          Zpět do aplikace
        </ButtonBase>
        <Box component="h2" data-testid="section-title" sx={{ m: 0, px: '13px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: '28px' }}>
          Nastavení
        </Box>
        <SidebarScrollArea>
          <SettingsNav plain query={nav.settingsQuery} onQueryChange={nav.onSettingsQueryChange} />
        </SidebarScrollArea>
        <AccountRow nav={nav} />
      </>
    );
  }

  const section = sectionOf(nav);
  return (
    <>
      {section ? (
        <>
          <AllSectionsLink onNavigate={onNavigate} />
          <Box component="h2" data-testid="section-title" sx={{ m: 0, mt: 1.5, px: '13px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: '28px' }}>
            {section.text}
          </Box>
        </>
      ) : (
        <Brand onNavigate={onNavigate} />
      )}
      <Box sx={{ mt: '22px', flexShrink: 0 }}>
        <NewAppointmentButton onNewOrder={onNewOrder} onNavigate={onNavigate} />
      </Box>
      <SidebarScrollArea>
        {section ? <SectionNav nav={nav} entry={section} onNavigate={onNavigate} /> : <MainNav nav={nav} onNavigate={onNavigate} />}
        {withSlot && <SidebarSlot />}
      </SidebarScrollArea>
      <AccountRow nav={nav} />
    </>
  );
}

/** The desktop sidebar: fixed to the left edge, 258px, full height. */
export function DesktopSidebar({ nav }: { nav: ShellNav }) {
  const [chooser, setChooser] = useState(false);
  return (
    <>
    <Box
      component="aside"
      aria-label={nav.settingsMode ? 'Nastavení' : 'Postranní panel'}
      data-shell="sidebar"
      sx={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        width: SIDEBAR_WIDTH,
        boxSizing: 'border-box',
        bgcolor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        px: '20px',
        pt: '22px',
        pb: '14px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: (t) => t.zIndex.drawer,
      }}
    >
      <SidebarBody nav={nav} withSlot onNewOrder={() => setChooser(true)} />
    </Box>
    <NewOrderChooser open={chooser} onClose={() => setChooser(false)} />
    </>
  );
}
