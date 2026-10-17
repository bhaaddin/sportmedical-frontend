/*
 * The board's dialogs: importing this module registers them in `dialogRegistry`.
 *   settings      the gear: resolution, calendars, worker, služby, reference day capacity
 *   filterPicker  "Filtrovat činnosti"
 */
import { dialogRegistry } from '../../dialogRegistry';
import { filterPickerDialog } from './FilterPickerDialog';
import { settingsDialog } from './SettingsDialog';

dialogRegistry.settings = settingsDialog;
dialogRegistry.filterPicker = filterPickerDialog;

export { filterPickerDialog, settingsDialog };
