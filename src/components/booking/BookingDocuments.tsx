import { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Radio, RadioGroup,
  FormControlLabel, FormControl, FormLabel, Checkbox, Divider, Chip,
  Accordion, AccordionSummary, AccordionDetails, Grid, Alert,
} from '@mui/material';
import { ExpandMore, Edit, Delete } from '@mui/icons-material';

/* ── Age (Czech law: under 18 = guardian required) ── */
export function computeAge(birthDate: string): number {
  if (!birthDate) return -1;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return -1;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

/* ── Disease checklists (from the official questionnaire) ── */
export const DISEASE_GROUPS: { title: string; items: string[] }[] = [
  { title: 'Infekční onemocnění', items: ['Mononukleóza', 'Infekční žloutenka', 'Spála', 'Opakované angíny', 'Zarděnky', 'COVID-19', 'Zánět mozkových blan', 'Plané neštovice'] },
  { title: 'Kardiovaskulární onemocnění', items: ['Vrozená srdeční vada', 'Vysoký krevní tlak', 'Mdloby/závratě při námaze', 'Pocity bušení srdce', 'Pocity vynechávání rytmu', 'Bolesti na hrudi při zátěži'] },
  { title: 'Dýchací potíže', items: ['Astma', 'Astma – záchvat', 'Dušnost/sípot při zátěži', 'Kašel/stažené dýchaní po zátěži'] },
  { title: 'Neurologické stavy', items: ['Epilepsie / křečové stavy', 'Omdlévání, bezvědomí', 'Časté nebo silné bolesti hlavy'] },
  { title: 'Metabolické, endokrinní a jiné', items: ['Cukrovka (diabetes)', 'Poruchy štítné žlázy'] },
];

export const FAMILY_DISEASES = [
  'Rakovina', 'Cukrovka (diabetes)', 'Chudokrevnost (anémie)', 'Onemocnění krve',
  'Srdeční onemocnění', 'Infarkt myokardu', 'Vysoký krevní tlak', 'Onemocnění ledvin', 'Cévní mozková příhoda',
];

export type YesNo = 'ano' | 'ne';

export interface HealthAnswers {
  sport: { hlavniSport: string; klub: string; trener: string; treninkyTydne: string; hodinTydne: string; uroven: string };
  praktik: string; praktikObor: string;
  lekar: YesNo; lekarObor: string;
  prohlidka: YesNo; prohlidkaKde: string;
  zakazSportu: YesNo; zakazProc: string;
  hospitalizace: YesNo; hospitalizaceDuvod: string;
  leky: YesNo; lekyJake: string;
  doplnky: YesNo; doplnkyJake: string;
  operace: YesNo; operaceDetail: string;
  zlomenina: YesNo; zlomeninaDetail: string;
  hlava: YesNo; hlavaDetail: string;
  alergie: YesNo; alergieDetail: string;
  ekzem: YesNo; kozePoZatezi: YesNo;
  gynMenstruaceOd: string; gynBolestiva: YesNo; gynPotize: YesNo; gynCyklus: YesNo; gynAntikoncepce: YesNo;
  nemoci: Record<string, YesNo>;
  rodinaClenove: { vztah: string; vek: string; pricina: string }[];
  rodinaNemoci: Record<string, { vyskyt: YesNo; clen: string }>;
  prohlaseni: boolean;
}

export function emptyHealthAnswers(): HealthAnswers {
  const nemoci: Record<string, YesNo> = {};
  DISEASE_GROUPS.forEach(g => g.items.forEach(i => { nemoci[i] = 'ne'; }));
  const rodinaNemoci: Record<string, { vyskyt: YesNo; clen: string }> = {};
  FAMILY_DISEASES.forEach(n => { rodinaNemoci[n] = { vyskyt: 'ne', clen: '' }; });
  return {
    sport: { hlavniSport: '', klub: '', trener: '', treninkyTydne: '', hodinTydne: '', uroven: '' },
    praktik: '', praktikObor: '',
    lekar: 'ne', lekarObor: '',
    prohlidka: 'ne', prohlidkaKde: '',
    zakazSportu: 'ne', zakazProc: '',
    hospitalizace: 'ne', hospitalizaceDuvod: '',
    leky: 'ne', lekyJake: '',
    doplnky: 'ne', doplnkyJake: '',
    operace: 'ne', operaceDetail: '',
    zlomenina: 'ne', zlomeninaDetail: '',
    hlava: 'ne', hlavaDetail: '',
    alergie: 'ne', alergieDetail: '',
    ekzem: 'ne', kozePoZatezi: 'ne',
    gynMenstruaceOd: '', gynBolestiva: 'ne', gynPotize: 'ne', gynCyklus: 'ne', gynAntikoncepce: 'ne',
    nemoci, rodinaClenove: [
      { vztah: 'Matka', vek: '', pricina: '' },
      { vztah: 'Otec', vek: '', pricina: '' },
      { vztah: 'Bratr', vek: '', pricina: '' },
      { vztah: 'Sestra', vek: '', pricina: '' },
    ],
    rodinaNemoci, prohlaseni: false,
  };
}

export function isHealthComplete(a: HealthAnswers): boolean {
  return a.prohlaseni === true;
}

export interface GuardianData {
  adresa: string;
  zastupceJmeno: string;
  zastupceTelefon: string;
  zastupceEmail: string;
  vztah: 'otec' | 'matka' | 'jiny' | '';
  vztahJiny: string;
  souhlasVykon: boolean;
  souhlasRizika: boolean;
  souhlasZdrav: boolean;
  souhlasOsetreni: boolean;
  souhlasOdvolani: boolean;
}

export function emptyGuardian(): GuardianData {
  return {
    adresa: '', zastupceJmeno: '', zastupceTelefon: '', zastupceEmail: '',
    vztah: '', vztahJiny: '',
    souhlasVykon: false, souhlasRizika: false, souhlasZdrav: false,
    souhlasOsetreni: false, souhlasOdvolani: false,
  };
}

export function isGuardianComplete(g: GuardianData): boolean {
  return g.zastupceJmeno.trim().length >= 2
    && g.zastupceTelefon.trim().length >= 9
    && /.+@.+\..+/.test(g.zastupceEmail)
    && (g.vztah === 'otec' || g.vztah === 'matka' || (g.vztah === 'jiny' && g.vztahJiny.trim().length > 0))
    && g.souhlasVykon && g.souhlasRizika && g.souhlasZdrav && g.souhlasOsetreni && g.souhlasOdvolani;
}

/* ── Real GDPR text (from the clinic form) ── */
export const GDPR_SHORT = `Správce: SportMedical Diagnostics s.r.o., Jihlavská 1558/21, Praha 4, IČO: 23351632, recepce@sportmedical-diagnostics.cz. Účel: vedení zdravotnické dokumentace, diagnostika, kontakt ohledně termínů a výsledků, archivace dle zákona. Rozsah: identifikační a kontaktní údaje, zdravotní anamnéza, výsledky vyšetření. Doba: zdravotnická dokumentace 10 let od poslední služby, kontaktní údaje do odvolání (max. 5 let). Práva: přístup, oprava, výmaz, omezení, odvolání souhlasu e-mailem, stížnost u ÚOOÚ. Právní základ: zákon č. 372/2011 Sb., smlouva, oprávněný zájem a souhlas.`;

/* ── Yes/No row with conditional detail ── */
export function YesNoRow({ label, value, onChange, detail, detailValue, onDetail, detailLabel = 'Upřesněte:' }: {
  label: string; value: YesNo; onChange: (v: YesNo) => void;
  detail?: boolean; detailValue?: string; onDetail?: (v: string) => void; detailLabel?: string;
}) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 200 }}>{label}</Typography>
        <RadioGroup row value={value} onChange={e => onChange(e.target.value as YesNo)}>
          <FormControlLabel value="ano" control={<Radio size="small" color="warning" />} label="Ano" />
          <FormControlLabel value="ne" control={<Radio size="small" color="success" />} label="Ne" />
        </RadioGroup>
      </Box>
      {detail && value === 'ano' && (
        <TextField fullWidth size="small" label={detailLabel} value={detailValue ?? ''}
          onChange={e => onDetail?.(e.target.value)} sx={{ mt: 1 }} />
      )}
    </Box>
  );
}

