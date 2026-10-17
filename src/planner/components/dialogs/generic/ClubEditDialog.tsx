/*
 * `clubEdit` - "Údaje o klubu" editor (prototype `editClubDetails()`).
 *
 * A club that exists in the system (`profile.clubId`, every real data source) is edited in the
 * application's own club dialog, `PayerDialog` - the one with ARES and the Vedení klubu list - so
 * the planner has no second copy of that form. It brings its own modal, hence `frameless`. After a
 * save the planner re-reads its data and the header shows the new values.
 *
 * A source without a club record (the in-memory demo) keeps the prototype's small form, saved
 * through `saveClubProfile`.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { clubsApi } from '../../../../api/clubs';
import { PayerDialog } from '../../../../pages/clubs/PayerDialog';
import { usePlannerData } from '../../../data/PlannerDataProvider';
import { plannerKeys } from '../../../data/PlannerDataSource';
import { usePlannerCommands } from '../../../data/usePlannerCommands';
import type { ClubProfile, ClubProfileField } from '../../../model';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';
import type { DialogRenderer } from '../../dialogRegistry';

/* ------------------------------ a club of the system ------------------------------ */

function ClubEditorHost({ clubId, close }: { clubId: string; close: () => void }) {
  const { source } = usePlannerData();
  const client = useQueryClient();
  const act = usePlannerActions();
  const club = useQuery({
    queryKey: [...plannerKeys.all(source.id), 'club', clubId],
    queryFn: () => clubsApi.getById(clubId),
    retry: false,
    gcTime: 0,
  });

  useEffect(() => {
    if (club.isError) {
      act.toast('Údaje klubu se nepodařilo načíst.');
      close();
    }
  }, [club.isError, act, close]);

  if (!club.data) return null;
  return (
    <PayerDialog
      editing={club.data}
      onClose={close}
      onSaved={() => void client.invalidateQueries({ queryKey: plannerKeys.all(source.id) })}
    />
  );
}

/* ------------------------------ the prototype's small form ------------------------------ */

type FormField = Exclude<ClubProfileField, 'clubName'>;

const ENTRIES: ReadonlyArray<readonly [FormField, string, 'text' | 'email' | 'tel']> = [
  ['ico', 'IČO', 'text'],
  ['dic', 'DIČ', 'text'],
  ['address', 'Adresa klubu', 'text'],
  ['leaderName', 'Jméno vedení klubu', 'text'],
  ['leaderEmail', 'E-mail vedení', 'email'],
  ['leaderPhone', 'Telefon vedení', 'tel'],
  ['contactName', 'Jméno kontaktní osoby', 'text'],
  ['contactEmail', 'E-mail kontaktní osoby', 'email'],
  ['contactPhone', 'Telefon kontaktní osoby', 'tel'],
];

export const CLUB_FORM_ID = 'club-contact-form';

function ClubContactForm({ profile, close }: { profile: ClubProfile; close: () => void }) {
  const commands = usePlannerCommands();
  const act = usePlannerActions();
  const [draft, setDraft] = useState<Record<FormField, string>>(
    () => Object.fromEntries(ENTRIES.map(([k]) => [k, profile[k] ?? ''])) as Record<FormField, string>,
  );
  const [saving, setSaving] = useState(false);

  const field = ([key, label, type]: (typeof ENTRIES)[number]) => (
    <div className={`field${key === 'address' ? ' full' : ''}`} key={key}>
      <label htmlFor={`ci-${key}`}>{label}</label>
      <input
        id={`ci-${key}`}
        type={type}
        value={draft[key]}
        placeholder={key === 'address' ? 'Ulice, číslo, PSČ, město' : 'Vyplňte údaj'}
        onChange={(event) => setDraft((d) => ({ ...d, [key]: event.target.value }))}
      />
    </div>
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await commands.saveClubProfile(draft);
      close();
      act.toast('Kontaktní údaje klubu uloženy');
    } catch (error) {
      act.toast(error instanceof Error ? error.message : 'Údaje klubu se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="contact-card-info">
        Údaje o klubu jsou oddělené od objednávky a lze je upravit kdykoliv během plánování. Nevyplněné hodnoty jsou úmyslně prázdné – nebyly zadány žádné kontakty.
      </div>
      <form id={CLUB_FORM_ID} autoComplete="off" onSubmit={(event) => void submit(event)}>
        <div className="contact-subheading">IDENTIFIKAČNÍ ÚDAJE KLUBU</div>
        <div className="contact-detail-grid">{ENTRIES.slice(0, 3).map(field)}</div>
        <div className="contact-subheading">VEDENÍ KLUBU</div>
        <div className="contact-detail-grid">{ENTRIES.slice(3, 6).map(field)}</div>
        <div className="contact-subheading">KONTAKTNÍ OSOBA</div>
        <div className="contact-detail-grid">{ENTRIES.slice(6).map(field)}</div>
      </form>
    </>
  );
}

export const clubEditDialog: DialogRenderer<'clubEdit'> = ({ close, model }) => {
  const profile = model.profile;
  if (!profile) return { body: null };
  if (profile.clubId) return { frameless: true, body: <ClubEditorHost clubId={profile.clubId} close={close} /> };
  return {
    body: <ClubContactForm profile={profile} close={close} />,
    footer: (
      <>
        <button type="button" className="app-button" data-close="1" onClick={close}>Zrušit</button>
        <button type="submit" form={CLUB_FORM_ID} className="app-button primary" id="save-club-contact">Uložit údaje</button>
      </>
    ),
  };
};
