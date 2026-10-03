/* /diagnostika/vo2max — a detail page of Sportovní diagnostika: its spec is src/web/pages/services/content/details.ts,
   its slots src/site/slots/ (the same spec), its price comes from the price list. */

import { DetailPage } from './services/DetailPage';
import { DIAG_VO2MAX } from './services/content/details';

export default function DiagVo2maxPage() {
  return <DetailPage spec={DIAG_VO2MAX} />;
}
