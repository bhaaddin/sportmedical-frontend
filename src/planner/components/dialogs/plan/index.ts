/*
 * The club-planning dialogs: the order overview, the finish check (with the shortfall confirm and the real
 * write), the publication (link, form preview, e-mail text), the confirmations of a move / an edge pull, and the
 * smart editor of a term. Importing this module registers them in `dialogRegistry`.
 */
import { dialogRegistry } from '../../dialogRegistry';
import { finishDialog } from './FinishDialog';
import { orderDetailsDialog } from './OrderDetailsDialog';
import { emailPreviewDialog, formPreviewDialog, publishDialog } from './PublishDialogs';
import { smartEditConfirmDialog, smartEditDialog } from './SmartEditDialogs';
import { expandConfirmDialog, moveConfirmDialog } from './TermConfirmDialogs';

dialogRegistry.orderDetails = orderDetailsDialog;
dialogRegistry.finish = finishDialog;
dialogRegistry.publish = publishDialog;
dialogRegistry.formPreview = formPreviewDialog;
dialogRegistry.emailPreview = emailPreviewDialog;
dialogRegistry.moveConfirm = moveConfirmDialog;
dialogRegistry.expandConfirm = expandConfirmDialog;
dialogRegistry.smartEdit = smartEditDialog;
dialogRegistry.smartEditConfirm = smartEditConfirmDialog;

export {
  emailPreviewDialog,
  expandConfirmDialog,
  finishDialog,
  formPreviewDialog,
  moveConfirmDialog,
  orderDetailsDialog,
  publishDialog,
  smartEditConfirmDialog,
  smartEditDialog,
};
