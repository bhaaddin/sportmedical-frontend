# Live site inventory — https://sportmedical-diagnostics.cz (captured 2026-10-03)

Produced by CRAWL for Etapa 3 (BRIEF items 2 and 8). Everything below was read through WebFetch only (HTML -> markdown -> model extraction), so wording is as the extractor returned it. Where a fetch cut or paraphrased text the page file says so (`[cut]`, `[truncated]`, `[paraphrase-level]`). Verify legally relevant wording (policies, terms, ECG/spiro descriptions) against the live page before publishing.

Files: `INDEX.md` (this) · `prices.json` · `company.json` · `documents.json` · `_site-chrome.md` (header, footer, repeated blocks) · `pages/*.md` (one per URL).

## 0. The five things to know first
1. **Spiroergometrické vyšetření: 3 500 Kč vs 4 000 Kč on the live site itself.** Shopify product, product cards and comparison table say 3 500; the "CENÍK SLUŽEB" card and /pages/cenik-sluzeb say 4 000; the package compare-at prices (5 200 / 6 000) only add up with 4 000. prices.json uses 4000 and records 3500 as `alternatePriceCzk`. Needs Matko.
2. **VO₂max analýza is 3 500 Kč live; our catalogue has 4 000.**
3. **Two conflicting group-discount scales are live** (A: 4–5 −5 %, 5–9 −10 %, 10+ −15 %; B: 5–9 −5 %, 10+ −10 %). See prices.json `groupDiscounts`.
4. **There are FIVE combined packages, not three** (4 × exam + diagnostics, 1 × Komplexní diagnostika + Vo2max). Prices and compare-at prices are in prices.json `items[].isPackage`. All five match what our catalogue already has.
5. **DIČ, bank account and datová schránka are NOT published** on the live site (company.json has `null`). The datová schránka ID that sits in our slot defaults is not on the live site either and must be removed (BRIEF item 8).

## 1. Every page found

Sitemap (`/sitemap.xml`) children: pages (23), products (3 + home), collections (3), blogs (1), metaobject pages (1), agentic discovery (`/agents.md`). Policies come from the footer (`/policies/*`). Nothing else is linked from header/footer.

