/* ══════════════════════════════════════════════════════════════
   MOJE VÝSLEDKY  (patient portal tab — artboard V-Vysledky)

   The latest measurement as tiles, the training zones and the facts of the
   measurement (date, protocol type, device), then every measurement in a table
   (a card each on a phone). Everything is a column the API sends: a value the
   session does not carry reads "—", there are no charts of data that does not
   exist, and the doctor's notes are never shown.
   ══════════════════════════════════════════════════════════════ */

import { Box, Typography } from '@mui/material';
import type { PortalResult } from '../../../api/patientPortal';
import { useDevice } from '../../../layout/useDevice';
import { ARCHIVO, BRAND } from '../../../components/public/brand';
import { FieldLabel, LABEL_COLOR, Panel, PanelTitle } from '../../../components/public/kit';
import { MISSING, measurementCountText, toMeasurements } from './resultsModel';
import type { Measurement } from './resultsModel';

/** One number with its label and unit. */
export function MeasureTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const missing = value === MISSING;
  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: '14px 16px', bgcolor: BRAND.page, border: `1px solid ${BRAND.line}`, borderRadius: '12px', minWidth: 0 }}
    >
      <FieldLabel>{label}</FieldLabel>
      <Typography
        component="span"
        aria-label={missing ? `${label}: není k dispozici` : undefined}
        sx={{ fontFamily: ARCHIVO, fontWeight: 800, fontSize: 30, lineHeight: 1.1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: missing ? '#9A9185' : BRAND.text }}
      >
        {value}
      </Typography>
      {unit !== undefined && <Typography component="span" sx={{ fontSize: 13, color: LABEL_COLOR }}>{unit}</Typography>}
    </Box>
  );
}

export const tileGrid = {
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))',
} as const;

/** The tiles of one measurement. */
export function MeasurementTiles({ m, compact = false }: { m: Measurement; compact?: boolean }) {
  return (
    <Box sx={tileGrid}>
      <MeasureTile label="VO₂max" value={m.vo2Max} unit="ml/kg/min" />
      {!compact && <MeasureTile label="Maximální tep" value={m.maxHeartRate} unit="tepů/min" />}
      {!compact && <MeasureTile label="Tep na prahu" value={m.thresholdHeartRate} unit="tepů/min" />}
      {!compact && <MeasureTile label="Práh v % VO₂max" value={m.thresholdPercent} unit="%" />}
      {!compact && <MeasureTile label="Maximální výkon" value={m.maxPower} unit="W" />}
      {!compact && <MeasureTile label="Výkon na kg" value={m.powerPerKg} unit="W/kg" />}
      <MeasureTile label="Klidový tep" value={m.restingHeartRate} unit="tepů/min" />
      <MeasureTile label="Tělesný tuk" value={m.bodyFat} unit="%" />
      {!compact && <MeasureTile label="Svalová hmota" value={m.muscleMass} unit="kg" />}
      {!compact && <MeasureTile label="Krevní tlak" value={m.bloodPressure} unit="mmHg" />}
      {!compact && <MeasureTile label="Hmotnost" value={m.weight} unit="kg" />}
    </Box>
  );
}

