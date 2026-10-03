import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';
import { cardSlots, gallerySlots, heroSlots } from '../../web/pages/services/slotFactory';

/*
 * InBody 770 (/web/inbody). Defaults: the artboard V-InBody for the headings and captions, the
 * clinic's website for what the device measures and what each variant contains. Prices are NOT
 * here: they come from the price list.
 */

const HERO = 'InBody › Hero';
const MEASURES = 'InBody › Co přístroj měří';
const VARIANTS = 'InBody › Varianty měření';
const WHY = 'InBody › Proč balíček pěti měření';
const PREP = 'InBody › Příprava';

export const inbodySlots: SlotDef[] = [
  ...heroSlots('inbody', HERO, {
    eyebrow: 'InBody 770',
    title: 'Přesný obraz těla, ne jen váha',
    lead: 'Analyzátor InBody 770 rozdělí tělo na segmenty a ukáže svalovou hmotu, tuk, vodu i rovnováhu mezi končetinami. U zátěžových testů je základní měření v ceně.',
    photoCaption: 'přístroj InBody 770',
  }),

  textSlot('inbody.measures.title', 'Co měří — titulek sekce', MEASURES, 'Co InBody 770 měří'),
  textSlot('inbody.measures.lead', 'Co měří — úvod', MEASURES, 'Technologie DSM-BIA bez empirických odhadů: šest frekvencí a segmentální měření pěti částí těla.'),
  ...cardSlots('inbody.measures', MEASURES, 'Parametr', [
    { title: 'Tělesné složení', text: 'Hmotnost, procento tuku, svalová hmota a BMI.' },
    { title: 'Segmentální analýza', text: 'Svalová hmota a tuk zvlášť pro jednotlivé končetiny a trup.' },
    { title: 'Voda a metabolismus', text: 'Celková tělesná voda, poměr mimobuněčné a celkové vody (ECW/TBW) a bazální metabolismus.' },
    { title: 'Zdraví tkání', text: 'Viscerální tuková plocha, fázový úhel jako ukazatel buněčného zdraví a SMI pro hodnocení sarkopenie.' },
  ]),

  textSlot('inbody.variants.title', 'Varianty měření — titulek sekce', VARIANTS, 'Varianty měření'),
  textSlot(
    'inbody.variants.lead',
    'Varianty měření — úvod',
    VARIANTS,
    'Základní měření dává přehled klíčových parametrů. Komplexní přidává rozšířenou interpretaci, grafické znázornění výsledků a odbornou konzultaci.',
    { multiline: true },
  ),
  textSlot('inbody.variants.note', 'Varianty měření — poznámka pod ceníkem', VARIANTS, 'Součástí výživového plánu jsou dvě kontrolní měření v jeho průběhu, aby bylo vidět, jestli funguje.'),

  textSlot('inbody.why.title', 'Balíček pěti měření — titulek sekce', WHY, 'Proč balíček pěti měření'),
  ...cardSlots('inbody.why', WHY, 'Důvod', [
    { title: 'Výhodnější cena', text: 'Pět měření vyjde levněji než jednotlivě.' },
    { title: 'Trend místo jednoho čísla', text: 'Jedno měření nic neřekne. Pět ukáže, kam to jde.' },
    { title: 'Potvrzení, že trénink funguje', text: 'Vidíte reálný dopad tréninku, výživy a regenerace.' },
    { title: 'Detailní rozbor pokaždé', text: 'Při každém měření kompletní rozbor po segmentech.' },
  ]),
  ...gallerySlots('inbody.why', WHY, 'Galerie', ['měření', 'výstupní protokol', 'konzultace nad výsledky']),

  textSlot('inbody.prep.title', 'Příprava — titulek sekce', PREP, 'Příprava na měření'),
  textSlot('inbody.prep.text', 'Příprava — text', PREP, 'Měření je zcela neinvazivní a trvá méně než 60 sekund. Co dodržet, aby bylo přesné, najdete v doporučení ke stažení.', { multiline: true }),
  textSlot('inbody.prep.link', 'Příprava — odkaz', PREP, 'Doporučení k InBody měření'),
];
