/* /storno-a-reklamace — cancellation and complaints, laid out by the shared text-page block (slots in src/site/slots/storno.ts). */

import { STORNO_SECTIONS } from '../../site/slots/storno';
import { TextPage } from './company/TextPage';

export default function StornoPage() {
  return <TextPage prefix="storno" sections={STORNO_SECTIONS} path="/storno-a-reklamace" />;
}
