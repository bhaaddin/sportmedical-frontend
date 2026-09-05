/* ══════════════════════════════════════════════════════════════
   PATIENT IMPORT — PLAN-01 Feature A51-A55
   - CSV/Excel import with validation
   - Preview before import
   - Error reporting
   ══════════════════════════════════════════════════════════════ */
import { useState, useRef } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Alert, Snackbar, LinearProgress,
  Chip, IconButton, Grid, Card, CardContent
} from '@mui/material';
import {
  Upload as UploadIcon, CheckCircle as CheckIcon, Error as ErrorIcon,
  Download as DownloadIcon, Delete as DeleteIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import client from '../api/client';

interface ImportRow {
  row: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  sex: string;
  isValid: boolean;
  errors: string[];
}

export default function PatientImport() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    parseCSV(selectedFile);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const rows: ImportRow[] = lines.slice(1).map((line, i) => {
        const values = line.split(',').map(v => v.trim());
        const row: ImportRow = {
          row: i + 2,
          firstName: values[headers.indexOf('firstname') || headers.indexOf('jmeno') || 0] || '',
          lastName: values[headers.indexOf('lastname') || headers.indexOf('prijmeni') || 1] || '',
          email: values[headers.indexOf('email') || 2] || '',
          phone: values[headers.indexOf('phone') || headers.indexOf('telefon') || 3] || '',
          dateOfBirth: values[headers.indexOf('dateofbirth') || headers.indexOf('datum') || 4] || '',
          sex: values[headers.indexOf('sex') || headers.indexOf('pohlavi') || 5] || '',
          isValid: true,
          errors: [],
        };
        
        // Validate
        if (!row.firstName) row.errors.push('Chybí jméno');
        if (!row.lastName) row.errors.push('Chybí příjmení');
        if (!row.email || !row.email.includes('@')) row.errors.push('Neplatný email');
        row.isValid = row.errors.length === 0;
        
        return row;
      });
      
      setPreview(rows);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validRows = preview.filter(r => r.isValid);
    if (validRows.length === 0) {
      setSnackbar({ open: true, message: 'Žádné platné řádky k importu', severity: 'error' });
      return;
    }

    setImporting(true);
    try {
      const res = await client.post('/api/patients/import', { patients: validRows });
      const data = res.data;
      setResults({
        success: data?.success ?? validRows.length,
        failed: data?.failed ?? 0,
        errors: data?.errors ?? [],
      });
      setSnackbar({ open: true, message: `Import dokončen: ${validRows.length} pacientů`, severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Chyba při importu', severity: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'FirstName,LastName,Email,Phone,DateOfBirth,Sex\nJan,Novák,jan@example.com,+420123456789,1990-01-15,Male\nMarie,Svobodová,marie@example.com,+420987654321,1985-05-20,Female';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patient-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = preview.filter(r => r.isValid).length;
  const invalidCount = preview.filter(r => !r.isValid).length;

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <UploadIcon color="primary" /> Import pacientů
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Import pacientů z CSV souboru
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
            Stáhnout šablonu
          </Button>
        </Box>
      </motion.div>

      {/* Upload */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} hidden />
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <UploadIcon sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>Vyberte soubor</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Podporované formáty: CSV, XLSX, XLS
            </Typography>
            <Button variant="contained" startIcon={<UploadIcon />} onClick={() => fileInputRef.current?.click()}>
              Vybrat soubor
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Náhled ({preview.length} řádků)</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip label={`${validCount} platných`} color="success" size="small" />
                  {invalidCount > 0 && <Chip label={`${invalidCount} chybných`} color="error" size="small" />}
                </Box>
              </Box>

              {importing && <LinearProgress sx={{ mb: 2 }} />}

              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Řádek</TableCell>
                      <TableCell>Jméno</TableCell>
                      <TableCell>Příjmení</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Telefon</TableCell>
                      <TableCell>Stav</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.slice(0, 50).map((row) => (
                      <TableRow key={row.row} sx={{ bgcolor: row.isValid ? 'transparent' : '#FFF3E0' }}>
                        <TableCell>{row.row}</TableCell>
                        <TableCell>{row.firstName}</TableCell>
                        <TableCell>{row.lastName}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.phone}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <CheckIcon color="success" fontSize="small" />
                          ) : (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {row.errors.map((err, i) => (
                                <Chip key={i} label={err} size="small" color="error" />
                              ))}
                            </Box>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
                <Button variant="outlined" onClick={() => { setPreview([]); setFile(null); }}>
                  Zrušit
                </Button>
                <Button variant="contained" onClick={handleImport} disabled={validCount === 0 || importing}
                  sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>
                  Importovat {validCount} pacientů
                </Button>
              </Box>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Results */}
      {results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Alert severity={results.failed > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
            Import dokončen: {results.success} úspěšných, {results.failed} chybných
          </Alert>
        </motion.div>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