| Slug (file in pages/) | URL | Title | What it is | Maps to our route |
|---|---|---|---|---|
| home | / | SportMedical Diagnostics \| Sportovní lékařské prohlídky a diagnostika | Landing: slogans, 3 service areas, booking cards, mobile testing for clubs (min. 30 sportovců), 9 partner club cards | `landing` (+ club teaser -> `kluby`) |
| o-nas-1 | /pages/o-nas-1 | O nás | Company philosophy ("Nový pohled na sportovní medicínu a diagnostiku", 3 pilíře, "Sportovní diagnostika bez hranic"). Navigation item "O nás" | `o-nas` |
| o-nas | /pages/o-nas | Služby | Mislabelled: a "Ceník vyšetření a diagnostiky" overview (3 blocks) + a LEGACY address block (Pod Krejcárkem). Footer link "O nás" points here by mistake | `sluzby` (text only; DROP the legacy address block) |
| sportovni-lekarske-prohlidky | /pages/sportovni-lekarske-prohlidky | Sportovní lékařské prohlídky | 3 exams, 4 required documents, equipment (5), mobile tests for clubs, comparison table, price cards for exams and 4 packages, group discounts | `prohlidky` (+ NEW `vybaveni` for the equipment section) |
| sportovni-diagnostika | /pages/sportovni-diagnostika | sportovni diagnostika | Diagnostics hub: 5 service cards, tech description, 9 price cards with full include/exclude lists, group discounts, contact form | `diagnostika` |
| zakladni-diagnostika | /pages/zakladni-diagnostika | Základní diagnostika | Detail page of Základní diagnostika | `diagnostika` (section) or NEW `diagnostika/zakladni` |
| komplexni-diagnostika | /pages/komplexni-diagnostika | Komplexní diagnostika | Detail page incl. video-biomechanical analysis | `diagnostika` (section) or NEW `diagnostika/komplexni` |
| vo2max-analyza | /pages/vo2max-analyza | Vo2max Analýza | Cortex21 spiroergometry (mobile + lab) | `diagnostika` (section) or NEW `diagnostika/vo2max` |
| vidoeo-kompenzacne-plany | /pages/vidoeo-kompenzacne-plany | Vidoeo kompenzacne plany | Video-instructed compensation plan, 1 000 Kč, app delivery, 3 months validity | `diagnostika` (section) or NEW `diagnostika/kompenzacni-plan` |
| inbody | /pages/inbody | InBody | InBody 770: what it measures, 4 priced variants, group discounts. Page footer has STALE contact data | `inbody` |
| cenik-sluzeb | /pages/cenik-sluzeb | Ceník služeb | Full price list: exams, packages, diagnostics, InBody; group discount scale B | `cenik` (generated from the price list, not text) |
| rezervacni-system | /pages/rezervacni-system | Rezervační Systém | Booking landing: 3 areas with CGM MEDISTAR links, rating 4,9/5, package ordering note (60 min, 2 parts), documents | `landing` booking section / our `/objednat` (app route); documents -> `dokumenty` |
| dokumenty-ke-stazeni | /pages/dokumenty-ke-stazeni | Dokumenty ke stažení | 4 required documents + 3 information PDFs (menu: "Dokumenty k testům") | `dokumenty` |
| contact | /pages/contact | Kontakt | Contact page: address, transport, hours, form, plus a ~20-question FAQ (test preparation, ergometry vs spiroergometry, validity 12 months, InBody, diagnostics, compensation plans) | `kontakt` + NEW `faq` |
| mobilni-testovani | /pages/mobilni-testovani | Mobilní testování | Club offer (page body is a near-copy of the exams page with LEGACY package prices); the real club statements are on the home page | `kluby` |
| informace-o-zpracovani-osobnich-udaju | /pages/informace-o-zpracovani-osobnich-udaju | Informace o zpracování osobních údajů | Empty clone: carries only the "O nás" text. The real policy is /policies/privacy-policy | none (use the policy) |
| povinnost-predlozeni-vypisu-ze-zdravotni-dokumentace | /pages/povinnost-predlozeni-vypisu-ze-zdravotni-dokumentace | POVINNOST PŘEDLOŽENÍ VÝPISU… | Empty clone (O nás text); the requirement text is on the exams page and in the PDF | none (content -> `prohlidky`/`dokumenty`) |
| dulezite-informace-k-testu | /pages/dulezite-informace-k-testu | Důležité informace k testu | Clone (O nás text), low-confidence capture; linked only from the InBody "Rezervovat termin" button | none |
| popis-ohledne-zekg | /pages/popis-ohledne-zekg | popis ohledne ZEKG | Draft clone, no ECG text | none |
| popis-spiroergonomickeho-vysetrenia | /pages/popis-spiroergonomickeho-vysetrenia | popis spiroergonomického vyšetrenia | Draft clone, no spiro text | none |
| rozdiel-zatazove-testy | /pages/rozdiel-zatazove-testy | rozdiel- zatazove testy | LEGACY: ergometry vs spiroergometry explainer (durations 10–15 / 30–40 min) | none (the FAQ on `contact` has the current version) |
| zatezove-testy-teren | /pages/zatezove-testy-teren | zatezove testy teren | LEGACY landing of old business (old prices 2 000/2 500, Pod Krejcárkem address) | none — do not reuse |
| zatazovy-test-laborator | /pages/zatazovy-test-laborator | zatazovy test laborator | LEGACY (same) | none — do not reuse |
| avada-faqs | /pages/avada-faqs | Nejčastější dotazy zákazníků | FAQ app page, EMPTY in server HTML (real FAQ is on /pages/contact) | NEW `faq` (content from `contact`) |
| policies-privacy-policy | /policies/privacy-policy | Zásady ochrany osobních údajů | Shopify generic text, last updated 18. 1. 2026; no health-data clauses | NEW `ochrana-osobnich-udaju` (write our own, see section 4) |
| policies-terms-of-service | /policies/terms-of-service | Podmínky služby | Shopify generic e-shop terms (24 sections); does not fit a clinic | NEW `obchodni-podminky` |
| policies-refund-policy | /policies/refund-policy | Zásady vrácení peněz | Clinic's own storno terms (24 h free cancellation, no-show, exceptions, reklamace, 14-day withdrawal not applicable) | NEW `storno-a-reklamace` (can be one page with obchodní podmínky) |
| policies-contact-information | /policies/contact-information | Kontaktní údaje | Company + premises + hours | `kontakt` (billing block) |
| products-and-collections | /products/komplexni-sportovni-prohlidka-kopie · /products/zakladni-zatezovy-test-vcetne-zatetoveho-ekg · /products/spiroergometricke-vysetreni-vcetne-zatezoveho-ekg · /collections/frontpage · /collections/telovychovne-lekarstvi · /collections/inbody-diagnostika (empty) · /blogs/news (empty) · /pages/zdravotn-dotazn-k/zdravotn-dotazn-k-pz2mhkhp (404) · /agents.md | — | 3 Shopify products (prices in prices.json), 3 collections, empty blog, unreachable questionnaire metaobject, Shopify agent file | prices -> `cenik`; rest none |

