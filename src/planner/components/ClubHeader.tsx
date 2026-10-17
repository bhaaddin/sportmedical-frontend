/*
 * ClubHeader - `<header id="club-unified-header">` (prototype lines 2943-2976).
 *
 * Owns: the top user bar (bell, profile chip), the club identity block (logo
 * slot `#club-logo-slot`, name `#club-identity-name`, "Upravit údaje"
 * `#club-edit-link`) and the strip `#club-details-strip` with the three
 * sections IDENTIFIKAČNÍ ÚDAJE / VEDENÍ KLUBU / KONTAKTNÍ OSOBA
 * (`#hdr-ico … #hdr-contact-phone`).
 *
 * Prototype functions: `updateOrderCommand` (header part), `initClubLogoSlot`,
 * `profile`, `notifications`, `editClubDetails` (opening only).
 * Data: `usePlannerProfile()`; writes: `usePlannerCommands().saveLogo`.
 * Dialogs are opened through the store (`openDialog`), rendered by DialogLayer.
 */
import type { ChangeEvent, ReactNode } from 'react';
import { usePlannerCommands } from '../data/usePlannerCommands';
import { clubDisplayName, headerValues, type ClubProfileField } from '../model';
import { usePlannerActions } from '../state/PlannerStoreProvider';
import { Icon } from './Icons';
import { usePlannerProfile } from './context';

export interface ClubHeaderProps {
  /** The signed-in person shown in the profile chip; falls back to a neutral label. */
  user?: { displayName: string } | null;
}

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

