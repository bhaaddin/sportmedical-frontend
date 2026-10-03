/* /obchodni-podminky — placeholder page, replaced wholesale by its page agent (keep the default export). */

import { SlotText } from '../../site/SlotText';
import { PageHero } from '../ui';

export default function PodminkyPage() {
  return <PageHero title={<SlotText slotKey="podminky.hero.title" />} />;
}
