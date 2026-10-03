/* /vybaveni — placeholder page, replaced wholesale by its page agent (keep the default export). */

import { SlotText } from '../../site/SlotText';
import { PageHero } from '../ui';

export default function VybaveniPage() {
  return <PageHero title={<SlotText slotKey="vybaveni.hero.title" />} />;
}
