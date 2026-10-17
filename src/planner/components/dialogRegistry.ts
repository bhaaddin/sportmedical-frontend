/*
 * Where the dialogs plug in.
 *
 * `DialogLayer` draws the frame (title, close, scrim) for every kind of dialog and asks this
 * registry for the content. Add an entry per dialog - from its own file under
 * `components/dialogs/` - instead of editing `DialogLayer.tsx`:
 *
 *     // components/dialogs/OrderDetailsDialog.tsx
 *     export const orderDetailsDialog: DialogRenderer<'orderDetails'> = ({ close }) => ({
 *       body: <OrderDetailsBody />,
 *       footer: <button className="app-button" onClick={close}>Zavřít</button>,
 *     });
 *
 *     // here
 *     dialogRegistry.orderDetails = orderDetailsDialog;
 *
 * The renderer is called during render of `DialogLayer`; to use hooks return a component element
 * as `body` / `footer` (as above) rather than calling hooks in the renderer itself.
 */
import type { ReactNode } from 'react';
import type { DialogKind, DialogState } from '../model';
import type { PlannerModel } from '../state/usePlannerModel';

export interface DialogContent {
  body?: ReactNode;
  footer?: ReactNode;
  /** Extra class for the card, e.g. `smart-editor-modal`. */
  className?: string;
  /** Overrides the default title / subtitle of `dialogMeta`. */
  title?: string;
  subtitle?: string;
  /**
   * The body brings its own modal (e.g. the application's club editor): the layer renders it
   * without the planner's scrim / card, and does not block the stage underneath.
   */
  frameless?: boolean;
}

export type DialogRenderer<K extends DialogKind = DialogKind> = (props: {
  dialog: Extract<DialogState, { kind: K }>;
  close: () => void;
  /** The loaded planner data (profile, catalogue, ctx…): for choices that depend on it. Not a hook. */
  model: PlannerModel;
}) => DialogContent;

export type DialogRegistry = { [K in DialogKind]?: DialogRenderer<K> };

/** Mutable on purpose: dialog modules register themselves at import time. */
export const dialogRegistry: DialogRegistry = {};
