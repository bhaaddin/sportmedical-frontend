/*
 * `profile` - the account (prototype `profile()`), with the items of the application's account
 * menu: Nastavení, the appearance controls (where the application provides them) and Odhlásit se.
 */
import { useContext } from 'react';
import { signOut } from '../../../../auth/signOut';
import { ThemePrefsContext } from '../../../../themePrefs';
import type { DialogRenderer } from '../../dialogRegistry';
import { initialsOf, roleLabel, useAppNavigate, usePlannerUser } from './account';
import { SETTINGS_PATH } from './headerData';

function ProfileBody({ close, clinicName }: { close: () => void; clinicName: string }) {
  const user = usePlannerUser();
  const navigate = useAppNavigate();
  const prefs = useContext(ThemePrefsContext);
  const name = user?.displayName ?? 'Uživatel';
  const role = roleLabel(user?.role);
  return (
    <>
      <div className="info-statline">
        <div className="event-big-icon generic-initials" aria-hidden="true">{initialsOf(name)}</div>
        <div>
          <strong style={{ fontSize: 21 }} data-testid="profile-name">{name}</strong>
          <div className="hint">{[role, clinicName].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <div className="settings-row">
        <div>
          <strong>Nastavení</strong>
          <small>Provoz kliniky, služby, uživatelé a vzhled aplikace</small>
        </div>
        <button
          type="button"
          className="app-button"
          onClick={() => {
            close();
            navigate(SETTINGS_PATH);
          }}
        >
          Otevřít nastavení
        </button>
      </div>
      {prefs ? (
        <div className="settings-row" data-testid="profile-appearance">
          <div>
            <strong>Vzhled aplikace</strong>
            <small>Plánovač je vždy tmavý; přepíná se vzhled ostatních obrazovek</small>
          </div>
          <button type="button" className="app-button" onClick={() => prefs.setMode(prefs.mode === 'light' ? 'dark' : 'light')}>
            {prefs.mode === 'light' ? 'Tmavý režim' : 'Světlý režim'}
          </button>
        </div>
      ) : null}
      <div className="settings-row">
        <div>
          <strong>Odhlášení</strong>
          <small>Ukončí vaše přihlášení na serveru i v tomto prohlížeči</small>
        </div>
        <button type="button" className="app-button danger" onClick={() => void signOut()}>Odhlásit se</button>
      </div>
    </>
  );
}

export const profileDialog: DialogRenderer<'profile'> = ({ close, model }) => ({
  body: <ProfileBody close={close} clinicName={model.catalogue?.clinicName ?? ''} />,
});
