import type { SlotDef } from '../slotTypes';
import type { TextSection } from './textPage';
import { textPageSlots } from './textPage';

/*
 * Slots of the page /ochrana-osobnich-udaju. The defaults are the live page "Zásady ochrany osobních údajů"
 * (https://sportmedical-diagnostics.cz/policies/privacy-policy, last updated 18. 1. 2026 as published,
 * captured 2026-10-03). That live text is Shopify's generic template: it is silent on health data,
 * retention periods and the Czech supervisory authority, and it contains US-style clauses about "selling"
 * and "sharing" data. It is shown as the live site shows it — NOT improved, NOTHING added — and it NEEDS
 * a legal review and a proper clinic text. The capture cut some sentences; they are left out, not
 * reconstructed. The two tables of the live page are written as lists.
 */

export const SOUKROMI_SECTIONS: readonly TextSection[] = [
  {
    id: 'uvod',
    title: 'Zásady ochrany osobních údajů',
    text: `Poslední aktualizace: 18. leden 2026

Tyto Zásady ochrany osobních údajů popisují, jak SportMedical Diagnostics s.r.o. („Stránky", „my", „nás" nebo „náš") shromažďuje, používá a zveřejňuje vaše osobní údaje, když navštívíte, používáte naše služby nebo provedete nákup na sportmedical-diagnostics.cz (dále jen „Stránky") nebo s námi jinak komunikujete ohledně Stránek (dále souhrnně „Služby").

Přečtěte si tyto Zásady ochrany osobních údajů pozorně.`,
  },
  {
    id: 'zmeny',
    title: 'Změny těchto Zásad ochrany osobních údajů',
    text: 'Revidované Zásady ochrany osobních údajů zveřejníme na Stránkách, aktualizujeme datum „Poslední aktualizace" a podnikneme veškeré další kroky požadované platnými zákony.',
  },
  {
    id: 'sber',
    title: 'Jak shromažďujeme a používáme vaše osobní údaje',
    text: `Údaje používáme pro komunikaci s vámi, poskytování služeb, dodržování právních povinností, vymáhání podmínek a ochranu Služby.

### Jaké osobní údaje shromažďujeme
- Kontaktní údaje (jméno, adresa, telefon, e-mail)
- Informace o objednávce (fakturační/doručovací adresy, potvrzení platby)
- Informace o účtu (uživatelské jméno, heslo, bezpečnostní otázky)
- Informace o zákaznické podpoře

### Údaje o používání
K tomu můžeme používat soubory cookie, pixely a podobné technologie (údaje o zařízení, prohlížeči, síťovém připojení, IP adrese a interakci se Stránkami)

### Údaje od třetích stran
Data získáváme také od poskytovatelů služeb (např. Shopify), zpracovatelů plateb a prostřednictvím online sledovacích technologií.

### Jak používáme vaše osobní údaje
- Poskytování produktů a služeb
- Marketing a reklama
- Bezpečnost a prevence podvodů
- Komunikace a zlepšování služeb`,
  },
  {
    id: 'cookies',
    title: 'Soubory cookie',
    text: `Stejně jako mnoho jiných webových stránek i my používáme na našich Stránkách soubory cookie. Konkrétní informace o souborech cookie, kterých používáme v souvislosti s provozem našeho obchodu se Shopify, najdete na https://www.shopify.com/legal/cookies. Soubory cookie používáme k provozu a zlepšování našich Stránek a našich Služeb (včetně zapamatování vašich akcí a preferencí), k provádění analýz a lepšímu porozumění uživatelské interakci se Službami (v našem oprávněném zájmu spravovat, zlepšovat a optimalizovat Služby).

Většina prohlížečů ve výchozím nastavení automaticky přijímá soubory cookie, ale pomocí ovládacích prvků můžete svůj prohlížeč nastavit tak, aby soubory cookie odstraňoval nebo odmítal. Mějte na paměti, že odstranění nebo blokování souborů cookie může negativně ovlivnit váš uživatelský zážitek a může způsobit, že některé ze Služeb, včetně určitých funkcí a obecné funkčnosti, nebudou pracovat správně nebo přestanou být dostupné. Blokování souborů cookie navíc nemusí zcela bránit tomu, jak sdílíme informace s třetími stranami, jako jsou naši reklamní partneři.`,
  },
  {
    id: 'zpristupneni',
    title: 'Jak zpřístupňujeme osobní údaje',
    text: `Za určitých okolností můžeme vaše osobní údaje zpřístupnit třetím stranám pro účely plnění smlouvy, legitimní účely a další důvody, na které se vztahují tyto Zásady ochrany osobních údajů. To může být:
- S prodejci nebo jinými třetími stranami, které provádějí služby naším jménem (např. správa IT, zpracování plateb, analýza dat, zákaznická podpora, cloudové úložiště, plnění a přeprava).
- S obchodními a marketingovými partnery k poskytování služeb a reklamy pro vás. Naši obchodní a marketingoví partneři budou používat vaše údaje v souladu se svými vlastními oznámeními o ochraně osobních údajů.
- Když nám svým souhlasem nařídíte, požádáte nás nebo jinak souhlasíte se zpřístupněním určitých údajů třetím stranám, například zasláním vašich produktů nebo prostřednictvím používání widgetů sociálních médií nebo integrací přihlášení.
- S našimi přidruženými společnostmi nebo jinak v rámci naší firemní skupiny, v našem oprávněném zájmu provozovat úspěšný podnik.
- V souvislosti s obchodní transakcí, jako je fúze nebo úpadek, ke splnění všech platných zákonných povinností (včetně reagování na předvolání, příkaz k domovní prohlídce a podobné žádosti), k vymáhání dodržování všech platných podmínek služby a ochraně nebo obraně Služby, našich práv a práv našich uživatelů nebo jiných osob.

Odhalujeme následující kategorie osobních údajů a citlivých osobních údajů o uživatelích pro účely uvedené výše v dokumentech „Jak shromažďujeme a používáme vaše osobní údaje" a „Jak zpřístupňujeme osobní údaje":
- Identifikátory, jako jsou základní kontaktní údaje a určité informace o objednávce a účtu — příjemci: prodejci a třetí strany, které provádějí služby naším jménem (jako jsou poskytovatelé internetových služeb, zpracovatelé plateb, partneři pro plnění, partneři zákaznické podpory a poskytovatelé analýzy dat)
- Komerční údaje, jako jsou informace o objednávkách, informace o nakupování a informace o zákaznické podpoře — příjemci: obchodní a marketingoví partneři
- Internet nebo jiná podobná síťová aktivita, jako jsou data o používání — příjemci: přidružené společnosti
- Geolokační údaje, jako jsou polohy určené IP adresou nebo jinými technickými opatřeními

Nepoužíváme ani nezveřejňujeme citlivé osobní údaje bez vašeho souhlasu nebo pro účely odvození vašich vlastností.

S vaším souhlasem sdílíme osobní údaje za účelem provádění reklamních a marketingových aktivit, a to následovně.

Během předchozích 12 měsíců jsme „prodali" a „sdíleli" (jak jsou tyto pojmy definovány v platných zákonech) osobní údaje za účelem zapojení do reklamních a marketingových aktivit, jak je uvedeno níže.
- Identifikátory, jako je jméno, e-mailová adresa a telefonní číslo — příjemci: obchodní a marketingoví partneři
- Komerční údaje, jako jsou záznamy o zakoupených produktech nebo službách — příjemci: obchodní a marketingoví partneři
- Data o používání — příjemci: obchodní a marketingoví partneři`,
  },
  {
    id: 'odkazy',
    title: 'Webové stránky a odkazy třetích stran',
    text: `Naše stránky mohou poskytovat odkazy na webové stránky nebo jiné online platformy provozované třetími stranami. Pokud budete následovat odkazy na stránky, které nejsou přidruženy nebo kontrolovány námi, měli byste si přečíst jejich zásady ochrany osobních údajů a zabezpečení a další smluvní podmínky. Nezaručujeme a neodpovídáme za soukromí nebo bezpečnost takových stránek, a to včetně přesnosti, úplnosti nebo spolehlivosti informací na těchto stránkách.

Naše uvedení takových odkazů samo o sobě neznamená žádnou podporu obsahu těchto platforem nebo jejich vlastníků či provozovatelů, s výjimkou případů zveřejněných na Službách.`,
  },
  {
    id: 'deti',
    title: 'Údaje o dětech',
    text: `Služby nejsou určeny pro děti a my vědomě neshromažďujeme žádné osobní údaje o dětech. Pokud jste rodičem nebo opatrovníkem dítěte, které nám poskytlo své osobní údaje, můžete nás kontaktovat pomocí následujících kontaktních údajů a požádat o jejich vymazání.

K datu účinnosti těchto Zásad ochrany osobních údajů si nejsme vědomi, že bychom „sdíleli" nebo „prodávali" (jak jsou tyto pojmy definovány v platných zákonech) osobní údaje osob mladších 16 let.`,
  },
  {
    id: 'zabezpeceni',
    title: 'Zabezpečení a uchovávání vašich údajů',
    text: `Uvědomte si, že žádná bezpečnostní opatření nejsou dokonalá či neporušitelná a nemůžeme zaručit „dokonalou bezpečnost". Navíc jakékoli údaje, které nám zašlete, nemusí být během cesty v bezpečí. Doporučujeme, abyste ke sdělování citlivých nebo důvěrných údajů nepoužívali nezabezpečené kanály.

Jak dlouho uchováváme vaše osobní údaje, závisí na různých faktorech, například na tom, zda tyto údaje potřebujeme k udržování vašeho účtu, poskytování Služeb, plnění zákonných povinností, řešení sporů nebo vymáhání jiných platných smluv a zásad.`,
  },
  {
    id: 'prava',
    title: 'Vaše práva',
    text: `V závislosti na tom, kde žijete, můžete mít některá nebo všechna následující práva ve vztahu k vašim osobním údajům. Tato práva však nejsou absolutní, mohou se uplatňovat pouze za určitých okolností a v určitých případech můžeme vaši žádost odmítnout, jak to umožňuje zákon.
- Právo vědět: Můžete mít právo vyžádat si přístup k osobním údajům, které o vás uchováváme, včetně podrobností o tom, jak vaše údaje používáme a sdílíme.
- Právo na výmaz: Můžete mít právo vyžádat si, abychom vymazali osobní údaje, které o vás uchováváme.
- Právo na opravu: Můžete mít právo vyžádat si, abychom opravili nepřesné osobní údaje, které o vás uchováváme.
- Právo na přenositelnost: Za určitých okolností a s určitými výjimkami můžete mít právo na kopii osobních údajů, které o vás uchováváme, a požádat, abychom je předali třetí straně.
- Právo odhlásit se z prodeje či sdílení nebo cílené reklamy: Můžete mít právo nařídit nám, abychom „neprodávali" ani „nesdíleli" vaše osobní údaje nebo vás odhlásit ze zpracování vašich osobních údajů pro účely považované za „cílenou reklamu", jak je definováno v platných zákonech na ochranu soukromí.
- Omezení zpracování: Můžete mít právo nás požádat, abychom zastavili nebo omezili zpracování osobních údajů.
- Odvolání souhlasu: Pokud se spoléháme na souhlas se zpracováním vašich osobních údajů, můžete mít právo tento souhlas odvolat.
- Odvolání: Pokud odmítneme zpracovat vaši žádost, můžete se proti našemu rozhodnutí odvolat. Můžete tak učinit přímou odpovědí na naše odmítnutí.
- Správa předvoleb komunikace: Můžeme vám zasílat propagační e-maily a vy se kdykoli můžete se z jejich zasílání odhlásit pomocí odhlášení zobrazeného v našich e-mailech, které vám zasíláme. Pokud se odhlásíte, můžeme vám stále zasílat nepropagační e-maily, jako jsou e-maily ohledně vašeho účtu nebo objednávek, které jste provedli.

Jakékoli z těchto práv můžete uplatnit tam, kde je to uvedeno na našich Stránkách, nebo nás můžete kontaktovat pomocí kontaktních údajů uvedených níže.

Za uplatňování kteréhokoli z těchto práv vás nebudeme diskriminovat. Možná od vás budeme potřebovat údaje k ověření totožnosti, jako je vaše e-mailová adresa nebo informace o účtu, než poskytneme věcnou odpověď na žádost. V souladu s platnými zákony můžete určit oprávněného zástupce, který bude vaším jménem podávat žádosti o výkon vašich práv. Před přijetím takové žádosti budeme od zástupce vyžadovat, aby poskytl důkaz, že jste ho zmocnili jednat vaším jménem, a možná budeme potřebovat, abyste ověřili svou totožnost přímo u nás. Na vaši žádost odpovíme včas, jak to vyžadují platné zákony.`,
  },
  {
    id: 'stiznosti',
    title: 'Stížnosti',
    text: 'Pokud máte stížnosti na to, jak zpracováváme vaše osobní údaje, kontaktujte nás pomocí níže uvedených kontaktních údajů. Pokud nejste spokojeni s naší odpovědí na vaši stížnost, v závislosti na tom, kde žijete, můžete mít právo odvolat se proti našemu rozhodnutí tím, že nás kontaktujete pomocí kontaktních údajů uvedených níže, nebo podáte stížnost místnímu úřadu pro ochranu údajů. Seznam odpovědných dozorových úřadů pro ochranu údajů v zemích EHP najdete zde.',
  },
  {
    id: 'mezinarodni',
    title: 'Mezinárodní uživatelé',
    text: `Vezměte na vědomí, že vaše osobní údaje můžeme přenášet, uchovávat a zpracovávat mimo zemi, ve které žijete. Vaše osobní údaje zpracovávají také zaměstnanci a poskytovatelé služeb a partneři třetích stran v těchto zemích.

Pokud přenášíme vaše osobní údaje mimo Evropu, budeme se spoléhat na uznávané mechanismy přenosu, jako jsou standardní smluvní doložky Evropské komise nebo jakékoli ekvivalentní smlouvy vydané příslušným orgánem Spojeného království, pokud je to relevantní, pokud se údaje nepředávají do země, která poskytuje odpovídající úroveň ochrany.`,
  },
  {
    id: 'kontakt',
    title: 'Kontakt',
    text: `Máte-li jakékoliv dotazy ohledně našich postupů v oblasti ochrany osobních údajů nebo těchto Zásad ochrany osobních údajů, případně chcete-li uplatnit některá ze svých práv, zavolejte nám na {telefon} či napište e-mail na adresu {email}, nebo nás kontaktujte na adrese {adresa}.

Pro účely platných zákonů o ochraně údajů a není-li výslovně uvedeno jinak, jsme správcem vašich osobních údajů.`,
  },
];

export const soukromiSlots: SlotDef[] = textPageSlots({
  prefix: 'soukromi',
  page: 'Ochrana osobních údajů',
  eyebrow: 'Právní informace',
  title: 'Ochrana osobních údajů',
  lead: 'Zásady ochrany osobních údajů.',
  sections: SOUKROMI_SECTIONS,
});
