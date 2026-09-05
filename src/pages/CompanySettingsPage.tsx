import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Paper,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import BusinessIcon from '@mui/icons-material/Business';
import { toast } from 'react-hot-toast';
import { useCompanySettings, useUpdateCompanySettings, companySettingsApi } from '../services/companySettingsApi';

interface FormState {
  companyName: string;
  ico: string;
  dic: string;
  address: string;
  city: string;
  postalCode: string;
  bankAccount: string;
  bankCode: string;
  iban: string;
  phone: string;
  email: string;
  website: string;
}

const initialFormState: FormState = {
  companyName: '',
  ico: '',
  dic: '',
  address: '',
  city: '',
  postalCode: '',
  bankAccount: '',
  bankCode: '',
  iban: '',
  phone: '',
  email: '',
  website: '',
};

export const CompanySettingsPage: React.FC = () => {
  const { data: settings, isLoading, refetch } = useCompanySettings();
  const updateMutation = useUpdateCompanySettings();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [aresLoading, setAresLoading] = useState(false);
  const [aresError, setAresError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Partial<FormState>>({});

  useEffect(() => {
    if (settings) {
      setForm({
        companyName: settings.companyName || '',
        ico: settings.ico || '',
        dic: settings.dic || '',
        address: settings.address || '',
        city: settings.city || '',
        postalCode: settings.postalCode || '',
        bankAccount: settings.bankAccount || '',
        bankCode: settings.bankCode || '',
        iban: settings.iban || '',
        phone: settings.phone || '',
        email: settings.email || '',
        website: settings.website || '',
      });
    }
  }, [settings]);

  const validateForm = (): boolean => {
    const errors: Partial<FormState> = {};

    if (!form.companyName.trim()) {
      errors.companyName = 'Název společnosti je povinný';
    }

    if (!/^\d{8}$/.test(form.ico)) {
      errors.ico = 'IČO musí mít přesně 8 číslic';
    }

    if (form.dic && !/^CZ\d{8,10}$/i.test(form.dic)) {
      errors.dic = 'DIČ musí být ve formátu CZ + 8-10 číslic';
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Neplatný formát emailu';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm({ ...form, [field]: e.target.value });
    if (validationErrors[field]) {
      setValidationErrors({ ...validationErrors, [field]: undefined });
    }
  };

  const handleAresLookup = async () => {
    if (!/^\d{8}$/.test(form.ico)) {
      setAresError('IČO musí mít přesně 8 číslic pro ARES vyhledávání');
      return;
    }

    setAresLoading(true);
    setAresError(null);

    try {
      const result = await companySettingsApi.lookupAres(form.ico);
      
      setForm(prev => ({
        ...prev,
        companyName: result.companyName || prev.companyName,
        dic: result.dic || prev.dic,
        address: result.address || prev.address,
        city: result.city || prev.city,
        postalCode: result.postalCode || prev.postalCode,
      }));
      
      toast.success('Data z ARES úspěšně načtena');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Společnost nebyla nalezena v ARES';
      setAresError(message);
      toast.error(message);
    } finally {
      setAresLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Zkontrolujte prosím vyplněná data');
      return;
    }

    try {
      await updateMutation.mutateAsync(form);
      toast.success('Nastavení společnosti bylo uloženo');
    } catch (error) {
      toast.error('Chyba při ukládání nastavení');
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth="lg" mx="auto" p={3}>
      <Paper elevation={3}>
        <Box p={3}>
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <BusinessIcon color="primary" fontSize="large" />
            <Typography variant="h4" component="h1">
              Nastavení společnosti
            </Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* ARES Lookup Section */}
              <Grid size={{ xs: 12 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      ARES vyhledávání
                    </Typography>
                    <Box display="flex" gap={2} alignItems="flex-start">
                      <TextField
                        label="IČO"
                        value={form.ico}
                        onChange={handleInputChange('ico')}
                        error={!!validationErrors.ico}
                        helperText={validationErrors.ico}
                        inputProps={{ maxLength: 8 }}
                        placeholder="12345678"
                        size="small"
                      />
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={handleAresLookup}
                        disabled={aresLoading || form.ico.length !== 8}
                        startIcon={aresLoading ? <CircularProgress size={16} /> : <SearchIcon />}
                      >
                        {aresLoading ? 'Vyhledávám...' : 'Vyhledat v ARES'}
                      </Button>
                    </Box>
                    {aresError && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        {aresError}
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Basic Information */}
              <Grid size={{ xs: 12 }}>
                <Divider />
                <Typography variant="h6" mt={2} mb={2}>
                  Základní informace
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  fullWidth
                  label="Název společnosti"
                  value={form.companyName}
                  onChange={handleInputChange('companyName')}
                  error={!!validationErrors.companyName}
                  helperText={validationErrors.companyName}
                  required
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="DIČ"
                  value={form.dic}
                  onChange={handleInputChange('dic')}
                  error={!!validationErrors.dic}
                  helperText={validationErrors.dic}
                  placeholder="CZ12345678"
                />
              </Grid>

              {/* Address */}
              <Grid size={{ xs: 12 }}>
                <Divider />
                <Typography variant="h6" mt={2} mb={2}>
                  Adresa
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  fullWidth
                  label="Ulice a číslo"
                  value={form.address}
                  onChange={handleInputChange('address')}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  label="Město"
                  value={form.city}
                  onChange={handleInputChange('city')}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  label="PSČ"
                  value={form.postalCode}
                  onChange={handleInputChange('postalCode')}
                />
              </Grid>

              {/* Banking Information */}
              <Grid size={{ xs: 12 }}>
                <Divider />
                <Typography variant="h6" mt={2} mb={2}>
                  Bankovní spojení
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Číslo účtu"
                  value={form.bankAccount}
                  onChange={handleInputChange('bankAccount')}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  label="Kód banky"
                  value={form.bankCode}
                  onChange={handleInputChange('bankCode')}
                  inputProps={{ maxLength: 4 }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="IBAN"
                  value={form.iban}
                  onChange={handleInputChange('iban')}
                />
              </Grid>

              {/* Contact Information */}
              <Grid size={{ xs: 12 }}>
                <Divider />
                <Typography variant="h6" mt={2} mb={2}>
                  Kontaktní údaje
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Telefon"
                  value={form.phone}
                  onChange={handleInputChange('phone')}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Email"
                  value={form.email}
                  onChange={handleInputChange('email')}
                  error={!!validationErrors.email}
                  helperText={validationErrors.email}
                  type="email"
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Webové stránky"
                  value={form.website}
                  onChange={handleInputChange('website')}
                />
              </Grid>

              {/* Action Buttons */}
              <Grid size={{ xs: 12 }}>
                <Box display="flex" gap={2} justifyContent="flex-end" mt={2}>
                  <Button
                    variant="outlined"
                    onClick={() => refetch()}
                    startIcon={<RefreshIcon />}
                  >
                    Obnovit
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    size="large"
                    disabled={updateMutation.isPending}
                    startIcon={updateMutation.isPending ? <CircularProgress size={20} /> : <SaveIcon />}
                  >
                    {updateMutation.isPending ? 'Ukládání...' : 'Uložit nastavení'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Box>
      </Paper>
    </Box>
  );
};