/* ── Signature pad (draw with mouse/finger) ── */
export function SignaturePad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(!!value);

  useEffect(() => {
    if (value && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const c = canvasRef.current!;
        c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      };
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const t = 'touches' in e ? e.touches[0] : null;
    const x = ((t ? t.clientX : (e as React.MouseEvent).clientX) - r.left) * (c.width / r.width);
    const y = ((t ? t.clientY : (e as React.MouseEvent).clientY) - r.top) * (c.height / r.height);
    return { x, y };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    drawing.current = true;
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0D7377';
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL('image/png'));
  };
  const clear = () => {
    const c = canvasRef.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false);
    onChange('');
  };

  return (
    <Box>
      <Box sx={{ border: hasDrawn ? '2px solid #0D7377' : '2px dashed #ccc', borderRadius: 2, bgcolor: '#fafafa', touchAction: 'none' }}>
        <canvas
          ref={canvasRef} width={600} height={160} style={{ width: '100%', height: 130, cursor: 'crosshair', display: 'block' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {hasDrawn ? 'Podepsáno' : 'Podepište myší nebo prstem'}
        </Typography>
        {hasDrawn && <Button size="small" startIcon={<Delete />} onClick={clear}>Smazat</Button>}
      </Box>
    </Box>
  );
}

/* ── Full health questionnaire (fast: everything defaults to "ne") ── */
export function HealthQuestionnaire({ answers, onChange, showGyn }: {
  answers: HealthAnswers; onChange: (a: HealthAnswers) => void; showGyn: boolean;
}) {
  const set = (patch: Partial<HealthAnswers>) => onChange({ ...answers, ...patch });
  const setSport = (patch: Partial<HealthAnswers['sport']>) => set({ sport: { ...answers.sport, ...patch } });
  const setNemoc = (item: string, v: YesNo) => set({ nemoci: { ...answers.nemoci, [item]: v } });

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Zdravotní dotazník ke sportovní lékařské prohlídce. Vše je předvyplněno na „Ne" — změňte jen to, co platí.
      </Alert>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}><Typography sx={{ fontWeight: 700 }}>1. Identifikační a sportovní údaje</Typography></AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth size="small" label="Hlavní sport" value={answers.sport.hlavniSport} onChange={e => setSport({ hlavniSport: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth size="small" label="Sportovní klub" value={answers.sport.klub} onChange={e => setSport({ klub: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth size="small" label="Jméno trenéra" value={answers.sport.trener} onChange={e => setSport({ trener: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth size="small" label="Tréninků týdně" value={answers.sport.treninkyTydne} onChange={e => setSport({ treninkyTydne: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth size="small" label="Hodin týdně" value={answers.sport.hodinTydne} onChange={e => setSport({ hodinTydne: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ fontSize: 13 }}>Soutěžní úroveň</FormLabel>
                <RadioGroup row value={answers.sport.uroven} onChange={e => setSport({ uroven: e.target.value })}>
                  <FormControlLabel value="rekreacni" control={<Radio size="small" />} label="Rekreační" />
                  <FormControlLabel value="amaterska" control={<Radio size="small" />} label="Amatérská" />
                  <FormControlLabel value="profesionalni" control={<Radio size="small" />} label="Profesionální" />
                </RadioGroup>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Praktický lékař (jméno)" value={answers.praktik} onChange={e => set({ praktik: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Kód pojišťovny" value={answers.praktikObor} onChange={e => set({ praktikObor: e.target.value })} />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}><Typography sx={{ fontWeight: 700 }}>2. Osobní anamnéza</Typography></AccordionSummary>
        <AccordionDetails>
          <YesNoRow label="Navštěvujete pravidelně odborného lékaře / jste dlouhodobě sledován?" value={answers.lekar} onChange={v => set({ lekar: v })} detail detailValue={answers.lekarObor} onDetail={v => set({ lekarObor: v })} detailLabel="Obor (nutné přinést lékařskou zprávu):" />
          <YesNoRow label="Absolvoval jste sportovní lékařskou prohlídku?" value={answers.prohlidka} onChange={v => set({ prohlidka: v })} detail detailValue={answers.prohlidkaKde} onDetail={v => set({ prohlidkaKde: v })} detailLabel="Kde a kdy:" />
          <YesNoRow label="Byl vám zakázán sport ze zdravotních důvodů?" value={answers.zakazSportu} onChange={v => set({ zakazSportu: v })} detail detailValue={answers.zakazProc} onDetail={v => set({ zakazProc: v })} detailLabel="Kdy a proč:" />
          <YesNoRow label="Byl jste hospitalizován?" value={answers.hospitalizace} onChange={v => set({ hospitalizace: v })} detail detailValue={answers.hospitalizaceDuvod} onDetail={v => set({ hospitalizaceDuvod: v })} detailLabel="Důvod:" />
          <YesNoRow label="Užíváte léky (na předpis i volně prodejné)?" value={answers.leky} onChange={v => set({ leky: v })} detail detailValue={answers.lekyJake} onDetail={v => set({ lekyJake: v })} detailLabel="Jaké:" />
          <YesNoRow label="Doplňky stravy, vitamíny, přípravky na výkon?" value={answers.doplnky} onChange={v => set({ doplnky: v })} detail detailValue={answers.doplnkyJake} onDetail={v => set({ doplnkyJake: v })} detailLabel="Jaké:" />
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}><Typography sx={{ fontWeight: 700 }}>3. Operace a úrazy</Typography></AccordionSummary>
        <AccordionDetails>
          <YesNoRow label="Chirurgický zákrok / operace?" value={answers.operace} onChange={v => set({ operace: v })} detail detailValue={answers.operaceDetail} onDetail={v => set({ operaceDetail: v })} detailLabel="Typ a rok:" />
          <YesNoRow label="Zlomenina nebo vykloubení?" value={answers.zlomenina} onChange={v => set({ zlomenina: v })} detail detailValue={answers.zlomeninaDetail} onDetail={v => set({ zlomeninaDetail: v })} detailLabel="Část těla, rok:" />
          <YesNoRow label="Úraz hlavy / otřes mozku?" value={answers.hlava} onChange={v => set({ hlava: v })} detail detailValue={answers.hlavaDetail} onDetail={v => set({ hlavaDetail: v })} detailLabel="Kdy, okolnosti:" />
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}><Typography sx={{ fontWeight: 700 }}>4. Alergie a kůže</Typography></AccordionSummary>
        <AccordionDetails>
          <YesNoRow label="Alergie na léky, potraviny, jiné látky?" value={answers.alergie} onChange={v => set({ alergie: v })} detail detailValue={answers.alergieDetail} onDetail={v => set({ alergieDetail: v })} detailLabel="Specifikujte:" />
          <YesNoRow label="Ekzém, vyrážka, svědění, puchýře?" value={answers.ekzem} onChange={v => set({ ekzem: v })} />
          <YesNoRow label="Kožní reakce po fyzické zátěži?" value={answers.kozePoZatezi} onChange={v => set({ kozePoZatezi: v })} />
        </AccordionDetails>
      </Accordion>

      {showGyn && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography sx={{ fontWeight: 700 }}>5. Gynekologická anamnéza</Typography></AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2} sx={{ mb: 1 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth size="small" label="Menstruace od (věk)" value={answers.gynMenstruaceOd} onChange={e => set({ gynMenstruaceOd: e.target.value })} />
              </Grid>
            </Grid>
            <YesNoRow label="Bolestivá menstruace?" value={answers.gynBolestiva} onChange={v => set({ gynBolestiva: v })} />
            <YesNoRow label="Gynekologické potíže / operace?" value={answers.gynPotize} onChange={v => set({ gynPotize: v })} />
            <YesNoRow label="Pravidelný cyklus?" value={answers.gynCyklus} onChange={v => set({ gynCyklus: v })} />
            <YesNoRow label="Hormonální antikoncepce?" value={answers.gynAntikoncepce} onChange={v => set({ gynAntikoncepce: v })} />
          </AccordionDetails>
        </Accordion>
      )}

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}><Typography sx={{ fontWeight: 700 }}>6. Onemocnění (ano/ne)</Typography></AccordionSummary>
        <AccordionDetails>
          {DISEASE_GROUPS.map(g => (
            <Box key={g.title} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{g.title}</Typography>
              <Grid container spacing={0.5}>
                {g.items.map(item => (
                  <Grid size={{ xs: 12, sm: 6 }} key={item}>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      px: 1.5, py: 0.5, borderRadius: 2,
                      bgcolor: answers.nemoci[item] === 'ano' ? '#fff3e0' : 'transparent',
                      border: answers.nemoci[item] === 'ano' ? '1px solid #ED6C02' : '1px solid transparent',
                    }}>
                      <Typography variant="body2">{item}</Typography>
                      <RadioGroup row value={answers.nemoci[item] ?? 'ne'} onChange={e => setNemoc(item, e.target.value as YesNo)} sx={{ ml: 1 }}>
                        <FormControlLabel value="ano" control={<Radio size="small" color="warning" />} label="Ano" sx={{ mr: 1 }} />
                        <FormControlLabel value="ne" control={<Radio size="small" color="success" />} label="Ne" sx={{ mr: 0 }} />
                      </RadioGroup>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}><Typography sx={{ fontWeight: 700 }}>7. Rodinná anamnéza</Typography></AccordionSummary>
        <AccordionDetails>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Onemocnění v rodině</Typography>
          {FAMILY_DISEASES.map(n => {
            const r = answers.rodinaNemoci[n] ?? { vyskyt: 'ne' as YesNo, clen: '' };
            return (
              <Box key={n} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ minWidth: 220, flex: 1 }}>{n}</Typography>
                <RadioGroup row value={r.vyskyt} onChange={e => set({
                  rodinaNemoci: { ...answers.rodinaNemoci, [n]: { ...r, vyskyt: e.target.value as YesNo } },
                })}>
                  <FormControlLabel value="ano" control={<Radio size="small" color="warning" />} label="Ano" sx={{ mr: 1 }} />
                  <FormControlLabel value="ne" control={<Radio size="small" color="success" />} label="Ne" sx={{ mr: 1 }} />
                </RadioGroup>
                {r.vyskyt === 'ano' && (
                  <TextField size="small" label="Kdo (matka/otec/bratr/sestra)" value={r.clen}
                    onChange={e => set({ rodinaNemoci: { ...answers.rodinaNemoci, [n]: { ...r, clen: e.target.value } } })}
                    sx={{ minWidth: 200 }} />
                )}
              </Box>
            );
          })}
        </AccordionDetails>
      </Accordion>

      <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: '#fafafa' }}>
        <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.7 }}>
          Údaje slouží výhradně pro posouzení zdravotní způsobilosti ke sportovní činnosti, zpracovávány dle GDPR a zákona č. 372/2011 Sb.
          Prohlašuji, že všechny informace jsou pravdivé a úplné a jsem si vědom/a důsledků nepravdivých údajů i rizik sportovní zátěže.
        </Typography>
        <FormControlLabel
          control={<Checkbox checked={answers.prohlaseni} onChange={e => set({ prohlaseni: e.target.checked })} color="primary" />}
          label="Potvrzuji pravdivost údajů a souhlasím se zpracováním pro účely prohlídky"
        />
      </Paper>
    </Box>
  );
}

/* ── Guardian consent (under 18, Czech law) ── */
const GUARDIAN_ITEMS = [
  { key: 'souhlasVykon', label: 'Souhlasím s provedením zátěžového testu u mého dítěte pod odborným dohledem' },
  { key: 'souhlasRizika', label: 'Byl jsem informován o povaze, účelu a rizicích (únava, dušnost, kolaps)' },
  { key: 'souhlasZdrav', label: 'Dítě je aktuálně bez příznaků akutního onemocnění' },
  { key: 'souhlasOsetreni', label: 'Souhlasím s poskytnutím základního ošetření při komplikacích' },
  { key: 'souhlasOdvolani', label: 'Souhlas uděluji svobodně a mohu jej kdykoli odvolat' },
] as const;

export function GuardianForm({ value, onChange, childName, childBirth }: {
  value: GuardianData; onChange: (g: GuardianData) => void;
  childName: string; childBirth: string;
}) {
  const set = (patch: Partial<GuardianData>) => onChange({ ...value, ...patch });
  return (
    <Paper sx={{ borderRadius: 3, p: 3, border: '2px solid #ED6C02' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Souhlas zákonného zástupce
        </Typography>
        <Chip label="nezletilý pacient" size="small" color="warning" />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pacient je mladší 18 let — dle zákona č. 372/2011 Sb. musí souhlas udělit rodič / zákonný zástupce.
        Dítě: <strong>{childName}</strong> ({childBirth})
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth size="small" label="Adresa bydliště dítěte" value={value.adresa} onChange={e => set({ adresa: e.target.value })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField fullWidth required size="small" label="Jméno zákonného zástupce" value={value.zastupceJmeno} onChange={e => set({ zastupceJmeno: e.target.value })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Vztah:</Typography>
            <RadioGroup row value={value.vztah} onChange={e => set({ vztah: e.target.value as GuardianData['vztah'] })}>
              <FormControlLabel value="otec" control={<Radio size="small" />} label="Otec" />
              <FormControlLabel value="matka" control={<Radio size="small" />} label="Matka" />
              <FormControlLabel value="jiny" control={<Radio size="small" />} label="Jiný" />
            </RadioGroup>
            {value.vztah === 'jiny' && (
              <TextField size="small" label="Jaký" value={value.vztahJiny} onChange={e => set({ vztahJiny: e.target.value })} sx={{ width: 140 }} />
            )}
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField fullWidth required size="small" label="Telefon zástupce" value={value.zastupceTelefon} onChange={e => set({ zastupceTelefon: e.target.value })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField fullWidth required size="small" label="E-mail zástupce" value={value.zastupceEmail} onChange={e => set({ zastupceEmail: e.target.value })} />
        </Grid>
      </Grid>
      <Divider sx={{ my: 1 }} />
      {GUARDIAN_ITEMS.map(item => (
        <FormControlLabel
          key={item.key}
          control={<Checkbox checked={value[item.key]} onChange={e => set({ [item.key]: e.target.checked } as Partial<GuardianData>)} color="primary" />}
          label={<Typography variant="body2">{item.label}</Typography>}
          sx={{ display: 'flex', mb: 0.5 }}
        />
      ))}
    </Paper>
  );
}

/* ── Read-only view for the doctor (patient profile) ── */
export function BookingDocumentView({ data }: { data: any }) {
  if (!data) return <Alert severity="info">K této rezervaci nejsou uložené dokumenty.</Alert>;
  const yesItems: string[] = [];
  const h = data.healthQuestionnaire;
  if (h) {
    const push = (label: string, v: YesNo, detail?: string) => {
      if (v === 'ano') yesItems.push(detail ? `${label} (${detail})` : label);
    };
    push('Odborný lékař', h.lekar, h.lekarObor);
    push('Sportovní prohlídka v minulosti', h.prohlidka, h.prohlidkaKde);
    push('Zákaz sportu', h.zakazSportu, h.zakazProc);
    push('Hospitalizace', h.hospitalizace, h.hospitalizaceDuvod);
    push('Léky', h.leky, h.lekyJake);
    push('Doplňky', h.doplnky, h.doplnkyJake);
    push('Operace', h.operace, h.operaceDetail);
    push('Zlomenina/vykloubení', h.zlomenina, h.zlomeninaDetail);
    push('Úraz hlavy', h.hlava, h.hlavaDetail);
    push('Alergie', h.alergie, h.alergieDetail);
    push('Ekzém', h.ekzem);
    push('Kožní reakce po zátěži', h.kozePoZatezi);
    Object.entries(h.nemoci ?? {}).forEach(([k, v]) => { if (v === 'ano') yesItems.push(k); });
    Object.entries(h.rodinaNemoci ?? {}).forEach(([k, v]: [string, any]) => {
      if (v?.vyskyt === 'ano') yesItems.push(`Rodina: ${k}${v.clen ? ` (${v.clen})` : ''}`);
    });
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} sx={{ mb: 1 }}>
          Zdravotní dotazník {data.signedAt ? `— podepsáno ${new Date(data.signedAt).toLocaleDateString('cs-CZ')}` : ''}
        </Typography>
        {h?.sport?.hlavniSport && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            Sport: <strong>{h.sport.hlavniSport}</strong>
            {h.sport.klub ? ` · ${h.sport.klub}` : ''}{h.sport.trener ? ` · trenér ${h.sport.trener}` : ''}
            {h.sport.uroven ? ` · ${h.sport.uroven}` : ''}
          </Typography>
        )}
        {yesItems.length === 0 ? (
          <Alert severity="success">Bez pozitivních nálezů (vše „ne").</Alert>
        ) : (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {yesItems.map((t, i) => <Chip key={i} size="small" label={t} color="warning" variant="outlined" />)}
          </Box>
        )}
        {h?.prohlaseni && <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 1 }}>✓ Prohlášení o pravdivosti potvrzeno</Typography>}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>GDPR souhlas</Typography>
        <Typography variant="body2" color={data.gdprConsented ? 'success.main' : 'error.main'}>
          {data.gdprConsented ? '✓ Udělen' : '✗ Chybí'}
        </Typography>
        {data.isFirstVisit && (
          <Typography variant="body2" color={data.vypisConfirmed ? 'success.main' : 'error.main'}>
            Výpis ze dokumentace: {data.vypisConfirmed ? '✓ Potvrzen' : '✗ Chybí'}
          </Typography>
        )}
      </Paper>

      {data.guardian && (
        <Paper variant="outlined" sx={{ p: 2, borderColor: '#ED6C02' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} sx={{ mb: 1 }}>
            Zákonný zástupce: {data.guardian.zastupceJmeno}
          </Typography>
          <Typography variant="body2">
            Vztah: {data.guardian.vztah === 'jiny' ? data.guardian.vztahJiny : data.guardian.vztah} ·
            Tel: {data.guardian.zastupceTelefon} · {data.guardian.zastupceEmail}
          </Typography>
          <Typography variant="caption" color="success.main">✓ Všechny souhlasy uděleny</Typography>
        </Paper>
      )}

      {data.signature && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} sx={{ mb: 1 }}>
            <Edit sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Podpis
          </Typography>
          <Box component="img" src={data.signature} alt="Podpis" sx={{ maxWidth: 300, border: '1px solid #eee', borderRadius: 1, bgcolor: '#fafafa' }} />
        </Paper>
      )}
    </Box>
  );
}