Not found: no "Kontaktní stránka" separate from /pages/contact, no "Reklamační řád", no cookies policy page (only the Shopify consent banner link `#shopifyReshowConsentBanner`), no "Obchodní podmínky" separate from Shopify terms, no blog articles, no downloadable XLSX.

## 2. Pages that should become new public pages (`NEW:`)
| Suggested slug | Content source | Why |
|---|---|---|
| `NEW: faq` | pages/contact.md ("FAQ SEKCE", ≈20 Q&A) | the clinic's own long FAQ has no page yet |
| `NEW: obchodni-podminky` | pages/policies-terms-of-service.md (+ storno) | legal; Shopify boilerplate must be replaced by a clinic text (legal review) |
| `NEW: ochrana-osobnich-udaju` | pages/policies-privacy-policy.md | legal; live text is generic and silent on health data, retention and ÚOOÚ; Matko/lawyer must supply the real text |
| `NEW: storno-a-reklamace` | pages/policies-refund-policy.md | clinic-owned text, usable almost as is |
| `NEW: mobilni-testovani` (or merge into `kluby`) | home.md club block, mobilni-testovani.md, sportovni-lekarske-prohlidky.md "Mobilní zátěžové testy pro sportovní kluby" | `kluby` exists; the live page is the same offer — decide merge |
| `NEW: vybaveni` | sportovni-lekarske-prohlidky.md "Nejmodernější diagnostické vybavení" (InBody 770 + SECA, podtlakové EKG, Lode Excalibur Sport, spirometrie PureFlow, spiroergometrie) | section with photos placeholders; currently only 4 devices on our landing |
| `NEW: diagnostika/zakladni`, `diagnostika/komplexni`, `diagnostika/vo2max`, `diagnostika/kompenzacni-plan` | the four detail pages | live site has one page each; we have only one `diagnostika` page |
| `NEW: partneri` (or a section on `kluby`/`landing`) | home.md partners (9 cards with descriptions + links) | our landing has only a partner strip |
| `NEW: priprava-na-vysetreni` (optional) | contact.md FAQ "Příprava na zátěžový test…", "Jak se správně připravit na měření InBody?" | could be a section of `prohlidky`/`inbody` instead |

## 3. Differences from what we have

Compared: `C:\Users\Matko\sportmedical-frontend\src\site\slots\*.ts` and `C:\Users\Matko\SMClean-int\src\SportMedical.Diagnostics.Application\Catalogue\web-catalogue-2026-10-03.json`.

### 3.1 Prices that differ
| Item | Ours (catalogue) | Live | Note |
|---|---|---|---|
| VO₂max analýza | 4 000 Kč | **3 500 Kč** | live: every page (Ceník, diagnostics pages, packages sum 2 000 + 3 500 = 5 500) |
| Spiroergometrické vyšetření | 3 500 Kč | **4 000 Kč** in Ceník card / cenik-sluzeb; 3 500 Kč in Shopify product + comparison table | live is inconsistent; our 3 500 equals the Shopify product price, but then the package compare-at prices (5 200 / 6 000) in our own catalogue are inconsistent with it |

Everything else matches exactly: Základní prohlídka 1 600 · Komplexní prohlídka 2 200 · Základní diagnostika 1 200 · Komplexní diagnostika 2 000 · Kompenzační plán 1 000 · InBody základní 500 · komplexní 1 200 · výživový plán 2 500 · balíček 5 měření 2 000 (2 500) · all five packages price/compare-at (3 000/3 400, 3 600/4 200, 4 800/5 200, 5 400/6 000, 5 000/5 500).

