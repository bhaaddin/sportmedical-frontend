/* /diagnostika/vo2max — placeholder page, replaced wholesale by its page agent (keep the default export). */

import { SlotText } from '../../site/SlotText';
import { PageHero } from '../ui';

export default function DiagVo2maxPage() {
  return <PageHero title={<SlotText slotKey="diagvo2max.hero.title" />} />;
}
