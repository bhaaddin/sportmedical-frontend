import type { SlotDef } from '../slotTypes';
import { DIAG_KOMPENZACNI, detailSlots } from '../../web/pages/services/content/details';

/*
 * Slots of the page /diagnostika/kompenzacni: Kompenzační plán. Defaults: the wording of the matching page of the live
 * site (sportmedical-diagnostics.cz), as published; Slovak words and obvious typos corrected. The price
 * (card) is NOT here: it comes from the price list by the service's name. The page draws the same spec
 * (src/web/pages/services/content/details.ts), so a slot cannot be registered without being drawn.
 */

export const diagkompenzacniSlots: SlotDef[] = detailSlots(DIAG_KOMPENZACNI);
