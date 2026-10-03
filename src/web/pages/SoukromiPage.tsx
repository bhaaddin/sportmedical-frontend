/* /ochrana-osobnich-udaju — the privacy text, laid out by the shared text-page block (slots in src/site/slots/soukromi.ts). */

import { SOUKROMI_SECTIONS } from '../../site/slots/soukromi';
import { TextPage } from './company/TextPage';

export default function SoukromiPage() {
  return <TextPage prefix="soukromi" sections={SOUKROMI_SECTIONS} path="/ochrana-osobnich-udaju" />;
}
