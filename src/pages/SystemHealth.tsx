/* ══════════════════════════════════════════════════════════════
   ZDRAVÍ SYSTÉMU
   Every number on this screen was measured by the server a moment
   ago: database, schema, e-mail queue, SMTP, documents storage,
   the build and its start time, signed-in sessions, latest failed
   operations. A part whose call failed says so; nothing stands in
   for a value that could not be read. Refreshes itself every 30 s.
   ══════════════════════════════════════════════════════════════ */
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Card, CardContent, Chip, Grid, IconButton, Skeleton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import {
  CheckCircle, ErrorOutlined, Info, MonitorHeart, People, Refresh, Warning,
} from '@mui/icons-material';
import {
  databaseState, formatAge, formatBytes, outboxState, smtpState, storageState, systemHealthApi,
  type HealthStatus, type SystemHealth as SystemHealthDto,
} from '../api/systemHealth';

const REFRESH_MS = 30_000;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('cs-CZ');
}

const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: 'V pořádku',
  warning: 'Vyžaduje pozornost',
  error: 'Chyba',
};

const STATUS_COLOR: Record<HealthStatus, 'success' | 'warning' | 'error'> = {
  ok: 'success',
  warning: 'warning',
  error: 'error',
};

function StatusChip({ status }: { status: HealthStatus }) {
  const Icon = status === 'ok' ? CheckCircle : status === 'warning' ? Warning : ErrorOutlined;
  return (
    <Chip
      size="small"
      color={STATUS_COLOR[status]}
      icon={<Icon fontSize="small" />}
      label={STATUS_LABEL[status]}
      data-testid={`status-${status}`}
    />
  );
}

interface FactProps {
  label: string;
  value: ReactNode;
  help: string;
}

/** One measured value with its Czech label and one sentence saying what it means. */
function Fact({ label, value, help }: FactProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Tooltip title={help}>
          <Info sx={{ fontSize: 16, color: 'text.disabled' }} />
        </Tooltip>
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>{value}</Typography>
    </Box>
  );
}

interface SectionProps {
  title: string;
  status: HealthStatus;
  summary: string;
  children: ReactNode;
}

