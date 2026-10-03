/* ══════════════════════════════════════════════════════════════
   FIRMA A FAKTURY  (route: /nastaveni/firma-a-faktury)

   The data printed at the top of every invoice and the way it is paid:
   legalName, ico, dic, address, city, postalCode, bankAccount, iban, dataBox,
   phone, email and invoiceDueDays.

     GET/PUT /api/v1/settings/company      (contract C3)

   Checked here before the round trip - IČO has eight digits, PSČ has its
   shape, an IBAN has to pass its checksum - and the server's own refusals sit
   under the field they name. On the right, the invoice header as it will print;
   the QR payment appears on the PDF only when the bank account is set.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { Alert, Box, Button, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { COMPANY_SETTINGS_QUERY_KEY, companySettingsApi, type CompanySettings } from '../../api/companySettings';
import { useDevice, useIsPhone } from '../../layout/useDevice';
import { SoftCard, StatusChip } from '../../components/ui';
import { TYPE, settingsLine } from '../../components/settings/settingsStyle';
import { SettingsAsideCard, SettingsScreen } from './SettingsFrame';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

type Draft = Record<keyof Omit<CompanySettings, 'invoiceDueDays'>, string> & { invoiceDueDays: string };
type Field = keyof Draft;

const toDraft = (s: CompanySettings): Draft => ({ ...s, invoiceDueDays: s.invoiceDueDays === 0 ? '' : String(s.invoiceDueDays) });

/* ── Checks ── */

/** Whole IBAN mod 97 == 1, the way ISO 13616 says it; letters count as 10-35. */
export function isValidIban(text: string): boolean {
  const iban = text.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const ch of digits) rest = (rest * 10 + Number(ch)) % 97;
  return rest === 1;
}

const CZ_ACCOUNT = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/;
export const isValidBankAccount = (text: string): boolean => CZ_ACCOUNT.test(text.replace(/\s/g, ''));

/** The Czech IBAN of "prefix-number/bank", or null when the account is not in that shape. */
export function ibanFromBankAccount(text: string): string | null {
  const m = CZ_ACCOUNT.exec(text.replace(/\s/g, ''));
  if (m === null) return null;
  const bban = `${m[3]}${(m[1] ?? '').padStart(6, '0')}${m[2].padStart(10, '0')}`;
  let rest = 0;
  for (const ch of `${bban}123500`) rest = (rest * 10 + Number(ch)) % 97;
  return `CZ${String(98 - rest).padStart(2, '0')}${bban}`;
}

