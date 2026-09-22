/*
 * Nastavení: six headings, nothing open until asked.
 *
 * The complaint was twenty sidebar entries, and the obvious way to answer it
 * badly is a single screen a kilometre long. So the thing worth testing is not
 * that the rows exist - it is that they are *not shown* until somebody asks,
 * and that opening one does not open the rest.
 *
 * Also covered: the fake settings that used to sit on this screen. A default
 * appointment length, a buffer and working hours, all hardcoded, saving
 * nowhere, contradicting the real working-hours screen. If any of them come
 * back, these fail.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Settings from './Settings';

/*
 * ── Signed in AS somebody, not IN A ROLE ──
 *
 * This screen decided what to draw from `user.role` until 22. 9. 2026. The
 * owner sets permissions per employee, in three states, so the role could
 * not answer the question: an administrator whose `settings.clinic.manage`
 * was revoked still saw every screen. It reads the effective list the server
 * sends at sign-in, and so do these.
 */
const EVERYTHING = [
  'patients.view',
  'patients.register',
  'patients.edit',
  'patients.sensitive_identity.view',
  'reports.view',
  'settings.appearance.manage',
  'settings.clinic.manage',
  'users.manage',
  'roles.manage',
  'bookings.create',
  'bookings.edit',
  'bookings.cancel',
  'questionnaires.manage',
];

/** The server's own defaults for the Staff role. */
const RECEPTIONIST = [
  'patients.view',
  'patients.register',
  'patients.edit',
  'reports.view',
  'bookings.create',
  'bookings.edit',
  'bookings.cancel',
];

const holding = (permissions: readonly string[]) => {
  localStorage.setItem(
    'user',
    JSON.stringify({ firstName: 'Jana', lastName: 'Nová', email: 'j@n.cz', role: 'Owner' }),
  );
  localStorage.setItem('permissions', JSON.stringify(permissions));
};

beforeEach(() => {
  localStorage.clear();
  holding(EVERYTHING);
});

const renderSettings = () =>
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );

describe('the settings screen', () => {
  it('shows the headings and nothing else', async () => {
    renderSettings();

    expect(await screen.findByText('Kalendáře a provoz')).toBeInTheDocument();
    expect(screen.getByText('Lidé a přístupy')).toBeInTheDocument();
    expect(screen.getByText('Můj účet')).toBeInTheDocument();

    /* The rows inside are in the DOM but not shown - that is what collapsed
       means for an accordion, and what the eye sees is visibility. */
    expect(screen.getByText('Činnosti')).not.toBeVisible();
    expect(screen.getByText('Pracovní doba')).not.toBeVisible();
  });

  it('opens one heading when it is clicked', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(await screen.findByText('Kalendáře a provoz'));

    expect(await screen.findByText('Činnosti')).toBeVisible();
    expect(screen.getByText('Blokovaný čas')).toBeVisible();
  });

  /* One at a time. Opening everything is how the kilometre comes back. */
  it('closes the previous one when another is opened', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(await screen.findByText('Kalendáře a provoz'));
    expect(await screen.findByText('Činnosti')).toBeVisible();

    await user.click(screen.getByText('Lidé a přístupy'));

    /* By role, not by text: "Tým a účty" also appears in the sentence telling
       people where their name is changed, and a plain text query catches both. */
    expect(await screen.findByRole('link', { name: /Tým a účty/ })).toBeVisible();
    expect(screen.getByText('Činnosti')).not.toBeVisible();
  });

  it('closes a heading when it is clicked again', async () => {
    const user = userEvent.setup();
    renderSettings();

    const heading = await screen.findByText('Kalendáře a provoz');
    await user.click(heading);
    expect(await screen.findByText('Činnosti')).toBeVisible();

    await user.click(heading);
    expect(screen.getByText('Činnosti')).not.toBeVisible();
  });
});

describe('what a receptionist sees', () => {
  beforeEach(() => holding(RECEPTIONIST));

  it('is not offered the administrator rows', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(await screen.findByText('Kalendáře a provoz'));

    expect(screen.getByText('Blokovaný čas')).toBeVisible();
    expect(screen.queryByText('Činnosti')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Tým a účty/ })).not.toBeInTheDocument();
  });

  it('still has her own settings', async () => {
    renderSettings();
    expect(await screen.findByText('Můj účet')).toBeInTheDocument();
  });

  it('is not shown a whole section that holds nothing of hers', async () => {
    renderSettings();
    await screen.findByText('Můj účet');
    expect(screen.queryByText('Systém')).not.toBeInTheDocument();
  });
});

describe('the settings that used to lie here', () => {
  it('no longer offers a working day this screen cannot save', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(await screen.findByText('Můj účet'));

    expect(screen.queryByText(/Začátek pracovní doby/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Konec pracovní doby/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Buffer mezi termíny/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Výchozí délka termínu/)).not.toBeInTheDocument();
  });

  /*
   * The profile is read-only, and that is honest: `/api/account` does not
   * exist, so the editable fields that were here wrote the name into this
   * browser and nowhere else. It looked like it worked until you logged in
   * somewhere else.
   */
  it('shows who you are without pretending the name can be changed here', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(await screen.findByText('Můj účet'));

    expect(await screen.findByText('Jana Nová')).toBeVisible();
    expect(screen.getByText(/mění správce v sekci/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Uložit změny/ })).not.toBeInTheDocument();
  });
});

describe('a screen that cannot work yet', () => {
  it('is named with the reason rather than quietly offered', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(await screen.findByText('Dokumenty a souhlasy'));

    expect(await screen.findByText('E-mailové šablony')).toBeVisible();
    expect(screen.getByText(/Chystá se ve fázi 2/)).toBeVisible();
  });
});

describe('a sign-in from before permissions were sent', () => {
  /*
   * The transition hazard, and why it is worth a test.
   *
   * A browser holding a session created before the server started sending the
   * permission list has no list at all. Every guarded row is hidden, and on
   * this screen that reads as the settings having disappeared — the owner
   * would report features missing rather than sign in again.
   */
  it('says the sign-in is stale instead of drawing a gutted menu', () => {
    localStorage.clear();
    localStorage.setItem(
      'user',
      JSON.stringify({ firstName: 'Jana', lastName: 'Nová', email: 'j@n.cz', role: 'Owner' }),
    );

    renderSettings();

    expect(screen.getByText(/Odhlaste se a přihlaste znovu/)).toBeInTheDocument();
  });

  it('says nothing when the server really did send an empty list', () => {
    holding([]);

    renderSettings();

    // Empty is a real answer — somebody with no permissions — and telling
    // them to sign in again would send them round in a circle.
    expect(screen.queryByText(/Odhlaste se a přihlaste znovu/)).not.toBeInTheDocument();
  });

  it('says nothing to somebody signed in normally', () => {
    renderSettings();

    expect(screen.queryByText(/Odhlaste se a přihlaste znovu/)).not.toBeInTheDocument();
  });
});
