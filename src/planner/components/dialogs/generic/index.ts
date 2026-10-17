/*
 * The generic dialogs: bell, account, search and the club's data. Importing this module registers
 * them in `dialogRegistry`.
 *
 * Not here on purpose:
 *   settings      the board's settings gear belongs to the board owner (PL-D); the layer already
 *                 draws a titled frame for the kind until it registers its body.
 *   listDialog    the prototype's "list" is `openAgendaFullList('all')` - the `agendaFullList`
 *                 dialog of the agenda, which exists once.
 *   metricDialog  the prototype's KPI click is `selectPlanningType(type)` - the store action
 *                 `selectPlanningCategory`, not a dialog.
 */
import { dialogRegistry } from '../../dialogRegistry';
import { clubDetailsDialog } from './ClubDetailsDialog';
import { clubEditDialog } from './ClubEditDialog';
import { notificationsDialog } from './NotificationsDialog';
import { profileDialog } from './ProfileDialog';
import { searchDialog } from './SearchDialog';

dialogRegistry.notifications = notificationsDialog;
dialogRegistry.profile = profileDialog;
dialogRegistry.search = searchDialog;
dialogRegistry.clubDetails = clubDetailsDialog;
dialogRegistry.clubEdit = clubEditDialog;

export { clubDetailsDialog, clubEditDialog, notificationsDialog, profileDialog, searchDialog };
