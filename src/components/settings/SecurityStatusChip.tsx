import { useEffect, useState } from 'react';
import { securityCenterApi, type SecurityLights } from '../../api/securityCenter';
import { StatusChip } from '../ui';
import { LIGHT_TONE } from '../../pages/settings/securityCenter/parts';
import { LIGHT_WORD, chipLight } from '../../pages/settings/securityCenter/model';

/**
 * The small status chip beside "Zabezpečení a zálohy" in the system area: the worst of the four lights, in a word
 * as well as a colour. It asks the lights route (colours only, not audited, so a chip that is drawn on every visit to
 * Nastavení does not fill the audit trail). While the answer is on its way, or when it cannot come, the chip says
 * "Neznámé" in grey: an unreachable server is never drawn as a calm green. Without the permission it is not drawn.
 */
export function SecurityStatusChip() {
  const [lights, setLights] = useState<SecurityLights | null>(null);

  useEffect(() => {
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
  }, []);

  const light = chipLight(lights);

  return (
    <StatusChip tone={LIGHT_TONE[light]} size="sm" dot testId="security-status-chip">
      {LIGHT_WORD[light]}
    </StatusChip>
  );
}

export default SecurityStatusChip;
