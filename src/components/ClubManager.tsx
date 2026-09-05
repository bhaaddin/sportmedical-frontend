import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Box,
  IconButton,
  Chip,
  CircularProgress,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import {
  useClubs,
  useCreateClub,
  useUpdateClub,
  clubsApi,
  Club,
} from '../services/clubsApi';

export const ClubManager: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);

  const { data: clubs = [], isLoading } = useClubs();
  const createMutation = useCreateClub();
  const updateMutation = useUpdateClub();

  const [formData, setFormData] = useState({
    name: '',
    ico: '',
    dic: '',
    address: '',
    city: '',
    postalCode: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    bankAccount: '',
    bankCode: '',
    iban: '',
    paymentTermsDays: 14,
  });

  const resetForm = () => {
    setFormData({
      name: '', ico: '', dic: '', address: '', city: '', postalCode: '',
      contactPerson: '', contactEmail: '', contactPhone: '',
      bankAccount: '', bankCode: '', iban: '', paymentTermsDays: 14,
    });
    setEditingClub(null);
  };

  const handleEdit = (club: Club) => {
    setEditingClub(club);
    setFormData({
      name: club.name, ico: club.ico, dic: club.dic || '',
      address: club.address || '', city: club.city || '', postalCode: club.postalCode || '',
      contactPerson: club.contactPerson || '', contactEmail: club.contactEmail || '',
      contactPhone: club.contactPhone || '', bankAccount: club.bankAccount || '',
      bankCode: club.bankCode || '', iban: club.iban || '', paymentTermsDays: club.paymentTermsDays,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClub) {
        await updateMutation.mutateAsync({ id: editingClub.id, data: formData });
        toast.success('Klub aktualizován');
      } else {
        await createMutation.mutateAsync(formData);
        toast.success('Klub vytvořen');
      }
      setDialogOpen(false);
      resetForm();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Chyba při ukládání');
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Box display="flex" alignItems="center" gap={1}>
              <BusinessIcon color="primary" />
              <Typography variant="h5">Kluby a korporátní klienti</Typography>
            </Box>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { resetForm(); setDialogOpen(true); }}>
              Nový klub
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Název</TableCell>
                  <TableCell>IČO</TableCell>
                  <TableCell>Kontaktní osoba</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Stav</TableCell>
                  <TableCell>Akce</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clubs.map((club) => (
                  <TableRow key={club.id}>
                    <TableCell>{club.name}</TableCell>
                    <TableCell>{club.ico}</TableCell>
                    <TableCell>{club.contactPerson || '-'}</TableCell>
                    <TableCell>{club.contactEmail || '-'}</TableCell>
                    <TableCell>
                      <Chip label={club.isActive ? 'Aktivní' : 'Neaktivní'} color={club.isActive ? 'success' : 'default'} size="small" />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Upravit">
                        <IconButton size="small" onClick={() => handleEdit(club)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingClub ? 'Upravit klub' : 'Nový klub'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField fullWidth label="Název" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="IČO" value={formData.ico} onChange={(e) => setFormData({ ...formData, ico: e.target.value })} inputProps={{ maxLength: 8 }} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="DIČ" value={formData.dic} onChange={(e) => setFormData({ ...formData, dic: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Adresa" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField fullWidth label="Město" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="PSČ" value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}><Divider /><Typography variant="h6" mt={2}>Kontaktní údaje</Typography></Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Kontaktní osoba" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Email" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Telefon" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Zrušit</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? 'Ukládání...' : editingClub ? 'Uložit' : 'Vytvořit'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};