import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Box,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import { useCreateInvoice, type LineItem, type CreateInvoiceData } from '../services/accountingDocumentsApi';

interface AccountingInvoiceFormProps {
  patientId?: string;
  bookingId?: string;
  onSuccess?: (documentId: string) => void;
}

export const AccountingInvoiceForm: React.FC<AccountingInvoiceFormProps> = ({
  patientId,
  bookingId,
  onSuccess,
}) => {
  const createMutation = useCreateInvoice();
  
  const [formData, setFormData] = useState<CreateInvoiceData>({
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customerName: '',
    customerIco: '',
    customerDic: '',
    customerAddress: '',
    bankAccount: '',
    bankCode: '',
    iban: '',
    variableSymbol: '',
    items: [{ description: '', quantity: 1, unitPrice: 0, vatRate: 21 }],
    patientId,
    bookingId,
  });

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { description: '', quantity: 1, unitPrice: 0, vatRate: 21 },
      ],
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length === 1) {
      toast.error('Faktura musí obsahovat alespoň jednu položku');
      return;
    }
    
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: keyof LineItem, value: unknown) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotals = () => {
    const baseAmount = formData.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const vatAmount = formData.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice * (item.vatRate / 100),
      0
    );
    return { baseAmount, vatAmount, totalAmount: baseAmount + vatAmount };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName.trim()) {
      toast.error('Zadejte název odběratele');
      return;
    }
    
    if (!formData.items.some(item => item.description.trim() && item.unitPrice > 0)) {
      toast.error('Zadejte alespoň jednu platnou položku');
      return;
    }

    createMutation.mutate(formData, {
      onSuccess: (document) => {
        toast.success('Faktura vytvořena');
        onSuccess?.(document.id);
      },
      onError: (error: unknown) => {
        const err = error as { response?: { data?: { message?: string } } };
        toast.error(err.response?.data?.message || 'Chyba při vytváření faktury');
      },
    });
  };

  const { baseAmount, vatAmount, totalAmount } = calculateTotals();

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <ReceiptIcon color="primary" />
          <Typography variant="h5">Nová faktura</Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Customer Info */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="h6" color="primary">Odběratel</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Název firmy"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="IČO"
                value={formData.customerIco}
                onChange={(e) => setFormData({ ...formData, customerIco: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 8 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="DIČ"
                value={formData.customerDic}
                onChange={(e) => setFormData({ ...formData, customerDic: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Adresa"
                value={formData.customerAddress}
                onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>

            {/* Payment Info */}
            <Grid size={{ xs: 12 }}>
              <Divider />
              <Typography variant="h6" color="primary" mt={2}>Platební údaje</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Číslo účtu"
                value={formData.bankAccount}
                onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                fullWidth
                label="Kód banky"
                value={formData.bankCode}
                onChange={(e) => setFormData({ ...formData, bankCode: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 4 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="IBAN"
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="Variabilní symbol"
                value={formData.variableSymbol}
                onChange={(e) => setFormData({ ...formData, variableSymbol: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 10 } }}
              />
            </Grid>

            {/* Line Items */}
            <Grid size={{ xs: 12 }}>
              <Divider />
              <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                <Typography variant="h6" color="primary">Položky</Typography>
                <Button startIcon={<AddIcon />} onClick={addItem} size="small">
                  Přidat položku
                </Button>
              </Box>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Popis</TableCell>
                      <TableCell width={80}>Množství</TableCell>
                      <TableCell width={60}>MJ</TableCell>
                      <TableCell width={110}>Cena za MJ</TableCell>
                      <TableCell width={70}>DPH %</TableCell>
                      <TableCell width={100} align="right">Celkem</TableCell>
                      <TableCell width={50}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            placeholder="Popis položky"
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.unit || ''}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            placeholder="ks"
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))}
                            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={item.vatRate}
                            onChange={(e) => updateItem(index, 'vatRate', Number(e.target.value))}
                            slotProps={{ htmlInput: { min: 0, max: 100 } }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {(item.quantity * item.unitPrice).toFixed(2)} Kč
                        </TableCell>
                        <TableCell>
                          <IconButton onClick={() => removeItem(index)} size="small">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            {/* Totals */}
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 2 }} />
              <Box display="flex" justifyContent="flex-end">
                <Box textAlign="right" minWidth={250}>
                  <Box display="flex" justifyContent="space-between">
                    <Typography>Základ daně:</Typography>
                    <Typography>{baseAmount.toFixed(2)} Kč</Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography>DPH:</Typography>
                    <Typography>{vatAmount.toFixed(2)} Kč</Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mt={1}>
                    <Typography variant="h6">Celkem:</Typography>
                    <Typography variant="h6" color="primary">
                      {totalAmount.toFixed(2)} Kč
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>

            {/* Due Date */}
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                type="date"
                label="Splatnost"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                required
              />
            </Grid>

            {/* Submit */}
            <Grid size={{ xs: 12 }}>
              <Box display="flex" gap={2}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={createMutation.isPending}
                  startIcon={createMutation.isPending && <CircularProgress size={20} />}
                >
                  {createMutation.isPending ? 'Vytváření...' : 'Vytvořit fakturu'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </CardContent>
    </Card>
  );
};