const LINE_ICONS: Record<'card' | 'doc' | 'pin' | 'user' | 'mail' | 'phone', ReactNode> = {
  card: (<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M5 16a4 4 0 0 1 8 0M15 9h4m-4 4h4" /></>),
  doc: <path d="M5 2h10l4 4v16H5zM15 2v5h5M9 13h6m-6 4h6" />,
  pin: (<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.4" /></>),
  user: (<><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>),
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  phone: <path d="M8 3 5 4a3 3 0 0 0-2 3c0 8 6 14 14 14a3 3 0 0 0 3-2l1-3-5-3-3 3a13 13 0 0 1-5-5l3-3z" />,
};

const SECTION_ICONS = {
  building: <path d="M4 21V4h12v17M9 8h2m-2 4h2m-2 4h2M16 11h4v10M2 21h20" />,
  team: (<><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 6a3 3 0 0 1 1 5m0 4a5 5 0 0 1 3 5" /></>),
  person: LINE_ICONS.user,
};

const DOM_IDS: Record<ClubProfileField, string> = {
  clubName: 'club-identity-name',
  ico: 'hdr-ico',
  dic: 'hdr-dic',
  address: 'hdr-address',
  leaderName: 'hdr-leader',
  leaderEmail: 'hdr-leader-email',
  leaderPhone: 'hdr-leader-phone',
  contactName: 'hdr-contact',
  contactEmail: 'hdr-contact-email',
  contactPhone: 'hdr-contact-phone',
};

export function ClubHeader({ user = null }: ClubHeaderProps) {
  const profile = usePlannerProfile();
  const act = usePlannerActions();
  const commands = usePlannerCommands();
  const values = Object.fromEntries(headerValues(profile).map((v) => [v.field, v])) as Record<
    Exclude<ClubProfileField, 'clubName'>,
    ReturnType<typeof headerValues>[number]
  >;
  const name = clubDisplayName(profile);
  const displayName = user?.displayName?.trim() || 'Uživatel';

  const line = (label: string, field: Exclude<ClubProfileField, 'clubName'>, icon: keyof typeof LINE_ICONS) => (
    <div className="club-head-line" key={field}>
      <svg className="club-line-icon" viewBox="0 0 24 24" aria-hidden="true">{LINE_ICONS[icon]}</svg>
      <span>{label}</span>
      <strong id={DOM_IDS[field]} className={values[field].missing ? 'is-missing' : undefined} title={values[field].title}>
        {values[field].value}
      </strong>
    </div>
  );

  const section = (title: string, ariaLabel: string, icon: keyof typeof SECTION_ICONS, children: ReactNode) => (
    <section className="club-head-info" aria-label={ariaLabel}>
      <div className="club-head-title">
        <svg className="club-info-icon" viewBox="0 0 24 24" aria-hidden="true">{SECTION_ICONS[icon]}</svg> {title}
      </div>
      {children}
    </section>
  );

  const onLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      act.toast('Zvolte prosím obrázek ve formátu PNG, JPG nebo WebP.');
      return;
    }
    try {
      await commands.saveLogo(file);
    } catch (error) {
      act.toast(error instanceof Error ? error.message : 'Nepodařilo se načíst logo.');
    } finally {
      input.value = '';
    }
  };

  return (
    <header id="club-unified-header" className="club-unified-header" aria-label="Hlavička klubu a kontaktní údaje" data-testid="club-header">
      <nav className="club-top-userbar" aria-label="Uživatelské nástroje">
        <div className="club-user-actions">
          <button type="button" className="club-user-bell" data-command="notification" aria-label="Oznámení" title="Oznámení" onClick={() => act.openDialog({ kind: 'notifications' })}>
            <Icon name="bell" />
          </button>
          <button type="button" className="club-user-chip" data-command="profile" aria-label={`Profil uživatele ${displayName}`} title="Profil uživatele" onClick={() => act.openDialog({ kind: 'profile' })}>
            <span className="club-user-avatar">{initialsOf(displayName)}</span>
            <span className="club-user-name">{displayName}</span>
            <span className="club-user-chevron"><Icon name="chevron-down" /></span>
          </button>
        </div>
      </nav>
      <section className="club-identity-v45" aria-label="Název klubu, logo a úpravy">
        <div className={`club-logo-slot${profile.logoUrl ? ' has-logo' : ''}`} id="club-logo-slot" data-testid="club-logo-slot">
          <input type="file" id="club-logo-input" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" aria-label="Nastavit logo klubu" onChange={onLogo} />
          {profile.logoUrl ? <img id="club-logo-preview" alt="Logo klubu" src={profile.logoUrl} /> : <img id="club-logo-preview" alt="Logo klubu" />}
          <label htmlFor="club-logo-input" className="club-logo-label">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10" r="1.4" />
              <path d="m21 16-4.4-4.4a1.5 1.5 0 0 0-2.1 0L9 17" />
            </svg>
            <b>Změnit logo</b>
            <small>Kliknutím vybrat obrázek</small>
          </label>
        </div>
        <div className="club-identity-content">
          <div className="club-identity-meta"><span className="club-identity-tag">KLUB</span></div>
          <strong id="club-identity-name" className="club-identity-name" title={name}>{name}</strong>
          <button type="button" id="club-edit-link" aria-label="Upravit údaje klubu" title="Upravit údaje klubu" onClick={() => act.openDialog({ kind: 'clubEdit' })}>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z" />
            </svg>
            <span id="club-edit-label">Upravit údaje</span>
          </button>
        </div>
      </section>
      <div id="club-details-strip" aria-label="Identifikační a kontaktní údaje klubu">
        {section('IDENTIFIKAČNÍ ÚDAJE', 'Identifikační údaje klubu', 'building', (
          <>
            {line('IČO', 'ico', 'card')}
            {line('DIČ', 'dic', 'doc')}
            {line('Adresa', 'address', 'pin')}
          </>
        ))}
        {section('VEDENÍ KLUBU', 'Vedení klubu', 'team', (
          <>
            {line('Jméno', 'leaderName', 'user')}
            {line('E-mail', 'leaderEmail', 'mail')}
            {line('Telefon', 'leaderPhone', 'phone')}
          </>
        ))}
        {section('KONTAKTNÍ OSOBA', 'Kontaktní osoba', 'person', (
          <>
            {line('Jméno', 'contactName', 'user')}
            {line('E-mail', 'contactEmail', 'mail')}
            {line('Telefon', 'contactPhone', 'phone')}
          </>
        ))}
      </div>
    </header>
  );
}
