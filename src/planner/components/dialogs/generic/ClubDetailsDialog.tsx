/*
 * `clubDetails` - "Údaje o klubu" overview (prototype `openClubDetails()`): the saved identity,
 * leadership and contact, read-only, with the way to the editor. Missing values show "—", never
 * an invented one.
 */
import type { ClubProfile } from '../../../model';
import { hasAnyClubData } from '../../../model';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';
import type { DialogRenderer } from '../../dialogRegistry';
import { initialsOf } from './account';

function Cell({ label, value }: { label: string; value: string }) {
  const text = value.trim();
  return (
    <div className="club-info-item">
      <span>{label}</span>
      <strong className={text ? undefined : 'club-empty-value'}>{text || '—'}</strong>
    </div>
  );
}

function ClubDetailsBody({ profile }: { profile: ClubProfile }) {
  const hasAny = hasAnyClubData(profile);
  const sections: ReadonlyArray<{ title: string; items: ReadonlyArray<[string, string]> }> = [
    { title: 'SÍDLO A IDENTIFIKACE', items: [['Adresa klubu', profile.address], ['IČO', profile.ico], ['DIČ', profile.dic]] },
    { title: 'VEDENÍ KLUBU', items: [['Jméno', profile.leaderName], ['E-mail', profile.leaderEmail], ['Telefon', profile.leaderPhone]] },
    { title: 'KONTAKTNÍ OSOBA', items: [['Jméno', profile.contactName], ['E-mail', profile.contactEmail], ['Telefon', profile.contactPhone]] },
  ];
  return (
    <>
      <div className="club-profile-summary">
        <div
          className="club-profile-monogram"
          style={profile.colorHex ? { background: profile.colorHex } : undefined}
          aria-hidden="true"
        >
          {initialsOf(profile.clubName) || '?'}
        </div>
        <div className="club-profile-text">
          <span>KLUBOVÝ PROFIL</span>
          <strong>{profile.clubName.trim() || 'Doplnit název klubu'}</strong>
          <small>Údaje klubu pro plánování již vytvořené objednávky</small>
        </div>
        <span className={`club-profile-badge${hasAny ? ' has-content' : ''}`}>{hasAny ? 'ÚDAJE ULOŽENY' : 'ÚDAJE NEVYPLNĚNY'}</span>
      </div>
      <div className="club-profile-grid">
        {sections.map((section) => (
          <section className="club-profile-section" key={section.title}>
            <h3>{section.title}</h3>
            {section.items.map(([label, value]) => (
              <Cell key={label} label={label} value={value} />
            ))}
          </section>
        ))}
      </div>
      <p className="club-overview-note">
        Nezadané položky jsou pouze prázdná pole. Žádná kontaktní osoba, adresa ani telefon nejsou automaticky domýšleny.
      </p>
    </>
  );
}

function EditClubButton({ hasAny }: { hasAny: boolean }) {
  const act = usePlannerActions();
  return (
    <button type="button" className="app-button primary" id="edit-club-profile" data-primary="1" onClick={() => act.openDialog({ kind: 'clubEdit' })}>
      {hasAny ? 'Upravit údaje klubu' : 'Doplnit údaje klubu'}
    </button>
  );
}

export const clubDetailsDialog: DialogRenderer<'clubDetails'> = ({ close, model }) => {
  const profile = model.profile;
  if (!profile) return { body: null };
  return {
    body: <ClubDetailsBody profile={profile} />,
    footer: (
      <>
        <button type="button" className="app-button" data-close="1" onClick={close}>Zavřít</button>
        <EditClubButton hasAny={hasAnyClubData(profile)} />
      </>
    ),
  };
};
