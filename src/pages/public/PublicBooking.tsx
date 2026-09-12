/*
 * Veřejné objednávání — fáze 2.
 *
 * Byla tu obrazovka o 555 řádcích postavená nad `/api/public/book` a nad
 * systémem veřejných typů událostí. Etapa 9 ten systém zrušila; měřeno proti
 * živému OpenAPI (316 cest) ta cesta neexistuje a jediné veřejné rozhraní v
 * tomto území je `POST /api/public/intake`, tedy registrační podání.
 *
 * Nejde o zrušenou funkci, jde o nepostavenou. Až fáze 2 přijde, obrazovka se
 * napíše proti kalendářům, které dnes existují - ne proti systému, který byl
 * smazán. Proto tu zůstává tato věta a ne prázdno: aby ji nikdo nepsal znovu s
 * dojmem, že tu nikdy nic nebylo.
 */
import { Box, Typography } from '@mui/material';

export default function PublicBooking() {
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', py: 10, px: 3, textAlign: 'center' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Objednání online zatím není spuštěné
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Termín vám rádi domluvíme telefonicky. Online objednávání připravujeme.
      </Typography>
    </Box>
  );
}
