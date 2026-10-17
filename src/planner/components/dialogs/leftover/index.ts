/*
 * The term dialogs that nothing else registers: the club term's detail, the public term's detail, the "new term" dialog,
 * the delete confirmation and the full list of terms. See `TermDialogs.tsx` for what each one stands for in our system.
 */
import { dialogRegistry } from '../../dialogRegistry';
import { agendaDetailDialog, agendaFullListDialog, deleteConfirmDialog, eventDetailDialog, newEventDialog } from './TermDialogs';

dialogRegistry.agendaDetail = agendaDetailDialog;
dialogRegistry.eventDetail = eventDetailDialog;
dialogRegistry.deleteConfirm = deleteConfirmDialog;
dialogRegistry.newEvent = newEventDialog;
dialogRegistry.agendaFullList = agendaFullListDialog;

export { agendaDetailDialog, agendaFullListDialog, deleteConfirmDialog, eventDetailDialog, newEventDialog };
export { termKindOf, type TermKind } from './TermDialogs';
