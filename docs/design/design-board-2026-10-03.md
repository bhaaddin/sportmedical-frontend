# Design board 2026-10-03 — "SportMedical — 10 směrů designu"

Source: Matko's HTML board (`C:\Users\Matko\Downloads\SportMedical — 10 směrů designu.html`,
19 screens at 1440×900). Screenshots of every screen live in the session scratchpad
(`scratchpad/design/design-NN-*.jpeg`). Every value below was measured on the board.

## Tokens (`src/theme.ts` → `DESIGN`, `buildTheme`)

| token | value | where |
|---|---|---|
| font | Public Sans (fallback Inter) | everything in the staff app |
| page | `#EFF1F4` | main background |
| paper | `#FFFFFF` | sidebar, cards, dialogs |
| line | `#E2E6EA` (strong `#DCE0E5`) | every border; cards have a 1px border and **no shadow** |
| ink / muted / faint | `#1A1D21` / `#67707A` / `#B3B9C0` | text |
| table head | bg `#F4F6F7`, 11px/700 uppercase, letter-spacing .08em, muted | all tables |
| accent (default) | forest `#0D5C52`; alt slate `#2B3440` | buttons, selected states, active nav |
| soft accent | bg `#F4F8F7`, line `#C9D6D3` | active nav pill, slot summary card |
| selection | bg `#D7E9E5`, 2px line `#0D5C52`, radius 8 | drag-selected range on the grid |
| tones | green `#E2EBE4/#27603A` · beige `#FBF1E7/#8A5A2F` (line `#E7CBA9`) · red `#F5E0D8/#9B3B1B` · grey `#EFF1F4/#4A5564` | `StatusChip` |
| danger | `#9B3B1B` text, outline border `#E3C3BA` | "Zrušit termín" |
| now | `#C0392B` line + pill (white 10px/700 text, radius 4) | calendar now-line |
| hatch closed | `repeating-linear-gradient(135deg,#E4E7EB 0 7px,#F3F5F7 7px 14px)`, border `#CBD1D8`, label muted 11px/600 | Pauza, Dovolená, Zavřeno, OBĚD |
| hatch holiday | `repeating-linear-gradient(135deg,#F2DEC8 0 7px,#FBF1E7 7px 14px)`, border `#E7CBA9` | Státní svátek column (full day) |
| appointment card | bg `#EFF1F4` (checked-in/in progress `#DCE0E5`), 3px left edge `#4A5564`, radius 4, time 13px/700, name 13px, status muted 11px | grid cells |
| radius | buttons 10 · cards 12 · chips 999 · grid cells 4 | |
| button | contained: accent, white, 600, min-height 40 (sidebar one 46); outlined: white, line border, ink | |
| dialog shadow | `0 24px 60px rgba(20,24,28,.20)`; menus `0 12px 32px rgba(20,24,28,.14)` | the only shadows |

## Shell (done — `src/App.tsx`)

White 272px sidebar: brand text "SportMedical" → `/`; big "Nová objednávka" button
(navigates to `/planovani` with `location.state.newAppointment = Date.now()` — the
calendar must open the booking drawer on that); nav Kalendář · Pacienti · Kluby a týmy ·
Výsledky · Fakturace · Nastavení; "Další" collapsible with the rest; patient sections
indented under Pacienti; account/appearance menu + search + notifications at the bottom.

## Screens (what each one shows)

1. **Kalendář · Den** — top bar `‹ › [Dnes]  Pondělí 26. října 2026 … [Den|Týden|Měsíc] [Nová objednávka]`.
   Grid: one column per calendar/service with header "Základní prohlídka / 3 rezervace" (second line muted,
   may say "· odpoledne volno"); hour rows 07:00–17:00; appointment cards as above; club bookings
   "FK Slaný — 6 hráčů / Klub · −10 %"; hatched "Pauza" strip, hatched "Dovolená — [JMÉNO]" block;
   red now-line with "09:42" pill in the time gutter. Sidebar on calendar pages also carries the mini
   calendar (month, ‹ ›, P Ú S Č P S N, today = filled dark circle) and a "SLUŽBY" legend with colour squares.
2. **Týden** — columns Po–Ne with header "Po  [DNES pill]  26. 10."; today's column tinted `#EEF1F5`;
   holiday column = full-height beige hatch with "Státní svátek — zavřeno" and a beige "SVÁTEK" chip in
   the header; So/Ne closed = grey hatch "Zavřeno"; Pauza strips per day.
3. **Měsíc** — 7-column month; each cell: day number (today = dark filled circle), count on the right,
   up to 3 rows "08:00 Jan Novák" (club rows carry a count badge), "+ 3 další"; closed days say
   "ZAVŘENO" small caps; holiday cell beige with "SVÁTEK" chip and "Státní svátek".
