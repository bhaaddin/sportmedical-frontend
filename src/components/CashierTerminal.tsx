import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Divider,
  CircularProgress,
} from '@mui/material';
import { PointOfSale as PointOfSaleIcon } from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import {
  useCashierDashboard,
  useTransactions,
  useCreateTransaction,
  cashierApi,
  PaymentMethod,
  TransactionStatus,
} from '../services/cashierApi';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(amount);
};

const getPaymentMethodLabel = (method: PaymentMethod) => {
  switch (method) {
    case PaymentMethod.Cash: return 'Hotovost';
    case PaymentMethod.Card: return 'Karta';
    case PaymentMethod.ClubBilling: return 'Na klub';
    case PaymentMethod.Transfer: return 'Převod';
    default: return 'Neznámý';
  }
};

const getStatusLabel = (status: TransactionStatus) => {
  switch (status) {
    case TransactionStatus.Pending: return 'Čeká';
    case TransactionStatus.Completed: return 'Dokončeno';
    case TransactionStatus.Cancelled: return 'Zrušeno';
    case TransactionStatus.Refunded: return 'Vráceno';
    default: return 'Neznámý';
  }
};

const getStatusColor = (status: TransactionStatus) => {
  switch (status) {
    case TransactionStatus.Pending: return 'warning';
    case TransactionStatus.Completed: return 'success';
    case TransactionStatus.Cancelled: return 'error';
    case TransactionStatus.Refunded: return 'info';
    default: return 'default';
  }
};

export const CashierTerminal: React.FC = () => {
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);

  const today = new Date().toISOString().split('T')[0];
  const { data: dashboard, isLoading: dashboardLoading } = useCashierDashboard(today);
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions(today);
  const createMutation = useCreateTransaction();

  const handleCreateTransaction = async () => {
    if (!selectedServiceId || !selectedPatientId) {
      toast.error('Vyberte službu a pacienta');
      return;
    }

    try {
      await createMutation.mutateAsync({
        serviceId: selectedServiceId,
        patientId: selectedPatientId,
        originalPrice: 1000,
        vatRate: 21,
        paymentMethod,
      });
      
      toast.success('Transakce vytvořena');
      setSelectedServiceId('');
      setSelectedPatientId('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Chyba při vytváření transakce');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cashierApi.cancelTransaction(id, 'Storno');
      toast.success('Transakce zrušena');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Chyba');
    }
  };

  const handleRefund = async (id: string) => {
    try {
      await cashierApi.refundTransaction(id, 'Vrácení zákazníkem');
      toast.success('Transakce vrácena');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Chyba');
    }
  };

  if (dashboardLoading || transactionsLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth="lg" mx="auto" p={3}>
      <Grid container spacing={3}>
        {/* Quick Stats */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <PointOfSaleIcon color="primary" />
                <Typography variant="h5">Pokladna</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary">
                      {formatCurrency(dashboard?.todayRevenue || 0)}
                    </Typography>
                    <Typography color="text.secondary">Dnešní tržba</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="h4">{dashboard?.transactionsCount || 0}</Typography>
                    <Typography color="text.secondary">Transakcí</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="h4">{dashboard?.cashTransactions || 0}</Typography>
                    <Typography color="text.secondary">Hotovost</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="h4">{dashboard?.cardTransactions || 0}</Typography>
                    <Typography color="text.secondary">Karta</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Sale */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Rychlá platba</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth>
                    <InputLabel>Služba</InputLabel>
                    <Select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} label="Služba">
                      <MenuItem value="1">Sportovní prohlídka</MenuItem>
                      <MenuItem value="2">Spiroergometrie</MenuItem>
                      <MenuItem value="3">Konzultace</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth>
                    <InputLabel>Pacient</InputLabel>
                    <Select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)} label="Pacient">
                      <MenuItem value="p1">Jan Novák</MenuItem>
                      <MenuItem value="p2">Petr Svoboda</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth>
                    <InputLabel>Způsob platby</InputLabel>
                    <Select value={paymentMethod} onChange={(e) => setPaymentMethod(Number(e.target.value) as PaymentMethod)} label="Způsob platby">
                      <MenuItem value={PaymentMethod.Cash}>Hotovost</MenuItem>
                      <MenuItem value={PaymentMethod.Card}>Karta</MenuItem>
                      <MenuItem value={PaymentMethod.ClubBilling}>Na klub</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button variant="contained" fullWidth size="large" onClick={handleCreateTransaction} disabled={createMutation.isPending || !selectedServiceId || !selectedPatientId}>
                    {createMutation.isPending ? 'Zpracování...' : 'Zaplatit'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Transactions List */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Dnešní transakce</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Čas</TableCell>
                      <TableCell>Částka</TableCell>
                      <TableCell>Platba</TableCell>
                      <TableCell>Stav</TableCell>
                      <TableCell>Akce</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{new Date(t.createdAt).toLocaleTimeString('cs-CZ')}</TableCell>
                        <TableCell>{formatCurrency(t.finalPrice)}</TableCell>
                        <TableCell><Chip label={getPaymentMethodLabel(t.paymentMethod)} size="small" /></TableCell>
                        <TableCell><Chip label={getStatusLabel(t.status)} color={getStatusColor(t.status)} size="small" /></TableCell>
                        <TableCell>
                          {t.status === TransactionStatus.Pending && (
                            <Button size="small" color="error" onClick={() => handleCancel(t.id)}>Storno</Button>
                          )}
                          {t.status === TransactionStatus.Completed && (
                            <Button size="small" color="warning" onClick={() => handleRefund(t.id)}>Vrátit</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};