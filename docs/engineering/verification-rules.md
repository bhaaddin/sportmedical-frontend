# Zelená, ktorá nič neoverila, je chyba

Pravidlo repozitára. Platí pre všetky pruhy; toto je jeho kópia pre frontend,
ktorý má vlastný repozitár. V backendovom repozitári je v `AGENTS.md`.

## Pravidlo

**a) Kontrola alebo meranie, ktoré nenašlo čo overovať, musí ZLYHAŤ, nie prejsť.**
Nula nájdených položiek, prázdna vzorka, preskočený krok — to je „neoverené",
nie „v poriadku". Nikdy z toho nesmie vyjsť súhlas s nevratnou operáciou.

**b) Test, ktorý si podstrčí fake tam, kde ide o záruku, tú záruku neoveruje.**
Autorizácia, sieťové volania, ukladanie — proti skutočnej veci. Fake je
legitímny na logiku, nikdy na záruku.

**c) Merná úloha musí povedať, čo NEoverila.**

**d) Nedeterministické zlyhanie sa neuznáva ako „výkyv".** Zopakuj to dosť
veľakrát, aby si vedel, či je to náhoda alebo príčina.

## Prečo vzniklo

Ten istý problém sa ukázal za jeden deň trikrát: pätnásť zelených testov
s fake-mi nad endpointom, ktorý v aplikácii vracal `403` každému; skript, ktorý
pri nulovom náleze vydal zelenú pre nevratné zmazanie 26 tabuliek, hoci
neskontroloval žiadnu databázu; a meranie rýchlosti, ktoré preskočilo drahú časť
výpočtu a vydalo pekné číslo za nespravenú prácu.

## Ako to vyzerá v tomto repozitári

### Prehltnutý pád, ktorý sa tvári ako úspech

`src/api/billing.ts` mal v `batchVerify` a `batchSubmit` presne toto:

```ts
} catch {
  // Fallback: simulate success
  return { succeededIds: claimIds, failedIds: [], errors: {} };
}
```

Endpoint na backende zanikol. Volanie by vrátilo `404`, `catch` ho prehltol
a nahlásil úspech, takže rollback vo volajúcom sa nespustil a používateľ videl
všetky faktúry ako „Odesláno" — hoci sa neodoslalo nič a nikde nebola chyba.
Vo fakturácii je to tichá lož, nie výpadok.

Odstránené. Volajúci už rollback aj chybovú hlášku mal, len sa k nim nikdy
nedostal.

### Prázdna odpoveď na nepoloženú otázku

Dátumový parameter, ktorý sa neposlal, sa na backende naviazal na 1. 1. roku 1,
ambulancia bola v ten deň zavretá a odpoveď bola `200` s prázdnym poľom —
**nerozoznateľná od plného diára.** Backend to odvtedy odmieta ako `400`.

Na frontende z toho plynie: `src/api/appointments.ts` si povinné dátumy overuje
sám ešte pred odoslaním, a prázdny kalendár po `200` sa zobrazuje ako prázdny
kalendár, kým `400` sa zobrazuje ako chyba požiadavky. Nikdy jedno namiesto
druhého.

### Kontrola napísaná z toho istého predpokladu ako kód

`isLate` v `src/utils/time.ts` porovnával stav termínu s `'Booked'`, ktorý
v kontrakte nikdy nebol. Kontrola to nechytila, lebo bola napísaná s tou istou
zlou konštantou — **overovala samu seba.**

Z toho plynie doplnok, ktorý má aj kontrakt v časti 7.5:

> Kontrola sa nepíše z toho istého predpokladu ako kód, ktorý overuje.
> Očakávané hodnoty ber z kontraktu, nie z kódu, ktorý testuješ.
> A keď kontrakt hodnotu neuvádza, kontrola sa nepíše — uvedie sa otázka.

### Meranie prečítané zo súboru, ktorý medzitým prepísal niekto iný

Výstup typechecku písaný do `/tmp` prepísala iná relácia bežiaca na tom istom
stroji a porovnanie „predtým verzus teraz" potom porovnávalo dva rôzne nástroje.
Medzivýstupy patria do vlastného priečinka relácie, nie do zdieľaného `/tmp`.

## Čo to znamená pre CI

`.github/workflows/ci.yml` má `npm run typecheck` ako krok, ktorý zhadzuje job.
`npm run build` je holé `vite build` a **netypuje** — zelený build sám o sebe
nič neoveruje a nesmie sa za overenie vydávať.

---

# Zmazaná funkcia nikdy nenechá tichú medzeru

Druhé pravidlo repozitára. Schválil ho vlastník 9. 9. 2026, platí pre všetky
pruhy a v backendovom repozitári je v `AGENTS.md` vedľa toho vyššie.

## Pravidlo

> Zmazaná funkcia dostane buď náhradu, alebo výslovnú poznámku, kam sa
> presunula či kedy príde. **Nikdy tichú medzeru.**

## Prečo

Toto je to isté pravidlo ako „zelená, ktorá nič neoverila", len obrátené
k používateľovi namiesto k nástroju. Prázdne miesto na obrazovke je tvrdenie:
hovorí *„tu nič nie je"*. Keď funkcia zmizne bez slova, obsluha si to tvrdenie
prečíta ako údaj o pacientovi, nie ako stav vývoja — a nemá ako to rozlíšiť.

Zmiznutá karta „Dokumenty z online rezervace" nevyzerá ako odstránená funkcia.
Vyzerá ako pacient, ktorý žiadne dokumenty nemá.

## Aký tvar sa žiada

**Náhrada, keď funkcia niekam odišla.** V správe pracovníkov zmizla väzba
pracovník → služba. Na jej mieste je veta, ktorá povie kam:

> Nastavuje se u pracovní doby kalendáře — na každý den se přiřazuje pracovník,
> takže rozvrh a to, kdo službu provádí, jsou na jednom místě a nemohou se
> rozejít.

Admin, ktorý to nastavenie hľadá, sa dozvie kam ísť, namiesto aby hľadal pole,
ktoré tam už nie je.

**Poznámka, keď funkcia ešte len príde.** Na detaile pacienta zmizli dokumenty
z online objednania, lebo online objednávanie je fáza 2. Na ich mieste stojí, že
je to fáza 2 a čo to znamená — nie prázdno.

## Kedy sa pravidlo neuplatňuje

Na funkciu, ktorá tam **nikdy nebola**. Keď kontrakt výslovne hovorí nerobiť na
niečo miesto — ako `PODKLADY ✓ / ⚠` v 4.6 — miesto sa nerobí a poznámka sa
nepíše. Pravidlo je o tom, čo používateľ stratil, nie o zozname všetkého, čo by
raz mohlo byť.

Dôvod patrí do kódu, aby ho ďalší čitateľ našiel: `DayOverviewPage.tsx` má
v hlavičke napísané, prečo tam tá riadka nie je.
