# Responsive audit: staff pages, before and after

Viewports: 820x1180, 768x1024, 360x640, 390x844, 430x932, 834x1112, 1024x1366, 1024x768, 1180x820, 1366x1024, 1280x720, 1366x768, 1440x900, 1536x864, 1920x1080, 2560x1440, 3440x1440, 1440x900@0.8, 1440x900@1.25, 1920x1080@0.8, 1920x1080@1.25. Codes: OVF sideways overflow, SCR the document scrolls, REG page taller than its region (>= 768), DEAD one-sided/large empty side, GUT equal gutters > 12 % (centred page on an ultrawide), NARROW content < 85 % of the room, TCH touch target < 44 px, COV last row behind the bottom bar, CLP clipped text, TBL phone table scrolls sideways, OVL overlapping text, INT content under the rail, ERR page did not load.

Rows with the failure: before {"SCR":343,"TCH":428,"OVL":22,"DEAD":206,"TBL":10,"GUT":22,"NARROW":1} of 1113; after {"GUT":17,"NARROW":25} of 1260.

| page | phone (before > after) | tablet | desktop | wide |
|---|---|---|---|---|
| /accounting-export | SCR TCH > ok | TCH > ok | ok > ok | ok > ok |
| /activities | SCR TBL TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD SCR > NARROW |
| /admin | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /audit-log | SCR TBL TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > ok |
| /availability | SCR > ok | ok > ok | ok > ok | ok > ok |
| /billing | SCR > ok | TCH > ok | ok > ok | ok > ok |
| /blokovany-cas | TCH > ok | TCH > ok | DEAD SCR > ok | DEAD > ok |
| /calendars | SCR TBL TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /cashier | SCR > ok | ok > ok | ok > ok | ok > ok |
| /diagnostics/new | OVL SCR > ok | ok > ok | GUT NARROW > ok | GUT > GUT NARROW |
| /dnes | TCH > ok | SCR TCH > ok | DEAD > ok | DEAD > ok |
| /dokumenty-sablony | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /dotaznik-nastaveni | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > ok |
| /exceptions | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /hodnoceni-pacientu | TCH > ok | TCH > ok | DEAD > ok | DEAD > ok |
| /intake-review | ok > ok | ok > ok | ok > ok | ok > ok |
| /nastaveni/barvy-sluzeb | OVL SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /nastaveni/cenik | ok > ok | ok > ok | SCR > ok | SCR > ok |
| /nastaveni/firma-a-faktury | OVL SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD SCR > NARROW |
| /nastaveni/historie-zmen | SCR TCH > ok | TCH > ok | DEAD > ok | DEAD > ok |
| /nastaveni/integrace | OVL SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /nastaveni/kluby | SCR TCH > ok | SCR TCH > ok | DEAD > ok | DEAD > NARROW |
| /nastaveni/media-a-texty | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD SCR > ok |
| /nastaveni/pripominky | OVL SCR TCH > ok | TCH > ok | ok > ok | ok > NARROW |
| /nastaveni/rychla-registrace | OVL SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /nastaveni/sablony-emailu | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /nastaveni/skupinove-slevy | ok > ok | SCR TCH > ok | ok > ok | DEAD > NARROW |
| /nastaveni/slevy | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /nastaveni/sluzby | TCH > ok | SCR TCH > ok | DEAD > ok | DEAD > ok |
| /nastaveni/souhlasy | OVL SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /nastaveni/udaje-pacienta | OVL SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /nastaveni/uloziste-medii | SCR TCH > ok | TCH > ok | DEAD > ok | DEAD > NARROW |
| /nastaveni/vzhled-kalendare | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /nastaveni/zabezpeceni | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /nepoznana-stranka-404 | ok > ok | GUT > GUT | GUT > GUT | GUT > GUT |
| /nepritomnosti | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /patients | SCR TCH > ok | TCH > ok | ok > ok | ok > ok |
| /patients/:id | ok > ok | ok > ok | ok > ok | ok > ok |
| /patients/:id/dokumenty | ok > ok | ok > ok | ok > ok | ok > ok |
| /patients/:id/edit | ok > ok | ok > ok | ok > ok | ok > ok |
| /patients/:id/faktury | ok > ok | ok > ok | ok > ok | ok > ok |
| /patients/:id/historie | ok > ok | ok > ok | ok > ok | ok > ok |
| /patients/:id/terminy | ok > ok | ok > ok | ok > ok | ok > ok |
| /patients/:id/vysledky | ok > ok | ok > ok | ok > ok | ok > ok |
| /patients/register | OVL SCR TCH > ok | DEAD OVL SCR TCH > ok | DEAD > ok | ok > ok |
| /pravidla-dokumentu | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /prehled | SCR > ok | SCR TCH > ok | SCR > ok | ok > ok |
| /prehled-sluzeb | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > ok |
| /settings | SCR > ok | SCR > ok | DEAD SCR > ok | DEAD > ok |
| /settings/dokumenty | SCR TCH > ok | TCH > ok | DEAD > ok | DEAD > ok |
| /settings/komunikace | TCH > ok | TCH > ok | DEAD > ok | DEAD > ok |
| /settings/provoz | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > ok |
| /settings/sluzby-a-ceny | SCR TCH > ok | TCH > ok | DEAD > ok | DEAD > ok |
| /settings/system | SCR TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > ok |
| /settings/vzhled-webu | TCH > ok | TCH > ok | DEAD > ok | DEAD > ok |
| /staff-management | SCR TBL TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > NARROW |
| /svatky | SCR TCH > ok | OVL SCR TCH > ok | DEAD SCR > ok | DEAD SCR > NARROW |
| /system-health | SCR TBL TCH > ok | SCR TCH > ok | DEAD > ok | DEAD > ok |
| /vyhrazeni | TCH > ok | SCR TCH > ok | DEAD SCR > ok | DEAD > ok |
| /working-hours | OVL SCR TBL TCH > ok | OVL SCR TCH > ok | DEAD SCR > ok | DEAD SCR > NARROW |
