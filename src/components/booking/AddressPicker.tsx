import { useMemo, useState } from 'react';
import {
  Box, Typography, TextField, MenuItem, Chip, Collapse, Paper,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';
import { TOWNS } from '../../utils/towns';

export interface AddressValue {
  region: string;
  city: string;
  psc: string;
  street: string;
  number: string;
}

const REGIONS: { name: string; prefixes: string[] }[] = [
  { name: 'Praha', prefixes: ['1'] },
  { name: 'Středočeský', prefixes: ['2'] },
  { name: 'Jihočeský', prefixes: ['37', '38', '39'] },
  { name: 'Plzeňský', prefixes: ['30', '31', '32', '33', '34', '35'] },
  { name: 'Karlovarský', prefixes: ['36'] },
  { name: 'Ústecký', prefixes: ['40', '41', '42', '43', '44', '45'] },
  { name: 'Liberecký', prefixes: ['46', '47', '48'] },
  { name: 'Královéhradecký', prefixes: ['50', '51', '52'] },
  { name: 'Pardubický', prefixes: ['53', '54', '56', '57'] },
  { name: 'Vysočina', prefixes: ['58', '59'] },
  { name: 'Jihomoravský', prefixes: ['60', '61', '62', '63', '64', '65', '66', '67'] },
  { name: 'Olomoucký', prefixes: ['75', '77', '78', '79'] },
  { name: 'Zlínský', prefixes: ['76'] },
  { name: 'Moravskoslezský', prefixes: ['70', '71', '72', '73', '74'] },
];

export function formatAddress(a: AddressValue): string {
  return [a.street && a.number ? `${a.street} ${a.number}` : a.street, a.city, a.psc]
    .filter(Boolean)
    .join(', ');
}

const stepAnim = {
  initial: { opacity: 0, x: -16, height: 0 },
  animate: { opacity: 1, x: 0, height: 'auto' as const },
  exit: { opacity: 0, x: 16, height: 0 },
};

export default function AddressPicker({ value, onChange, compact = false }: {
  value: AddressValue; onChange: (v: AddressValue) => void; compact?: boolean;
}) {
  const [cityOpen, setCityOpen] = useState(false);
  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  const regionPrefixes = REGIONS.find(r => r.name === value.region)?.prefixes ?? [];
  const townPool = useMemo(() => {
    if (regionPrefixes.length === 0) return TOWNS;
    return TOWNS.filter(t => regionPrefixes.some(p => t.pc.startsWith(p)));
  }, [value.region]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = value.city.trim().toLowerCase();
  const suggestions = q.length >= 1
    ? townPool.filter(t => t.m.toLowerCase().includes(q)).slice(0, 8)
    : [];

  const pickTown = (m: string, pc: string) => {
    set({ city: m, psc: pc });
    setCityOpen(false);
  };

  const step = !value.region ? 1 : !value.city ? 2 : !value.street ? 3 : 4;
  const StepIcon = ({ done }: { done: boolean }) =>
    done
      ? <CheckCircle sx={{ fontSize: 18, color: '#2E7D32' }} />
      : <RadioButtonUnchecked sx={{ fontSize: 18, color: '#bbb' }} />;

  return (
    <Box>
      {/* Step 1: Region */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <StepIcon done={!!value.region} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>1. Kraj</Typography>
      </Box>
      <TextField fullWidth select size={compact ? 'small' : 'medium'} label="Kraj"
        value={value.region} onChange={e => set({ region: e.target.value, city: '', psc: '' })}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
        {REGIONS.map(r => <MenuItem key={r.name} value={r.name}>{r.name}</MenuItem>)}
      </TextField>

      {/* Step 2: City */}
      <AnimatePresence>
        {step >= 2 && (
          <motion.div key="s2" {...stepAnim} transition={{ duration: 0.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <StepIcon done={!!value.city} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>2. Město / obec</Typography>
              <Typography variant="caption" color="text.secondary">
                ({townPool.length.toLocaleString('cs-CZ')} obcí)
              </Typography>
            </Box>
            <TextField fullWidth size={compact ? 'small' : 'medium'} label="Začněte psát…" value={value.city}
              onChange={e => { set({ city: e.target.value }); setCityOpen(true); }}
              onFocus={() => setCityOpen(true)}
              sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            <Collapse in={cityOpen && suggestions.length > 0}>
              <Paper variant="outlined" sx={{ mb: 2, maxHeight: 200, overflow: 'auto', borderRadius: 2 }}>
                {suggestions.map(s => (
                  <Box key={`${s.m}-${s.pc}`} onClick={() => pickTown(s.m, s.pc)}
                    sx={{
                      px: 2, py: 1, cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                      '&:hover': { bgcolor: '#E0F2F1' },
                    }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.m}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.pc}</Typography>
                  </Box>
                ))}
              </Paper>
            </Collapse>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 3: Street + number */}
      <AnimatePresence>
        {step >= 3 && (
          <motion.div key="s3" {...stepAnim} transition={{ duration: 0.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: 1 }}>
              <StepIcon done={!!value.street} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>3. Ulice a číslo</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField fullWidth size={compact ? 'small' : 'medium'} label="Ulice" value={value.street}
                onChange={e => set({ street: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              <TextField size={compact ? 'small' : 'medium'} label="Číslo" value={value.number}
                onChange={e => set({ number: e.target.value })} sx={{ width: 130, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 4: PSC confirm */}
      <AnimatePresence>
        {step >= 4 && (
          <motion.div key="s4" {...stepAnim} transition={{ duration: 0.25 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField size={compact ? 'small' : 'medium'} label="PSČ" value={value.psc}
                onChange={e => set({ psc: e.target.value.replace(/[^0-9]/g, '').slice(0, 5) })}
                sx={{ width: 140, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              {formatAddress(value) && (
                <Chip label={formatAddress(value)} color="success" variant="outlined" sx={{ fontWeight: 600 }} />
              )}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
