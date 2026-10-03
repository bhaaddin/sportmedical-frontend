/* /storno-a-reklamace — placeholder page, replaced wholesale by its page agent (keep the default export). */

import { SlotText } from '../../site/SlotText';
import { PageHero } from '../ui';

export default function StornoPage() {
  return <PageHero title={<SlotText slotKey="storno.hero.title" />} />;
}
