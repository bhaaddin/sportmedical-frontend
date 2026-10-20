/* ══════════════════════════════════════════════════════════════
   WHAT THE SCHEDULING API SAYS WHEN IT REFUSES, IN CZECH

   The booking endpoints (calendars, working hours, exceptions, činnosti,
   služby, absences, partner orders, blocks) answer a refused value with
   `422 { success:false, message:"scheduling.working_hours.end_before_start" }`:
   the message is the rule's CODE, not a sentence. `apiError.toBookingError`
   passes a 422's message on to the screen (contract 3.2), so before this file
   a receptionist read "scheduling.exception.hours_required" in a red box.

   One table, one place: a code the table does not know is not shown either -
   the caller then falls back to the fixed sentence for the kind of failure
   (`booking.errors.domainRule`). Nothing here is a business rule; it only
   words the refusals the server already makes.
   ══════════════════════════════════════════════════════════════ */

const SENTENCES: Record<string, string> = {
  'scheduling.absence.range_invalid': 'Nepřítomnost musí končit stejný den, nebo později, než začíná.',
  'scheduling.absence.worker_required': 'Vyberte zaměstnance, který je nepřítomen.',
  'scheduling.activity.clinic_service_required': 'Činnost musí patřit pod službu. Vyberte ji.',
  'scheduling.activity.duration_positive': 'Délka činnosti musí být aspoň 1 minuta.',
  'scheduling.activity.name_required': 'Vyplňte název činnosti.',
  'scheduling.activity.parallel_capacity_positive': 'Počet souběžných míst musí být aspoň 1.',
  'scheduling.activity.required_document_invalid': 'Jedna z vybraných šablon dokumentů už neexistuje. Vyberte dokumenty znovu.',
  'scheduling.activity.required_document_unknown': 'Jedna z vybraných šablon dokumentů už neexistuje. Vyberte dokumenty znovu.',
  'scheduling.appointment.agreed_price_invalid': 'Dohodnutá cena musí být nezáporná, v povoleném rozsahu a nejvýše na dvě desetinná místa.',
  'scheduling.availability.examination_pause_invalid': 'Pauza mezi vyšetřeními je mimo povolený rozsah.',
  'scheduling.booking.paperwork.consent_missing': 'Pacient nemá potřebný souhlas.',
  'scheduling.booking.paperwork.document_missing': 'Pacient nedoložil dokument, který činnost vyžaduje.',
  'scheduling.club_block.activities_required': 'Vyberte aspoň jednu činnost.',
  'scheduling.club_block.activity_seats_invalid': 'Počet míst u činnosti není platný.',
  'scheduling.club_block.calendars_required': 'Vyberte aspoň jeden kalendář.',
  'scheduling.club_block.club_required': 'Vyberte klub.',
  'scheduling.club_block.daily_hours_invalid': 'Denní hodiny bloku nejsou platné.',
  'scheduling.club_block.id_required': 'Chybí označení bloku.',
  'scheduling.club_block.name_too_long': 'Název bloku je příliš dlouhý.',
  'scheduling.club_block.not_active': 'Blok už není aktivní.',
  'scheduling.club_block.note_too_long': 'Poznámka k bloku je příliš dlouhá.',
  'scheduling.club_block.player_count_positive': 'Počet hráčů musí být aspoň 1.',
  'scheduling.club_block.range_invalid': 'Konec bloku musí být stejný den, nebo později, než začíná.',
  'scheduling.club_block.range_too_long': 'Blok je příliš dlouhý.',
  'scheduling.club_block.ranges_invalid': 'Dny bloku nejsou platné.',
  'scheduling.club_block.token_required': 'Chybí odkaz bloku.',
  'scheduling.activity.questionnaire_definition_unknown': 'Vybraný dotazník už neexistuje. Vyberte jiný.',
  'scheduling.activity.service_item_unknown': 'Vybraná položka ceníku už neexistuje. Vyberte jinou.',
  'scheduling.activity.slug_invalid': 'Název činnosti nejde převést na adresu. Zkuste jej upravit.',
  'scheduling.appointment.conflict_detected': 'V tomto čase už je jiný termín.',
  'scheduling.appointment.duration_positive': 'Termín musí trvat aspoň 1 minutu.',
  'scheduling.appointment.id_required': 'Chybí označení termínu.',
  'scheduling.appointment.invalid_transition': 'Termín v tomto stavu nejde takto změnit.',
  'scheduling.appointment.start_required': 'Vyplňte začátek termínu.',
  'scheduling.availability.gap_beyond_horizon': 'Pauza mezi termíny je delší než dohled, na který se termíny nabízejí.',
  'scheduling.availability.gap_negative': 'Pauza mezi termíny nesmí být záporná.',
  'scheduling.availability.horizon_negative': 'Počet dní dopředu nesmí být záporný.',
  'scheduling.block.author_required': 'Chybí, kdo čas blokuje.',
  'scheduling.block.reason_required': 'Vyplňte důvod blokace.',
  'scheduling.booking.hold_expired': 'Držení termínu vypršelo. Vyberte termín znovu.',
  'scheduling.booking.override_reason_required': 'Při zásahu mimo pravidla je potřeba napsat důvod.',
  'scheduling.booking.paperwork.questionnaire_expired': 'Dotazník pacienta propadl. Pacient jej musí vyplnit znovu.',
  'scheduling.booking.paperwork.questionnaire_missing': 'Pacient nemá vyplněný dotazník.',
  'scheduling.booking.paperwork.registration_incomplete': 'Registrace pacienta není dokončená.',
  'scheduling.booking.paperwork.report_missing': 'Chybí výpis, který činnost vyžaduje.',
  'scheduling.booking.patient_required': 'Vyberte pacienta.',
  'scheduling.booking.representative_missing': 'U nezletilého chybí zákonný zástupce.',
  'scheduling.booking.status_transition_refused': 'Stav termínu nejde takto změnit.',
  'scheduling.booking.time_taken': 'Tento čas už je obsazený.',
  'scheduling.calendar.clinic_service_required': 'Kalendář musí provozovat službu. Vyberte ji.',
  'scheduling.calendar.display_step_positive': 'Krok zobrazení musí být aspoň 1 minuta.',
  'scheduling.calendar.name_required': 'Vyplňte název.',
  'scheduling.calendar_access.incomplete': 'Přístup ke kalendáři nejde uložit bez vybraného zaměstnance.',
  'scheduling.color.invalid': 'Barva musí být zapsaná jako #RRGGBB (šest šestnáctkových číslic).',
  'scheduling.day_activity.incomplete': 'U dne chybí činnost nebo čas.',
  'scheduling.day_activity.window_invalid': 'Čas, kdy se činnost nabízí, musí končit později, než začíná.',
  'scheduling.exception.end_before_start': 'Konec musí být později než začátek.',
  'scheduling.exception.hours_on_closed_day': 'Zavřený den nemůže mít jiné hodiny.',
  'scheduling.exception.hours_required': 'Jiné hodiny potřebují začátek i konec.',
  'scheduling.history.author_required': 'Chybí, kdo změnu provedl.',
  'scheduling.partner.count_positive': 'Počet míst musí být aspoň 1.',
  'scheduling.partner.name_required': 'Vyplňte název klubu nebo firmy.',
  'scheduling.partner.token_required': 'Chybí odkaz objednávky.',
  'scheduling.partner.window_end_before_start': 'Konec vyhrazeného času musí být později než začátek.',
  'scheduling.patient.id_required': 'Chybí označení pacienta.',
  'scheduling.period.end_before_start': 'Konec platnosti musí být později než začátek.',
  'scheduling.period.impact_not_acknowledged': 'Změna se dotkne objednaných termínů. Nejdřív si je prohlédněte a potvrďte.',
  'scheduling.period.name_required': 'Vyplňte název období.',
  'scheduling.period.overlaps': 'Období se překrývá s jiným obdobím téhož kalendáře.',
  'scheduling.range.end_before_start': 'Konec rozmezí musí být později než začátek.',
  'scheduling.range.not_utc': 'Čas rozmezí není ve správném tvaru.',
  'scheduling.sort_order_negative':
    'Číslo je mimo povolený rozsah. Pořadí nesmí být záporné; počet dnů, minut a hodin musí být aspoň 1.',
  'scheduling.text.required': 'Vyplňte povinný text.',
  'scheduling.text.too_long': 'Text je příliš dlouhý. Zkraťte jej.',
  'scheduling.working_hours.break_end_before_start': 'Pauza potřebuje začátek i konec a musí končit později, než začne.',
  'scheduling.working_hours.break_outside': 'Pauza musí ležet uvnitř pracovní doby.',
  'scheduling.working_hours.end_before_start': 'Konec pracovní doby musí být později než začátek.',
  'scheduling.working_hours.overlap': 'Pracovní doba se překrývá s jiným řádkem téhož dne.',
  'scheduling.working_hours.period_required': 'Pracovní doba patří do období. Nejdřív jej založte.',
  'scheduling.working_hours.week_cycle_invalid': 'Střídání týdnů není ve správném tvaru.',
};

/** A machine code such as `scheduling.exception.hours_required` (lower-case words joined by dots and underscores). */
export const isMessageCode = (text: string): boolean => /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(text.trim());

/**
 * What to show for a server message: a sentence is shown as it is, a known code
 * as its Czech sentence, and an unknown code as nothing (`undefined`), so the
 * caller's fixed sentence takes over instead of a code reaching a person.
 */
export function wordedServerMessage(message: string | undefined): string | undefined {
  if (message === undefined) return undefined;
  const text = message.trim();
  if (text === '') return undefined;
  if (!isMessageCode(text)) return text;
  return SENTENCES[text];
}

/** The codes this table words - exported so a test can hold it against the server's list. */
export const KNOWN_SCHEDULING_CODES: readonly string[] = Object.keys(SENTENCES);