function ZonesList({ m }: { m: Measurement }) {
  if (m.zones.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <FieldLabel>Tréninkové zóny z tohoto měření</FieldLabel>
      <Box component="ul" aria-label="Tréninkové zóny" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column' }}>
        {m.zones.map((zone, index) => (
          <Box
            component="li"
            key={`${zone.name}-${index}`}
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, minHeight: 44, alignItems: 'center', borderTop: index === 0 ? 'none' : `1px solid ${BRAND.line}`, fontSize: 15 }}
          >
            <span>
              {zone.name}
              {zone.note !== '' && <Box component="span" sx={{ display: 'block', fontSize: 13, color: LABEL_COLOR }}>{zone.note}</Box>}
            </span>
            <Box component="span" sx={{ color: LABEL_COLOR, fontVariantNumeric: 'tabular-nums' }}>{zone.range === '' ? MISSING : zone.range}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ExtraFacts({ m }: { m: Measurement }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <FieldLabel>Údaje o měření</FieldLabel>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', columnGap: 2, rowGap: 1 }}>
        {m.extras.map(([label, value], index) => (
          <Box key={`${label}-${index}`} sx={{ display: 'contents' }}>
            <Box component="dt" sx={{ fontSize: 14, color: LABEL_COLOR }}>{label}</Box>
            <Box component="dd" sx={{ m: 0, fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

const withUnit = (value: string, unit: string) => (value === MISSING ? MISSING : `${value} ${unit}`);

function AllMeasurements({ list }: { list: Measurement[] }) {
  const device = useDevice();
  if (device === 'phone') {
    return (
      <Box component="ul" aria-label="Všechna měření" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {list.map((m) => (
          <Box component="li" key={m.id} sx={{ p: '14px 16px', border: `1px solid ${BRAND.line}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{m.date}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1, fontSize: 14 }}>
              <span>VO₂max: <b>{m.vo2Max}</b></span>
              <span>Max. tep: <b>{m.maxHeartRate}</b></span>
              <span>Tep na prahu: <b>{m.thresholdHeartRate}</b></span>
              <span>Práh v % VO₂max: <b>{m.thresholdPercent}</b></span>
              <span>Max. výkon: <b>{withUnit(m.maxPower, 'W')}</b></span>
              <span>Výkon na kg: <b>{withUnit(m.powerPerKg, 'W/kg')}</b></span>
              <span>Tuk: <b>{withUnit(m.bodyFat, '%')}</b></span>
              <span>Hmotnost: <b>{withUnit(m.weight, 'kg')}</b></span>
            </Box>
          </Box>
        ))}
      </Box>
    );
  }
  const cell = { py: '13px', px: 1.5, fontSize: 15, borderTop: `1px solid ${BRAND.line}`, fontVariantNumeric: 'tabular-nums' } as const;
  const head = { py: 1.25, px: 1.5, textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: LABEL_COLOR } as const;
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box component="table" aria-label="Všechna měření" sx={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Datum', 'VO₂max', 'Max. tep', 'Tep na prahu', 'Práh % VO₂max', 'Max. výkon', 'W/kg', 'Tuk', 'Hmotnost'].map((h) => (
              <Box component="th" scope="col" key={h} sx={head}>{h}</Box>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((m) => (
            <tr key={m.id}>
              <Box component="td" sx={{ ...cell, fontWeight: 600 }}>{m.date}</Box>
              <Box component="td" sx={cell}>{m.vo2Max}</Box>
              <Box component="td" sx={cell}>{m.maxHeartRate}</Box>
              <Box component="td" sx={cell}>{m.thresholdHeartRate}</Box>
              <Box component="td" sx={cell}>{m.thresholdPercent}</Box>
              <Box component="td" sx={cell}>{withUnit(m.maxPower, 'W')}</Box>
              <Box component="td" sx={cell}>{m.powerPerKg}</Box>
              <Box component="td" sx={cell}>{withUnit(m.bodyFat, '%')}</Box>
              <Box component="td" sx={cell}>{withUnit(m.weight, 'kg')}</Box>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

export default function ResultsView({ results }: { results: PortalResult[] | undefined }) {
  const list = toMeasurements(results);
  const [latest] = list;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }} data-testid="results-view">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography component="h1" sx={{ m: 0, fontFamily: ARCHIVO, fontWeight: 800, fontSize: 'clamp(27px, 3.2vw, 36px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          Moje výsledky
        </Typography>
        <Typography sx={{ fontSize: 16, color: '#5C6067' }}>{measurementCountText(list.length)}</Typography>
      </Box>

      {latest === undefined ? (
        <Panel>
          <PanelTitle>Zatím žádná měření</PanelTitle>
          <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
            Jakmile lékař měření zapíše, objeví se tady.
          </Typography>
        </Panel>
      ) : (
        <>
          <Panel labelledBy="latest-measurement">
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'baseline', justifyContent: 'space-between' }}>
              <PanelTitle id="latest-measurement">Poslední měření</PanelTitle>
              <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
                {latest.date}{latest.practitioner !== null ? ` · ${latest.practitioner}` : ''}
              </Typography>
            </Box>
            <MeasurementTiles m={latest} />
            <ZonesList m={latest} />
            <ExtraFacts m={latest} />
          </Panel>

          <Panel labelledBy="all-measurements">
            <PanelTitle id="all-measurements">Všechna měření</PanelTitle>
            <AllMeasurements list={list} />
          </Panel>
        </>
      )}
    </Box>
  );
}