4–6. **Zoom** — toolbar under the top bar: "ROZLIŠENÍ  [−] [Hodina|30 min|10 min] [+]" and a hint on the
   right "Krok mřížky hodina · táhněte do stran pro posun v čase"; thin side arrows ‹ › hug the grid.
   Ctrl/⌘+wheel zoom stays.
7. **Výběr slotu** — drag across empty slots draws the selection box with a time pill "10:00 – 11:00 · 60 min";
   on release a popover: title "10:00 – 11:00", "Pondělí 26. října · 60 minut volno", three actions with icons
   — "Objednat pacienta / Vyhledat nebo rychle založit", "Zablokovat čas / Pauza, dovolená, školení",
   "Rezervovat pro klub / Blok míst s odkazem pro sportovce" — and "Zrušit výběr  Esc".
   Legend under the grid: Právě vybíráte · Obsazeno · Zablokováno · Svátek · Aktuální čas.
8–11. **Objednat termín** — a right-hand drawer (~580px, white, dark scrim). Header: title + "Krok 1 ze 2 — kdo přijde",
   ×. Slot summary card (soft accent) with calendar icon, "Pondělí 26. 10. 2026 · 10:00 — 11:00 / 60 minut volno",
   "Změnit". "KDO SE OBJEDNÁVÁ": three mode cards with icons — Z databáze · Rychlá registrace · Klub (selected = accent
   2px border + soft bg). Z databáze: search field "NAJÍT PACIENTA" with "3 nalezeni", result rows (avatar initials,
   name, "nar. [ROK] · +420 …", right "Naposledy 14. 3. 2026"). Rychlá registrace: "NOVÝ PACIENT — ČTYŘI ÚDAJE":
   Jméno a příjmení, Telefon, E-mail, "Prohlídka, na kterou volal" (select with price · minutes), info box
   "Víc teď nepotřebujeme. Rodné číslo, pojišťovnu a dotazník vyplní pacient sám přes odkaz…". Klub: title
   "Hromadná rezervace pro klub", search "Název klubu nebo kontaktní osoba", club rows (initials, "62 sportovců ·
   [KONTAKT]", right "Hladina −10 %"), "NEBO ZALOŽIT NOVÝ" expandable form (název, kontaktní osoba, telefon, e-mail,
   počet sportovců). Footer: Zrušit · Pokračovat (accent). Step 2 ("co se bude dělat"): patient summary card with
   "Změnit"; "ČINNOST" radio cards (name, minutes, price right); "Zobrazit všechny činnosti z ceníku" link;
   DATUM / ČAS OD / TRVÁNÍ / ČAS DO fields; green line "Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.";
   POZNÁMKA; checkboxes "Poslat SMS s potvrzením na +420 …" and "Poslat odkaz na vyplnění vstupního dotazníku";
   footer "Celkem k úhradě 2 200 Kč" · Zrušit · Objednat termín.
12. **Rezervace · detail** — centered modal with a 3px accent left edge on the header: "09:30 — 10:00",
   "Pondělí 26. října 2026 · 30 minut", "Základní prohlídka"; chips "● Objednán" (green) "Má zpoždění" (beige), ×.
   Left: beige warning "Registrace není dokončena / Pacient zatím nevyplnil vstupní dotazník." with
   "Zkopírovat odkaz na registraci" (brown contained) + "Poslat znovu"; patient card (initials, name,
   "+420 … · email", icon buttons phone / mail / open); CENA 1 600 Kč · PLATBA Nezaplaceno (brown) · ZDROJ Web;
   POZNÁMKA textarea; HISTORIE bullet list. Right rail: PŘÍCHOD "Přišel" (dark contained) / "Nepřišel" (outlined);
   TERMÍN "Upravit" / "Přesunout"; "Zrušit termín" (red outlined). Footer "Zavřít".
13. **Rezervace · úprava** — same modal: ‹ back, "Úprava rezervace", "Bohumil Komárek · Po 26. 10. 2026, 09:30";
   SLUŽBA as toggle pills; "Změna služby přepíše délku i cenu podle ceníku."; DATUM / ZAČÁTEK / DÉLKA / STAV;
   info line "Nový termín 09:30 — 10:00 je volný. Nekoliduje s žádnou rezervací."; POZNÁMKA; checkbox
   "Poslat pacientovi potvrzení o změně"; footer: Zrušit termín (left, red outlined) · Zahodit změny · Uložit změny.
