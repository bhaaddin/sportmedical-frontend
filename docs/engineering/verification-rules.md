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
