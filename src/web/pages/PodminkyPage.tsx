/* /obchodni-podminky — the clinic's terms, laid out by the shared text-page block (slots in src/site/slots/podminky.ts). */

import { PODMINKY_SECTIONS } from '../../site/slots/podminky';
import { TextPage } from './company/TextPage';

export default function PodminkyPage() {
  return <TextPage prefix="podminky" sections={PODMINKY_SECTIONS} path="/obchodni-podminky" />;
}
