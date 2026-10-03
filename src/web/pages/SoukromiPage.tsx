/* /ochrana-osobnich-udaju — placeholder page, replaced wholesale by its page agent (keep the default export). */

import { SlotText } from '../../site/SlotText';
import { PageHero } from '../ui';

export default function SoukromiPage() {
  return <PageHero title={<SlotText slotKey="soukromi.hero.title" />} />;
}
