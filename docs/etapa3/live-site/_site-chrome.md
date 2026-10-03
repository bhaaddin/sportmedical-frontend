# Shared site chrome (header, footer, repeated blocks) — sportmedical-diagnostics.cz

Captured 2026-10-03 with WebFetch (HTML -> markdown -> model extraction). Wording is as returned by the fetch; where the fetch was lossy it is marked `[unverified]`. Every page file lists only its own main content; the blocks below repeat on (almost) every page and are NOT repeated per page.

## Header
Logo: `//sportmedical-diagnostics.cz/cdn/shop/files/transparent1_d1dc3f43-8950-484d-8ee6-88d192ecf59b.png?v=1780556256&width=600` (alt "SportMedical Diagnostics s.r.o."; footer version `&width=760`)

Navigation (main menu):
- O nás -> /pages/o-nas-1
- Služby (drop-down)
  - Sportovní lékařské prohlídky -> /pages/sportovni-lekarske-prohlidky
    - Základní sportovní prohlídka -> /pages/sportovni-lekarske-prohlidky
    - Komplexní sportovní prohlídka -> /pages/sportovni-lekarske-prohlidky
    - Spiroergometrické vyšetření -> /pages/sportovni-lekarske-prohlidky
  - Sportovní Diagnostika -> /pages/sportovni-diagnostika
    - Základní diagnostika -> /pages/zakladni-diagnostika
    - Komplexní diagnostika -> /pages/komplexni-diagnostika
    - Vo2max -> /pages/vo2max-analyza
    - Videoinstruované kompenzačné plány -> /pages/vidoeo-kompenzacne-plany
  - InBody770 -> /pages/inbody
- Ceník služeb -> /pages/cenik-sluzeb
- Rezervační systém -> /pages/rezervacni-system
- Dokumenty k testům -> /pages/dokumenty-ke-stazeni
- Kontakt -> /pages/contact
- Přihlásit se -> https://sportmedical-diagnostics.cz/customer_authentication/redirect?locale=cs&region_country=CZ  (Shopify customer login; "Košík" cart icon also present)

Announcement / hero slogans (home and several template pages):
- Komplexní zdravotní péče, prevence a rehabilitace
- Odborný lékařský tým a nejmodernější vybavení
- Pohodlná online rezervace a rychlé termíny
- Možnost realizace sportovních a diagnostických prohlídek přímo v klubu

## Footer (identical on all pages)
Heading: SportMedical Diagnostics  (logo, footer size)

Block "Adresa" / "Ordinační doba" (older footer block, only on service pages):
- Budova GreenLine(5.patro LM Clinic)
- Jihlavská 1558/21, Praha 4-Michle, 140 00
- Ordinační doba: Pondělí - Pátek: 9.00 - 16.00 hodin / Sobota: 8.00 - 12.00 hodin / Neděle: ZAVŘENO   <- NOTE: STALE, contradicts the "Kontakt" block below on the same page
- Button: Navigovat -> https://maps.app.goo.gl/F6hq4G15PjULs4yi9

Block "Kontakt":
- Provozní doba: (provoz podle objednání)
- Po–Pá: 8:00–18:00 | So: 8:00–18:00
- Ne: zavřeno
- 🖂 recepce@sportmedical-diagnostics.cz
- ✆ 606 785 271
(Some pages — sportovni-lekarske-prohlidky, home-footer in "Adresa provozovny" — show "Pondělí - Pátek: 9.00 - 18.00 hodin / Sobota: 8.00 - 18.00 hodin / Neděle: ZAVŘENO" with the "(provoz podle objednání)" prefix. The service pages zakladni-diagnostika, komplexni-diagnostika, vo2max-analyza, inbody, vidoeo-kompenzacne-plany additionally carry the stale block 9–16 / 8–12 above; sportovni-diagnostika shows the 8.00 - 18.00 hours in its "Ordinační doba" block.)

Block "Důležité sekce":
- O nás -> /pages/o-nas   (NB: this URL is a page titled "Služby", see pages/o-nas.md; the real "O nás" is /pages/o-nas-1)
- Ceník služeb -> /pages/cenik-sluzeb
- Rezervační systém -> /pages/rezervacni-system
- Informace o zpracování osobních údajů -> /policies/privacy-policy
- Povinnost předložení výpisu ze zdravotní dokumentace -> https://cdn.shopify.com/s/files/1/0913/0799/9614/files/VYPIS_ze_zdravtni_dokumentace_f3c5c6c3-600a-4449-88ec-a7dbe4961e22.pdf?v=1765967307

Block "Fakturační údaje":
- SportMedical Diagnostics s.r.o.
- Klinika sportovní medicíny a diagnostiky
- Adresa provozovny (místo poskytování zdravotních služeb): Budova GreenLine (5.patro), Jihlavská 1558/21, 140 00 Praha 4 – Michle
- Sídlo společnosti: Krátká 283, 252 65 Tursko
- IČO: 23351632

