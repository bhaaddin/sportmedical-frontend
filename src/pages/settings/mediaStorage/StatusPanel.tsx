import { Box, Stack, Typography } from '@mui/material';
import { StatusChip } from '../../../components/ui';
import { TYPE } from '../../../components/settings/settingsStyle';
import { isMediaStorageReady, type MediaStorageSettings } from '../../../api/mediaStorageSettings';

/**
 * "Nastaveno / Nenastaveno", worked out from what is saved (switched on, a cloud name, a stored
 * secret). The contract has no endpoint that tests the connection, so this says only that the
 * values are there, not that Cloudinary accepts them - and says so.
 */
export function StatusPanel({ saved }: { saved: MediaStorageSettings }) {
  const ready = isMediaStorageReady(saved);
  const missing = [
    saved.enabled ? null : 'zapnout úložiště',
    saved.cloudName.trim() !== '' ? null : 'vyplnit cloud name',
    saved.hasSecret ? null : 'uložit API secret',
  ].filter((part): part is string => part !== null);

  return (
    <Stack spacing={2}>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
          <Typography sx={TYPE.itemName}>Stav</Typography>
          <StatusChip tone={ready ? 'green' : 'beige'} dot>{ready ? 'Nastaveno' : 'Nenastaveno'}</StatusChip>
        </Stack>
        <Typography sx={TYPE.caption}>
          {ready
            ? 'Údaje jsou vyplněné a uložené. Zda je Cloudinary přijme, se ukáže při prvním nahrání souboru.'
            : `Aby šlo nahrávat fotky a videa, je potřeba ${missing.join(', ')}.`}
        </Typography>
      </Box>
      <Box>
        <Typography sx={TYPE.itemName}>K čemu to je</Typography>
        <Typography sx={TYPE.caption}>
          Cloudinary je služba, která uchovává fotky a videa veřejného webu, zmenšuje je pro telefony a převádí video do rozumné velikosti.
          Bez ní nejde na obrazovce Média a texty nic nahrát.
        </Typography>
      </Box>
      <Box>
        <Typography sx={TYPE.itemName}>Bezpečnost</Typography>
        <Typography sx={TYPE.caption}>
          API secret se ukládá zašifrovaný a nikdy se znovu nezobrazí — ani vám. Zapomenutý secret se nezjišťuje, jen se zadá nový.
        </Typography>
      </Box>
    </Stack>
  );
}