const spacedIban = (iban: string): string => iban.replace(/\s/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
const normalizePostal = (text: string): string => {
  const digits = text.replace(/\s/g, '');
  return /^\d{5}$/.test(digits) ? `${digits.slice(0, 3)} ${digits.slice(3)}` : text.trim();
};

export function validateCompany(d: Draft): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {};
  if (d.legalName.trim() === '') e.legalName = 'Název firmy je na faktuře povinný.';
  if (!/^\d{8}$/.test(d.ico.replace(/\s/g, ''))) e.ico = 'IČO má osm číslic.';
  if (d.dic.trim() !== '' && !/^[A-Za-z]{2}[0-9A-Za-z]{2,12}$/.test(d.dic.replace(/\s/g, ''))) e.dic = 'DIČ začíná dvěma písmeny země, např. CZ12345678.';
  if (d.address.trim() === '') e.address = 'Zadejte ulici a číslo.';
  if (d.city.trim() === '') e.city = 'Zadejte obec.';
  if (!/^\d{3}\s?\d{2}$/.test(d.postalCode.trim())) e.postalCode = 'PSČ má pět číslic, např. 252 65.';
  if (d.bankAccount.trim() !== '' && !isValidBankAccount(d.bankAccount)) e.bankAccount = 'Číslo účtu ve tvaru [předčíslí-]číslo/kód banky, např. 123456789/0800.';
  if (d.iban.trim() !== '' && !isValidIban(d.iban)) e.iban = 'IBAN nemá správný kontrolní součet. Zkontrolujte ho.';
  if (d.dataBox.trim() !== '' && !/^[0-9A-Za-z]{7}$/.test(d.dataBox.trim())) e.dataBox = 'ID datové schránky má sedm znaků.';
  if (d.phone.trim() !== '' && !/^\+?[\d\s]{9,18}$/.test(d.phone.trim())) e.phone = 'Telefon zadejte s předvolbou, např. +420 606 785 271.';
  if (d.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = 'E-mail nemá správný tvar.';
  const days = /^\d+$/.test(d.invoiceDueDays.trim()) ? Number(d.invoiceDueDays) : null;
  if (days === null || days < 1 || days > 365) e.invoiceDueDays = 'Splatnost je celý počet dní od 1 do 365.';
  return e;
}

function toPayload(d: Draft): CompanySettings {
  return {
    legalName: d.legalName.trim(),
    ico: d.ico.replace(/\s/g, ''),
    dic: d.dic.replace(/\s/g, '').toUpperCase(),
    address: d.address.trim(),
    city: d.city.trim(),
    postalCode: normalizePostal(d.postalCode),
    bankAccount: d.bankAccount.replace(/\s/g, ''),
    iban: d.iban.replace(/\s/g, '').toUpperCase(),
    dataBox: d.dataBox.trim(),
    phone: d.phone.trim(),
    email: d.email.trim(),
    invoiceDueDays: Number(d.invoiceDueDays),
  };
}

const serverFieldError = (errors: Record<string, string>, field: Field): string | undefined =>
  errors[field] ?? errors[field.charAt(0).toUpperCase() + field.slice(1)];

/* ── The header as it prints ── */

function InvoiceHeaderPreview({ d }: { d: Draft }) {
  const line = (text: string, placeholder: string) => (
    <Typography sx={text.trim() === '' ? [TYPE.caption, { fontStyle: 'italic' }] : TYPE.caption}>{text.trim() === '' ? placeholder : text}</Typography>
  );
  const place = [d.postalCode.trim(), d.city.trim()].filter((p) => p !== '').join(' ');
  const ids = [d.ico.trim() !== '' ? `IČO ${d.ico.trim()}` : '', d.dic.trim() !== '' ? `DIČ ${d.dic.trim()}` : ''].filter((p) => p !== '').join(' · ');
  const contact = [d.phone.trim(), d.email.trim()].filter((p) => p !== '').join(' · ');
  const qr = d.bankAccount.trim() !== '';
  return (
    <Stack spacing={1.25}>
      <Box sx={{ border: '1px solid', borderColor: settingsLine, borderRadius: 2, p: 2 }}>
        <Typography sx={[TYPE.itemName, { mb: 0.5 }]}>{d.legalName.trim() === '' ? 'Název firmy' : d.legalName.trim()}</Typography>
        {line(d.address, 'Ulice a číslo')}
        {line(place, 'PSČ a obec')}
        {line(ids, 'IČO, DIČ')}
        {line(contact, 'Telefon, e-mail')}
        {d.dataBox.trim() !== '' && line(`Datová schránka ${d.dataBox.trim()}`, '')}
        <Box sx={{ mt: 1.25, pt: 1.25, borderTop: '1px solid', borderColor: settingsLine }}>
          {line(d.bankAccount.trim() === '' ? '' : `Účet ${d.bankAccount.trim()}`, 'Bankovní účet není vyplněný')}
          {d.iban.trim() !== '' && line(`IBAN ${spacedIban(d.iban)}`, '')}
          {line(/^\d+$/.test(d.invoiceDueDays.trim()) ? `Splatnost ${d.invoiceDueDays.trim()} dní` : '', 'Splatnost nezadaná')}
        </Box>
      </Box>
      <Box>
        <StatusChip tone={qr ? 'green' : 'beige'} dot>{qr ? 'QR platba na faktuře' : 'QR platba se nezobrazí'}</StatusChip>
        <Typography sx={[TYPE.caption, { mt: 0.75 }]}>QR platba se na PDF faktury objeví jen tehdy, když je vyplněný bankovní účet.</Typography>
      </Box>
    </Stack>
  );
}

export default function CompanyInvoiceSettingsPage() {
  const queryClient = useQueryClient();
  const device = useDevice();
  const phone = useIsPhone();

  const query = useQuery({ queryKey: COMPANY_SETTINGS_QUERY_KEY, queryFn: companySettingsApi.get, retry: false });
  const saved = query.data;

  const [edits, setEdits] = useState<Draft | null>(null);
  const draft: Draft | null = edits ?? (saved !== undefined ? toDraft(saved) : null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const save = useMutation({
    mutationFn: (settings: CompanySettings) => companySettingsApi.put(settings),
    onSuccess: (next) => {
      queryClient.setQueryData(COMPANY_SETTINGS_QUERY_KEY, next);
      setEdits(null);
      setServerErrors({});
      setFailure(null);
      setAttempted(false);
      toast.success('Údaje o firmě uloženy');
    },
    onError: (error) => {
      setServerErrors(fieldErrorsOf(error));
      setFailure(problemMessageOf(error, 'Údaje se nepodařilo uložit. Zkuste to prosím znovu.'));
    },
  });

  const dirty = saved !== undefined && edits !== null && JSON.stringify(edits) !== JSON.stringify(toDraft(saved));
  const clientErrors = draft === null ? {} : validateCompany(draft);
  const valid = Object.keys(clientErrors).length === 0;

  const submit = () => {
    setAttempted(true);
    if (draft === null || !valid) return;
    save.mutate(toPayload(draft));
  };
  const discard = () => { setEdits(null); setServerErrors({}); setFailure(null); setAttempted(false); };

  const edit = (field: Field, value: string) => {
    if (draft === null) return;
    setEdits({ ...draft, [field]: value });
    setServerErrors((e) => ({ ...e, [field]: '', [field.charAt(0).toUpperCase() + field.slice(1)]: '' }));
  };

  const fieldError = (field: Field): string | undefined => {
    const server = serverFieldError(serverErrors, field);
    if (server) return server;
    return attempted || dirty ? clientErrors[field] : undefined;
  };

  const preview = draft === null ? null : <InvoiceHeaderPreview d={draft} />;
  const twoCols = phone ? '1fr' : 'repeat(2, minmax(0, 1fr))';

  const input = (
    field: Field,
    label: string,
    help: string,
    opts: { full?: boolean; inputMode?: 'numeric' | 'tel' | 'email' | 'text'; end?: string; required?: boolean } = {},
  ) => (
    <TextField
      key={field}
      label={label}
      value={draft === null ? '' : draft[field]}
      onChange={(e) => edit(field, e.target.value)}
      error={fieldError(field) !== undefined}
      helperText={fieldError(field) ?? help}
      size={phone ? 'medium' : 'small'}
      fullWidth
      sx={opts.full === true && !phone ? { gridColumn: '1 / -1' } : undefined}
      slotProps={{
        htmlInput: { inputMode: opts.inputMode ?? 'text', 'aria-required': opts.required === true ? true : undefined },
        input: opts.end !== undefined ? { endAdornment: <InputAdornment position="end">{opts.end}</InputAdornment> } : undefined,
      }}
    />
  );

  const card = (id: string, title: string, caption: string, children: React.ReactNode) => (
    <SoftCard component="section" aria-labelledby={id}>
      <Typography id={id} component="h2" sx={TYPE.sectionTitle}>{title}</Typography>
      <Typography sx={[TYPE.caption, { mt: 0.5, mb: 2 }]}>{caption}</Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: twoCols, alignItems: 'start' }}>{children}</Box>
    </SoftCard>
  );

  const canDeriveIban = draft !== null && ibanFromBankAccount(draft.bankAccount) !== null;

  return (
    <SettingsScreen
      title="Firma a faktury"
      subtitle="Údaje, které se tisknou v hlavičce každé faktury, a způsob placení."
      scope="company"
      save={{ dirty, saving: save.isPending, onSave: submit, onDiscard: discard }}
      loading={draft === null && !query.isError}
      error={query.isError ? 'Údaje o firmě se nepodařilo načíst.' : undefined}
      onRetry={() => void query.refetch()}
      aside={device === 'desktop' && preview !== null ? preview : undefined}
      asideTitle="Náhled hlavičky faktury"
    >
      {draft === null ? null : (
        <Stack spacing={2.5}>
          {failure !== null && <Alert severity="error">{failure}</Alert>}

          {card('firma-firma', 'Firma', 'Jak se firma jmenuje a jak ji úřady vedou.', <>
            {input('legalName', 'Obchodní název', 'Celý název včetně právní formy.', { full: true, required: true })}
            {input('ico', 'IČO', 'Osm číslic.', { inputMode: 'numeric', required: true })}
            {input('dic', 'DIČ', 'Vyplňte, je-li firma plátce DPH.')}
          </>)}

          {card('firma-sidlo', 'Sídlo', 'Adresa, která se tiskne jako adresa dodavatele.', <>
            {input('address', 'Ulice a číslo', 'Např. Krátká 283.', { full: true, required: true })}
            {input('city', 'Obec', 'Název obce.', { required: true })}
            {input('postalCode', 'PSČ', 'Pět číslic.', { inputMode: 'numeric', required: true })}
          </>)}

          {card('firma-kontakt', 'Kontakt', 'Kam se odběratel s dotazem na fakturu obrátí.', <>
            {input('phone', 'Telefon', 'S předvolbou, např. +420 …', { inputMode: 'tel' })}
            {input('email', 'E-mail', 'Adresa recepce nebo účtárny.', { inputMode: 'email' })}
            {input('dataBox', 'Datová schránka', 'Sedmimístné ID; nechte prázdné, nemá-li ji firma.')}
          </>)}

          {card('firma-platba', 'Platba', 'Kam odběratel platí a do kdy.', <>
            {input('bankAccount', 'Bankovní účet', 'Ve tvaru číslo/kód banky. Podle něj se na faktuře vytvoří QR platba.', { inputMode: 'text' })}
            <Stack spacing={1}>
              {input('iban', 'IBAN', 'Mezinárodní číslo účtu; kontroluje se kontrolní součet.')}
              <Button
                variant="outlined"
                color="inherit"
                disabled={!canDeriveIban}
                onClick={() => {
                  const iban = ibanFromBankAccount(draft.bankAccount);
                  if (iban !== null) edit('iban', spacedIban(iban));
                }}
                sx={{ minHeight: 44, alignSelf: 'flex-start', fontWeight: 600 }}
              >
                Spočítat IBAN z čísla účtu
              </Button>
            </Stack>
            {input('invoiceDueDays', 'Splatnost faktur', 'Kolik dní po vystavení je faktura splatná.', { inputMode: 'numeric', end: 'dní', required: true })}
          </>)}

          {device !== 'desktop' && preview !== null && (
            <SettingsAsideCard title="Náhled hlavičky faktury">{preview}</SettingsAsideCard>
          )}
        </Stack>
      )}
    </SettingsScreen>
  );
}