### 3.2 "Běžně" notes (list price wording)
- All numeric list prices match the live strike-through prices. **The word "běžně" is ours**: the live site only shows a crossed-out price (and, in one extractor view, "sleva z …"). Our `publicNote` texts "(běžně 3 400 Kč)", "(běžně 5 500 Kč)" etc. do not exist on the live site; show a strike-through instead or keep the wording as our own decision.
- Names differ slightly (ours -> live): "Komplexní prohlídka + …" -> "Komplexní sportovní prohlídka + …"; "Spiroergometrie + …" -> "Spiroergometrické vyšetření + …"; "Individuální videoinstruovaný kompenzační plán" -> "Sestavení individuálního videoinstruovaného kompenzačního plánu"; "Zvýhodněný balíček 5 měření InBody (základní)" -> "Zvýhodněný Balíček 5 Měření (Základní)"; "VO₂max analýza" -> "Vo2max analýza"; the live package "Kompletní diagnostika + Spiroergometrické vyšetření" (sic "Kompletní") = our "Spiroergometrie + Komplexní diagnostika".
- Durations: ours 40 / 60 / 90 for the three exams match live (30–40, 50–60, 60–90). Our "assumed" durations of diagnostics (60/90/60/30), InBody (15/45/60/15) and packages (120–180 min) are not on the live site; the live site states "Celková délka balíčku: přibližně 60 minut, rozděleno do dvou částí" for the packages. FAQ: ergometry ≈ 45–50 min total, spiro ≈ 65–70, single diagnostic measurement 20–40 min, complex diagnostics 40–60 min, InBody ≈ 5 min.
- Group discounts: seed 4->5 %, 6->10 %, 10->15 % vs live Scale A (4–5 -> 5 %, 5–9 -> 10 %, 10+ -> 15 %) and Scale B (5–9 -> 5 %, 10+ -> 10 %); our "6" lower bound for 10 % differs from the live "5–9".

### 3.3 Texts we have that do not exist on the live site (slot defaults)
- `spolecne.ts` `site.footer.legal` and `kontakt.ts` `kontakt.billing.databox.*`: a datová schránka ID — not published live (value deliberately not repeated here). Remove (BRIEF 8).
- `cenik.ts` `cenik.note`: "Platba hotově nebo kartou na místě, klubům vystavíme fakturu." and hero lead "Ceny jsou konečné, platí se na místě. U skupin se sleva dopočítá automaticky." — live (refund policy): payment "předem online (rezervace s platbou nebo zálohou) nebo na místě dle zvoleného typu služby"; no statement about cards or invoices to clubs.
- `landing.ts`: hero headline "Výkon, který se dá změřit" and hero lead ("termín, který si vyberete online za dvě minuty", "Špičkoví lékaři"); steps "Potvrzení přijde SMS i e-mailem", "Vyplníte dotazník … přes odkaz, včetně výpisu", "Výsledky v portálu — Posudek, naměřené hodnoty i doporučení lékaře navždy u vás", "Celé objednání zvládnete za minutu"; stat "1 odkaz pro celý tým"; philosophy quote wording (live: "Naším cílem je poskytovat služby na nejvyšší možné úrovni – odborně, individuálně a s maximální precizností").
- `prohlidky.ts`: "Zdravotní dotazník a registraci vyplníte online za pár minut. Nic nemusíte tisknout." (live: PDF, "doporučujeme vytisknout předem", "přineste s sebou"); "Přijďte odpočatí, 2–3 hodiny před zátěžovým testem jen lehké jídlo, bez kávy a alkoholu" (live: 10–15 min před začátkem, nepřicházet nalačno, bez těžkých jídel 2 h před testem, bez kávy / silného čaje / energetických nápojů, bez intenzivní zátěže 24 h; alcohol is mentioned only for InBody, 24 h); "Ze zákona povinný" wording of the výpis.
- `kontakt.ts`: "Recepce v přízemí, výtahem do 5. patra", "Odpovídáme do jednoho pracovního dne", map button "Otevřít na Mapy.cz" (live: Google Maps short link), hero "Najdete nás v Michli" (own wording); "Provoz podle objednání" ✓ is live.
- `kluby.ts`: "Ozveme se do jednoho pracovního dne s cenou", the 4-step process (Poptávka -> Nabídka -> Jeden odkaz -> Výjezd) and gallery captions are our product, not live; "30+" is live ("minimálně 30 sportovců") but BRIEF 4 says no number in code.
- `dokumenty.ts`: entries "Informovaný souhlas s vyšetřením", "Jak číst výsledky InBody", "Hromadná objednávka", "Seznam sportovců — tabulka" (marked "Připravujeme"; none on live); all five real PDF URLs match the live current ones.
- `onas.ts`: values ("Odborný tým…"), "Od dětských akademií po reprezentaci", team placeholders (no team on live), photo gallery captions — all our own; the live O nás page has neither team nor values list.
- `diagnostika.ts` / `landing.ts` device naming: our cards lean on "ForceDecks" and "HumanTrak". Live uses those names only in the FAQ, the booking page and the Videoplan page; the 2026 diagnostics pages (zakladni/komplexni) speak about "silové platformy" and "video-biomechanická analýza" without brand names.
- `diagnostika.ts` card "Videoinstruovaný kompenzační plán … Platí tři měsíce" ✓ live. `inbody.ts` texts ✓ consistent with live.

