/* /diagnostika/kompenzacni-plan — placeholder page, replaced wholesale by its page agent (keep the default export). */

import { SlotText } from '../../site/SlotText';
import { PageHero } from '../ui';

export default function DiagKompenzacniPage() {
  return <PageHero title={<SlotText slotKey="diagkompenzacni.hero.title" />} />;
}
