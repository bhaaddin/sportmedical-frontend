/* /diagnostika/zakladni — placeholder page, replaced wholesale by its page agent (keep the default export). */

import { SlotText } from '../../site/SlotText';
import { PageHero } from '../ui';

export default function DiagZakladniPage() {
  return <PageHero title={<SlotText slotKey="diagzakladni.hero.title" />} />;
}