Block "Naši Partneři":
- SportMetrics Lab -> /pages/o-nas-1
- StrongGirls and Boys -> https://stronggirls.cz/
- FK Dukla Jižní Město -> https://www.fkduklajm.cz/
- Beach Klub Ládví -> https://beachklubladvi.cz/
- SK Joudrs -> https://www.joudrs.cz/
- Zdravotní Agentúra -> https://zdravotniagentura.cz/

Bottom bar:
- © 2026, SportMedical Diagnostics s.r.o. Využívá Shopify.
- Zásady ochrany osobních údajů -> /policies/privacy-policy
- Kontaktní údaje -> /policies/contact-information
- Podmínky služby -> /policies/terms-of-service
- Zásady vrácení peněz -> /policies/refund-policy
- Předvolby pro soubory cookie -> #shopifyReshowConsentBanner (Shopify cookie consent banner)

No social-media links (Facebook, Instagram, LinkedIn, ...) appear anywhere in header/footer. No Google-reviews widget except the text "Hodnocení 4,9 z 5 – Dlouhodobá důvěra našich klientů" on /pages/rezervacni-system.

## Repeated page bottom blocks (service pages)
### Kontaktní formulář
- Heading variants: "Máte jakýkoli dotaz ? Napište nám." (sportovni-lekarske-prohlidky, sportovni-diagnostika) / "Nenašli jste odpověď? Napište nám." (zakladni-/komplexni-diagnostika, vo2max, inbody, video plány)
- Subheading: Vyplňte formulář a zanechte nám zprávu. / Dejte nám vědět, s čím Vám můžeme pomoci.
- Fields: Vaše celé jméno * · Email * · Telefon * · Předmět dotazu * (select) · Váš dotaz *
- Předmět dotazu options: Sportovní lékařské prohlídky · Sportovní diagnostika · InBody 770 · Zvýhodněné kombinované balíčky · Individuální nabídky a spolupráce pro kluby a organizace · Jiný dotaz   (the InBody page variant: Zátěžové Testy · Sportovní Diagnostika · InBody · Individuální nabídky a spolupráce pro kluby a organizace · Jiný dotaz)
- Checkbox text: Odesláním formuláře beru na vědomí, že SportMedical Diagnostics s.r.o. zpracuje mé údaje výhradně k vyřízení dotazu (GDPR, čl. 6(1)(b)/(f)). Podrobnosti, doby uchování a práva subjektu údajů viz Zásady ochrany osobních údajů. (-> /policies/privacy-policy)
- Button: Odeslat dotaz

### DŮLEŽITÉ POKYNY A INFORMACE K VYŠETŘENÍ
- Důležité dokumenty a pokyny k vyšetřením -> /pages/dokumenty-ke-stazeni
- Popis a ceník služeb -> /pages/cenik-sluzeb

### REZERVAČNÍ SYSTÉM
- Rezervujte si termín vyšetření jednoduše online. Vyberte si den a čas, který Vám nejlépe vyhovuje. **Konkrétní vyšetření nebo cenově zvýhodněný balíček zvolíte v dalším kroku v rezervačním systému.**
- Buttons: "REZERVACE – SPORTOVNÍ LÉKAŘSKÉ PROHLÍDKY" -> https://obj.cgm-medistar.cz/cal/3c7bW ; "Rezervace - Sportovní Diagnostika" / "Rezervace - Základní diagnostika" / "Rezervace - Komplexní diagnostika" / "Rezervace - Vo2max Analýza" -> https://obj.cgm-medistar.cz/cal/9lNfZ

### ADRESA
- Budova GreenLine(5.patro LM Clinic)
- Jihlavská 1558/21, Praha 4-Michle, 140 00
- stanice metra - Kačerov
- recepce@sportmedical-diagnostics.cz
- 606 785 271

### Skupinové slevy — "Čím větší skupina, tím výhodnější podmínky" / "Výše slevy závisí na počtu osob. Větší skupiny = výhodnější cena za osobu."
Two CONFLICTING scales are live (see INDEX.md):
- Scale A (sportovni-lekarske-prohlidky, sportovni-diagnostika, zakladni-diagnostika, komplexni-diagnostika, inbody, mobilni-testovani): 4-5 osob −5 % / osoba · 5–9 osob −10 % / osoba · 10+ osob −15 % / osoba · Sportovní kluby/organizace speciální cenová nabídka
- Scale B (cenik-sluzeb, vo2max-analyza, vidoeo-kompenzacne-plany): 5–9 osob −5 % / osoba · 10+ osob −10 % / osoba · Sportovní kluby/organizace speciální cenová nabídka
- Icons: //sportmedical-diagnostics.cz/cdn/shop/files/13.png?v=1749452748 (4-5), 14.png?v=1749452749 (5–9), 15.png?v=1749452749 (10+ and kluby)

## Booking system (external)
- Sportovní prohlídky: https://obj.cgm-medistar.cz/cal/3c7bW
- Sportovní diagnostika, výživové poradenství, balíčky: https://obj.cgm-medistar.cz/cal/9lNfZ
(CGM MEDISTAR online objednávání — external, not Shopify.)
