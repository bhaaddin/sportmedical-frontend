/*
 * ClinicTopBar - the top of the standard calendar (`/planovani`, no club): ONE slim line, nothing else.
 *
 *   [ clinic name ................................................ bell (unread)  profile chip ]
 *
 * Owner, 20. 10. 2026: "the calendar does not need this whole big top card - make it smaller and keep only what is really
 * needed". The big card (logo slot, KLINIKA tag, "Nastavení firmy", IČO / DIČ / Adresa, vedení, kontaktní osoba) is the
 * header of a CLUB's screen (`ClubHeader`, `mode='club'`), where the club's own data is needed; the clinic's company data
 * stays in the settings (`/nastaveni/firma-a-faktury`). The room the card gave back goes to the sidebar and the board
 * (`planner.fluid.css` / `planner.compact.css`: `.is-slim`).
 *
 * The name is the company's legal name from the settings (`useClinicHeaderProfile`), else the catalogue's clinic name, and is
 * drawn smaller when it is wider than the bar (`useFitName`). It keeps the file's ids (`#club-unified-header`,
 * `#club-identity-name`) so the bar takes the header's look (frame, accent colours) from the generated stylesheet.
 */
import { useRef, type CSSProperties } from 'react';
import { PlannerUserTools, type PlannerUserToolsProps } from './PlannerUserTools';
import { usePlannerCatalogue } from './context';
import { useClinicHeaderProfile } from './dialogs/generic/headerData';
import { useFitName } from './useFitName';

export function ClinicTopBar({ user = null }: PlannerUserToolsProps) {
  const catalogue = usePlannerCatalogue();
  /* the name only: no account list is asked for */
  const clinic = useClinicHeaderProfile(catalogue.clinicName, true, false);
  const name = clinic.profile.clubName?.trim() || 'Doplnit název kliniky';
  const nameRef = useRef<HTMLElement | null>(null);
  const nameFit = useFitName(nameRef, name);
  return (
    <header id="club-unified-header" className="club-unified-header is-slim" aria-label="Horní lišta kalendáře" data-testid="club-header" data-mode="clinic">
      <strong
        id="club-identity-name"
        ref={nameRef}
        className="club-identity-name"
        title={nameFit.scale < 1 ? name : undefined}
        data-fit={nameFit.cut ? 'cut' : nameFit.scale < 1 ? 'shrunk' : undefined}
        style={nameFit.scale < 1 ? ({ '--name-fit': nameFit.scale } as CSSProperties) : undefined}
      >
        {name}
      </strong>
      <PlannerUserTools user={user} />
    </header>
  );
}
