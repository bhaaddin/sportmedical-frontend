/* /diagnostika/komplexni — placeholder page, replaced wholesale by its page agent (keep the default export). */

import { SlotText } from '../../site/SlotText';
import { PageHero } from '../ui';

export default function DiagKomplexniPage() {
  return <PageHero title={<SlotText slotKey="diagkomplexni.hero.title" />} />;
}
