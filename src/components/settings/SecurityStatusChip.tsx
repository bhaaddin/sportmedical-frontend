import { useEffect, useState } from 'react';
import { securityCenterApi, type SecurityLights } from '../../api/securityCenter';
import { StatusChip } from '../ui';
import { LIGHT_TONE } from '../../pages/settings/securityCenter/parts';
import { LIGHT_WORD, chipLight } from '../../pages/settings/securityCenter/model';

/**
 * The four security lights, asked once per mount (colours only, not audited, so a screen drawn on every visit to
 * Nastavení does not fill the audit trail). `null` while the answer is on its way, when it cannot come, or when
 * `enabled` is false (a person who may not open the screen is never asked for).
 */
export function useSecurityLights(enabled = true): SecurityLights | null {
  const [lights, setLights] = useState<SecurityLights | null>(null);
  useEffect(() => {
    if (!enabled) {
      setLights(null);
      return undefined;
    }
    let alive = true;
    securityCenterApi
      .lights()
      .then((next) => {
        if (alive) setLights(next);
      })
      .catch(() => {
        if (alive) setLights(null);
      });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return lights;
}

/** The chip for lights somebody already holds: the worst of the four, in a word as well as a colour. */
export function SecurityLightChip({ lights }: { lights: SecurityLights | null }) {
  const light = chipLight(lights);
  return (
    <StatusChip tone={LIGHT_TONE[light]} size="sm" dot testId="security-status-chip">
      {LIGHT_WORD[light]}
    </StatusChip>
  );
}

/**
 * The small status chip beside "Zabezpečení a zálohy" in the system area. While the answer is on its way, or when it
 * cannot come, the chip says "Neznámé" in grey: an unreachable server is never drawn as a calm green. Without the
 * permission it is not drawn.
 */
export function SecurityStatusChip() {
  return <SecurityLightChip lights={useSecurityLights()} />;
}

export default SecurityStatusChip;