### 3.4 Live pages and sections we lack
- Pages: FAQ (≈20 Q&A), Mobilní testování (as page), Podmínky služby, Zásady ochrany osobních údajů, Storno a vrácení peněz, Kontaktní údaje (billing block exists), detail pages Základní diagnostika / Komplexní diagnostika / Vo2max (Cortex21) / Kompenzační plány, Vybavení.
- Sections: comparison table of the three exams (what is included / duration / price) — our "Porovnání prohlídek" has the content but not the table of 13 rows; list of ✔/✘ include-exclude per service and package (prices.json `includes`/`excludes`); equipment descriptions (InBody 770 + SECA, vacuum ECG electrodes, Lode Excalibur Sport 10–3000 W, PureFlow spirometry, spiroergometry); legal basis lines (vyhláška č. 391/2013 Sb., zákon č. 373/2011 Sb., č. 372/2011 Sb., validity of posudek 12 months); preparation instructions (FAQ); partner club cards (9) with descriptions; "Důležité informace k objednávce balíčku" (state in the note which package and the main goal; 60 minutes; two parts); "Mobilní zátěžové testy pro sportovní kluby – NABÍDKA POUZE PRO KLUBY (vyšetření i ve Středočeském kraji)"; the booking rating line "Hodnocení 4,9 z 5" (source unknown — do not publish without Matko); "Pacientská zóna – bezpečná komunikace s lékařem" mention; compensation plan: delivery by e-mail and mobile app (iOS/Android), 3-month validity, retest recommendation; diagnostic results timing (not immediate; consultation appointment for hand-over; InBody printout immediate).

## 4. Conflicts and traps on the live site (so nobody copies them)
- Opening hours: the 8–18 / 8–18 / Ne zavřeno hours are the current ones; stale blocks (9–16 / 8–12) remain on five service pages (zakladni-, komplexni-diagnostika, vo2max-analyza, vidoeo-kompenzacne-plany, inbody).
- Legacy contact data of the previous business (Pod Krejcárkem 975/2, info@barnamedical.cz, info@sportlab-medical.cz, +420 792 314 456, sportmedical-diagnostics@seznam.cz) appears on /pages/o-nas, two legacy pages and the InBody page — never use.
- Footer link "O nás" -> /pages/o-nas (which is the "Služby" page); the real O nás is /pages/o-nas-1.
- The mobilni-testovani page repeats legacy package price ranges (3.100–3.400 … 5.900–6.400) that contradict the Ceník.
- The three Shopify product descriptions are the ergometry/spiroergometry texts; the "Základní" product shows the Komplexní ECG description; product handles ("komplexni-sportovni-prohlidka-kopie" = Základní, "zakladni-zatezovy-test-…" = Komplexní) are crossed.
- "Vo2max Analýza" card on the diagnostics hub says "Již brzy dostupné" while the service has a price and booking button.
- The privacy policy mentions "prodali" and "sdíleli" osobní údaje to marketing partners — wrong for a clinic; needs a lawyer.
- Slovak words leak into Czech texts (Zdravotní Agentúra, veľmi presné, záťaž, …) — copy-edit before reuse; the extraction keeps them as published.
