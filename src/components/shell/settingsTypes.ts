import type { settingsItemAt } from '../../pages/settings/catalogue';

/** What `settingsItemAt` answers: the catalogue row an address belongs to, or null. */
export type SettingsItemAt = ReturnType<typeof settingsItemAt>;