function Section({ title, status, summary, children }: SectionProps) {
  return (
    <Grid size={{ xs: 12, md: 6 }}>
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
            <StatusChip status={status} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{summary}</Typography>
          {children}
        </CardContent>
      </Card>
    </Grid>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function SystemHealth() {
  const health = useQuery({
    queryKey: ['system', 'health'],
    queryFn: systemHealthApi.health,
    refetchInterval: REFRESH_MS,
  });
  const sessions = useQuery({
    queryKey: ['system', 'sessions'],
    queryFn: systemHealthApi.sessions,
    refetchInterval: REFRESH_MS,
  });
  const errors = useQuery({
    queryKey: ['system', 'errors'],
    queryFn: systemHealthApi.errors,
    refetchInterval: REFRESH_MS,
  });

  const refreshing = health.isFetching || sessions.isFetching || errors.isFetching;
  const refreshAll = () => {
    void health.refetch();
    void sessions.refetch();
    void errors.refetch();
  };

  const h: SystemHealthDto | undefined = health.data;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <MonitorHeart color="primary" /> Zdraví systému
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {h
              ? `Změřeno ${formatDateTime(h.timestamp)} · obnovuje se každých 30 s`
              : 'Databáze, e-mailová fronta, úložiště dokumentů, verze a přihlášení — vše změřené právě teď'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {h && (
            <Chip
              color={STATUS_COLOR[h.status]}
              label={`Celkově: ${STATUS_LABEL[h.status]}`}
              sx={{ fontWeight: 700 }}
              data-testid="overall-status"
            />
          )}
          <Tooltip title="Změřit znovu">
            <span>
              <IconButton onClick={refreshAll} disabled={refreshing} aria-label="Změřit znovu">
                <Refresh />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {health.isPending && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid key={i} size={{ xs: 12, md: 6 }}>
              <Skeleton variant="rounded" height={180} />
            </Grid>
          ))}
        </Grid>
      )}

      {health.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Stav systému se nepodařilo načíst. Server neodpověděl nebo účet nemá oprávnění settings.clinic.manage.
        </Alert>
      )}

      {h && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Section
            title="Databáze"
            status={databaseState(h)}
            summary={h.database.reachable
              ? 'Databáze odpovídá. Pokud čekají migrace, běží API nad starší strukturou dat než jeho kód.'
              : 'Databáze neodpovídá — bez ní nefunguje nic, co systém ukládá.'}
          >
            {h.database.reachable ? (
              <>
                <Fact label="Odezva" value={`${h.database.latencyMs} ms`} help="Jak dlouho trval nejjednodušší dotaz na databázi. Stovky milisekund znamenají přetíženou databázi nebo pomalou síť." />
                <Fact label="Provedené migrace" value={h.database.appliedMigrations ?? '—'} help="Kolik změn struktury databáze už bylo provedeno." />
                <Fact label="Čekající migrace" value={h.database.pendingMigrations ?? '—'} help="Změny struktury, které tato verze aplikace zná, ale databáze je ještě neprovedla. Má být nula." />
              </>
            ) : (
              <Alert severity="error" sx={{ mt: 1 }}>{h.database.error ?? 'Databáze neodpověděla.'}</Alert>
            )}
          </Section>

          <Section
            title="Odchozí e-maily"
            status={outboxState(h)}
            summary="Fronta e-mailů pro pacienty. Zpráva ve frontě čeká, dokud ji SMTP server nepřijme; po třech neúspěšných pokusech se označí jako selhaná."
          >
            <Fact label="Čeká na odeslání" value={h.outbox.pending ?? '—'} help="Zprávy, které systém vytvořil a ještě neodešly." />
            <Fact label="Selhalo" value={h.outbox.failed ?? '—'} help="Zprávy, které se nepodařilo odeslat ani na třetí pokus. Adresa je špatně nebo je SMTP server odmítl." />
            <Fact label="Nejstarší čekající" value={formatAge(h.outbox.oldestPendingAgeMinutes)} help="Jak dlouho čeká nejstarší neodeslaná zpráva. Přes hodinu znamená, že frontu nikdo neodesílá — nejčastěji chybí SMTP." />
          </Section>

          <Section
            title="Odesílání e-mailů (SMTP)"
            status={smtpState(h)}
            summary={h.smtp.configured
              ? 'Server má odkud e-maily odesílat.'
              : 'SMTP není nastaveno — e-maily se vytvářejí a čekají ve frontě, ale neodcházejí. Nastavuje se v konfiguraci serveru (Email:SmtpHost, Email:SmtpUser, Email:SmtpPassword).'}
          >
            <Fact label="Nastaveno" value={h.smtp.configured ? 'ano' : 'ne'} help="Zda je v konfiguraci serveru vyplněný SMTP server a přihlašovací jméno. Heslo se zde nikdy neukazuje." />
          </Section>

          <Section
            title="Úložiště dokumentů"
            status={storageState(h)}
            summary={h.storage.writable
              ? 'Do složky s dokumenty pacientů jde právě teď zapisovat.'
              : 'Do složky s dokumenty nejde zapisovat — nahrání dokumentu ani vystavení PDF se nepodaří.'}
          >
            <Fact label="Složka" value={h.storage.root || '—'} help="Kam se ukládají nahrané dokumenty a vystavené soubory. Musí být mimo složku aplikace a musí se zálohovat." />
            <Fact label="Zápis" value={h.storage.writable ? 'funguje' : 'selhal'} help="Server právě zkusil do složky zapsat a smazat zkušební soubor." />
            <Fact label="Volné místo" value={formatBytes(h.storage.freeBytes)} help="Volné místo na disku, kde složka leží. Pod 1 GB je varování." />
            <Fact label="Velikost disku" value={formatBytes(h.storage.totalBytes)} help="Celková velikost toho disku." />
            {h.storage.problem && <Alert severity="error" sx={{ mt: 1 }}>{h.storage.problem}</Alert>}
          </Section>

          <Section
            title="Aplikace"
            status="ok"
            summary="Která verze běží a od kdy. Po nasazení nové verze se má změnit verze i čas startu."
          >
            <Fact label="Verze" value={h.application.version} help="Verze sestavení serveru." />
            <Fact label="Běží od" value={formatDateTime(h.application.startedAtUtc)} help="Kdy byl proces serveru naposledy spuštěn." />
            <Fact label="Prostředí" value={h.application.environment} help="Development znamená vývojářské nastavení, Production ostrý provoz." />
            <Fact label="Přihlášené relace" value={h.activeSessions ?? '—'} help="Kolik přihlášení je právě platných; seznam je níže." />
          </Section>
        </Grid>
      )}

      {/* ── Active sessions ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            <People sx={{ mr: 1, verticalAlign: 'middle' }} />
            Aktivní relace{sessions.data ? ` (${sessions.data.length})` : ''}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Kdo je právě přihlášen a do kdy mu přihlášení platí.
          </Typography>
          {sessions.isError ? (
            <Alert severity="error">Aktivní relace se nepodařilo načíst.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Uživatel</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>E-mail</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Přihlášen</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Platnost do</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(sessions.data ?? []).map((session) => (
                    <TableRow key={session.id} hover>
                      <TableCell>{session.displayName}</TableCell>
                      <TableCell>{session.email}</TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{formatDateTime(session.createdAt)}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{formatDateTime(session.expiresAt)}</Typography></TableCell>
                    </TableRow>
                  ))}
                  {sessions.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">Žádné aktivní relace</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Recent failures from the audit log ── */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            <ErrorOutlined sx={{ mr: 1, verticalAlign: 'middle' }} />
            Poslední chyby
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Operace, které skončily chybou, jak je zapsal auditní log. Bez osobních údajů.
          </Typography>
          {errors.isError ? (
            <Alert severity="error">Poslední chyby se nepodařilo načíst.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Čas</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Akce</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Záznam</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(errors.data ?? []).map((error) => (
                    <TableRow key={error.id} hover>
                      <TableCell><Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(error.timestamp)}</Typography></TableCell>
                      <TableCell>{error.action}</TableCell>
                      <TableCell>{error.entity}</TableCell>
                    </TableRow>
                  ))}
                  {errors.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                        <CheckCircle sx={{ fontSize: 40, color: 'success.light', mb: 1 }} />
                        <Typography color="text.secondary">Žádné chyby</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
