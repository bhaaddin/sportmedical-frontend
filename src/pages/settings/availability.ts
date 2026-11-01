/*
 * Settings screens that exist only when the server behind them does.
 *
 * "Bezpečnostní pravidla" is built on the API in parallel: until the server answers its route the screen is not offered
 * anywhere - not in the Administrace list, the settings menu or the palette - and nobody is told why (the app's rule for a
 * route an older server lacks, see `isRouteMissing`). `hiddenSettingsIds` is the one place that says which ids those are.
 */
import { useSecurityPolicy } from '../../api/securityPolicy';
import { usePermissions } from '../../auth/usePermission';
import { canSeeAdmin, type SettingsSection } from './catalogue';

export const SECURITY_POLICY_ITEM_ID = 'bezpecnostni-pravidla';

const NONE: ReadonlySet<string> = new Set();
const POLICY_MISSING: ReadonlySet<string> = new Set([SECURITY_POLICY_ITEM_ID]);

/** Ids to leave out while the server has not shown it has them. Only an administrator ever asks the server. */
export function useHiddenSettingsIds(): ReadonlySet<string> {
  const admin = canSeeAdmin(usePermissions());
  const { policy } = useSecurityPolicy(admin);
  return admin && policy === null ? POLICY_MISSING : NONE;
}

/** The sections without the hidden items (and without the sections that would be left empty). */
export function withoutHidden(sections: SettingsSection[], hidden: ReadonlySet<string>): SettingsSection[] {
  if (hidden.size === 0) return sections;
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => !hidden.has(item.id)) }))
    .filter((section) => section.items.length > 0);
}