14. **Pacienti** — PageHeader "Pacienti / Kartotéka kliniky · 1 284 záznamů" + "Nový pacient"; search
   "Jméno, příjmení, telefon nebo e-mail" + FilterChips Všichni · S termínem · Chybí dotazník · Nepřišli;
   table PACIENT (accent link) · NAROZENÍ · TELEFON · POSLEDNÍ NÁVŠTĚVA · PŘÍŠTÍ TERMÍN · STAV (chips:
   Dotazník chybí beige, Kompletní green, Nepřišel 2× red, Nový pacient accent); footer "Zobrazeno 6 z 1 284 pacientů"
   · Předchozí · Další.
15. **Pacient — karta** — PageHeader "Bohumil Komárek / Karta pacienta" + "Zpět na seznam"; header card: avatar,
   name, "nar. [ROK] · +420 … · email", chips "Dotazník chybí" "Aktivní", buttons "Objednat termín" (accent)
   "Upravit kartu"; tabs Přehled · Termíny · Výsledky · Faktury · Dokumenty; left: OSOBNÍ ÚDAJE (RODNÉ ČÍSLO,
   POJIŠŤOVNA, ADRESA, SPORT, REGISTROVÁN, ZDROJ as label/value pairs), HISTORIE NÁVŠTĚV table (date · service ·
   price · Zaplaceno/Nezaplaceno chip); right: PŘÍŠTÍ TERMÍN card ("Po 26. 10. · 10:00", service · min · price,
   Otevřít / Přesunout), UPOZORNĚNÍ card (beige box + "Poslat odkaz").
16. **Kluby a týmy** — PageHeader + "Nový klub"; search + FilterChips Všechny · S aktivní rezervací · Bez objednávky;
   card grid: name + chip (Aktivní rezervace green / Bez objednávky grey / Dokončeno), "[KONTAKT] · +420 …",
   big numbers "62 sportovců" "−10 % sleva".
17. **Klub — rezervace + odkaz** — PageHeader "FK Slaný / Hromadná rezervace 26.—27. října 2026" + "Zpět na kluby";
   card REGISTRAČNÍ ODKAZ PRO SPORTOVCE: monospace link box + "Kopírovat" (accent) + "Poslat klubu";
   "Obsazeno 4 z 12 míst" progress bar + "8 volných"; note "Odkaz platí do …"; card REZERVOVANÁ MÍSTA table
   SPORTOVEC · ČINNOST · TERMÍN · STAV (Registrován green / Chybí dotazník beige / Čeká na sportovce grey,
   empty rows "— / volné místo"); right rail KLUB (label/value pairs) and OBJEDNÁVKA ("12 míst · Komplexní
   prohlídka · 26.—27. 10. 2026", big "23 760 Kč", "12 × 2 200 Kč se slevou 10 %", "Přidat místa", "Vystavit fakturu").
18. **Fakturace** — PageHeader "Fakturace / Doklady, platby a přehled tržeb" + "Nový doklad"; four KpiCards
   (VYFAKTUROVÁNO V ŘÍJNU · NEZAPLACENO (red) · HOTOVĚ NA MÍSTĚ · PRŮMĚR NA PACIENTA); search + FilterChips
   Vše · Nezaplacené · Po splatnosti · Kluby; table ČÍSLO · ODBĚRATEL · POLOŽKY · DATUM · ČÁSTKA · STAV.
19. **Nastavení** — three panes: sidebar · a 240px settings nav with a search box "Hledat v nastavení" and
   groups PROVOZ (Otevírací doba, Pauzy a přestávky, Svátky a dovolené, Kalendář a mřížka) · SLUŽBY A CENY
   (Činnosti, Ceník, Délky a kapacity, Slevy a cenové hladiny) · KLUBY (Hromadné objednávky, Registrační odkazy) ·
   KOMUNIKACE (SMS a e-maily, Připomínky) — active row has a 3px accent left bar and accent text; content:
   breadcrumb "Nastavení / Služby a ceny / Slevy a cenové hladiny", title + subtitle, "Zahodit" · "Uložit";
   editor table (NÁZEV HLADINY · OD · DO · SLEVA · AKCE with "Odebrat" red text buttons, "+ Přidat hladinu"
   dashed), explanation card "JAK SE SLEVA POUŽIJE" with links "Otevřít ceník" "Kluby", preview card NÁHLED
   (12 × Komplexní 26 400 Kč / Velká skupina −10 % −2 640 Kč / Celkem 23 760 Kč).

## Rules for every screen

- Use the kit (`src/components/ui`) and `DESIGN` tokens; no new hex colours in pages, no shadows, no gradients.
- Czech, the board's wording. Labels in small caps over values. Money as "2 200 Kč".
- Nothing hard-coded that the clinic can change: prices, names, hours, colours come from the API/settings.
- Keep every existing behaviour, test and route; typecheck + the touched tests must be green.
