import React, { useState } from 'react';
import {
  Card, CardContent, Typography, Grid, Button, Box, TextField,
  FormControl, InputLabel, Select, MenuItem, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
  IconButton, Tooltip, CircularProgress, Alert,
} from '@mui/material';
import {
  Download as DownloadIcon, Delete as DeleteIcon,
  FileDownload as FileDownloadIcon, Description as DescriptionIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  useExportHistory, useExportAccounting, useDeleteExport,
  accountingExportApi, ExportFormat, ExportType, type ExportResult,
} from '../services/accountingExportApi';

const formatLabels: Record<ExportFormat, string> = {
  [ExportFormat.CSV]: 'CSV',
  [ExportFormat.PohodaXml]: 'Pohoda XML',
  [ExportFormat.MoneyS3Xml]: 'Money S3 XML',
  [ExportFormat.IdokladXml]: 'iDoklad XML',
};

const typeLabels: Record<ExportType, string> = {
  [ExportType.Invoices]: 'Faktury',
  [ExportType.CreditNotes]: 'Dobropisy',
  [ExportType.Payments]: 'Platby',
  [ExportType.All]: 'Vše',
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AccountingExportPage: React.FC = () => {
  const [format, setFormat] = useState<ExportFormat>(ExportFormat.PohodaXml);
  const [type, setType] = useState<ExportType>(ExportType.Invoices);
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);

  const { data: history = [], isLoading } = useExportHistory();
  const exportMutation = useExportAccounting();
  const deleteMutation = useDeleteExport();

  const handleExport = async () => {
    if (!dateFrom || !dateTo) { toast.error('Vyberte období'); return; }
    if (new Date(dateFrom) > new Date(dateTo)) { toast.error('Datum od musí být před datem do'); return; }

    try {
      const result = await exportMutation.mutateAsync({
        format, type,
        dateFrom: new Date(dateFrom).toISOString(),
        dateTo: new Date(dateTo).toISOString(),
      });
      toast.success(`Export dokončen (${result.recordCount} záznamů)`);
      await handleDownload(result.id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Chyba při exportu');
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const blob = await accountingExportApi.download(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${id}.${format === ExportFormat.CSV ? 'csv' : 'xml'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Soubor stažen');
    } catch { toast.error('Chyba při stahování'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Opravdu chcete smazat tento export?')) return;
    try { await deleteMutation.mutateAsync(id); toast.success('Export smazán'); }
    catch { toast.error('Chyba při mazání'); }
  };

  return (
    <Box maxWidth="lg" mx="auto">
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <FileDownloadIcon color="primary" />
                <Typography variant="h5">Účetní export</Typography>
              </Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Exportujte data pro účetní systémy. Podporovány jsou formáty CSV, Pohoda XML a Money S3 XML.
              </Alert>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth>
                    <InputLabel>Cílový systém</InputLabel>
                    <Select value={format} onChange={(e) => setFormat(Number(e.target.value) as ExportFormat)} label="Cílový systém">
                      <MenuItem value={ExportFormat.CSV}>CSV (obecný)</MenuItem>
                      <MenuItem value={ExportFormat.PohodaXml}>Pohoda</MenuItem>
                      <MenuItem value={ExportFormat.MoneyS3Xml}>Money S3</MenuItem>
                      <MenuItem value={ExportFormat.IdokladXml}>iDoklad</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth>
                    <InputLabel>Typ dat</InputLabel>
                    <Select value={type} onChange={(e) => setType(Number(e.target.value) as ExportType)} label="Typ dat">
                      <MenuItem value={ExportType.Invoices}>Faktury</MenuItem>
                      <MenuItem value={ExportType.CreditNotes}>Dobropisy</MenuItem>
                      <MenuItem value={ExportType.Payments}>Platby</MenuItem>
                      <MenuItem value={ExportType.All}>Vše</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth type="date" label="Od" value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth type="date" label="Do" value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button variant="contained" fullWidth size="large" onClick={handleExport}
                    disabled={exportMutation.isPending || !dateFrom || !dateTo}
                    startIcon={exportMutation.isPending ? <CircularProgress size={20} /> : undefined}>
                    {exportMutation.isPending ? 'Exportuji...' : 'Exportovat'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <DescriptionIcon color="primary" />
                <Typography variant="h5">Historie exportů</Typography>
              </Box>
              {isLoading ? (
                <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>
              ) : history.length === 0 ? (
                <Alert severity="info">Zatím nebyly provedeny žádné exporty</Alert>
              ) : (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Datum exportu</TableCell>
                        <TableCell>Formát</TableCell>
                        <TableCell>Typ</TableCell>
                        <TableCell>Období</TableCell>
                        <TableCell>Záznamů</TableCell>
                        <TableCell>Velikost</TableCell>
                        <TableCell>Akce</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {history.map((exp: ExportResult) => (
                        <TableRow key={exp.id}>
                          <TableCell>{new Date(exp.exportedAt).toLocaleString('cs-CZ')}</TableCell>
                          <TableCell><Chip label={formatLabels[exp.format]} size="small" color="primary" /></TableCell>
                          <TableCell>{typeLabels[exp.type]}</TableCell>
                          <TableCell>
                            {new Date(exp.dateFrom).toLocaleDateString('cs-CZ')} - {new Date(exp.dateTo).toLocaleDateString('cs-CZ')}
                          </TableCell>
                          <TableCell>{exp.recordCount}</TableCell>
                          <TableCell>{formatFileSize(exp.fileSize)}</TableCell>
                          <TableCell>
                            <Tooltip title="Stáhnout">
                              <IconButton size="small" onClick={() => handleDownload(exp.id)}>
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Smazat">
                              <IconButton size="small" onClick={() => handleDelete(exp.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AccountingExportPage;
