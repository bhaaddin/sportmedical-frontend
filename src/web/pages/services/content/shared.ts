/* Wording shared by several service pages (live site: "Důležité informace k objednávce balíčku"
   of /pages/rezervacni-system, the group-discount block, the card labels). No amounts. */

export const PKG_NOTE = {
  title: 'Důležité informace k objednávce balíčku',
  paras: [
    'Při objednání prosíme uveďte do poznámky, o který konkrétní balíček služeb máte zájem a jaký je Váš hlavní cíl diagnostiky, tedy co konkrétně potřebujete v rámci vyšetření zaměřit nebo posoudit.',
  ],
  items: [
    'Celková délka balíčku: přibližně 60 minut',
    'Struktura vyšetření: rozděleno do dvou částí',
    '1. část – diagnostická: samotné provedení diagnostických vyšetření a potřebných měření',
    '2. část – výsledky: samostatný termín vyhodnocení a interpretace výsledků',
  ],
} as const;
