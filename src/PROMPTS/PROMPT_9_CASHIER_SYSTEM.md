# PROMPT 9: CASHIER/POKLADNA SYSTEM
## For: SportMedical.Diagnostics (.NET 10 / React 19)

---

## CONTEXT

You are working on **SportMedical.Diagnostics**, a medical diagnostics platform.

**Tech Stack:**
- Backend: .NET 10 / C# 14 / ASP.NET Core / Entity Framework Core
- Frontend: React 19 / TypeScript / MUI / React Query / Zustand
- Database: PostgreSQL (production) / SQLite (local)

**Architecture:** Clean Architecture with Domain, Application, Infrastructure, Persistence layers.

---

## REQUIREMENT

Implement **Cashier/Pokladna** system for handling payments.

### Business Rules
1. Two-step selection: Category → Service
2. Patient search/quick create
3. Club selection (optional)
4. Payment methods: Cash, Card, Club billing
5. Price display with VAT
6. Discount application with audit
7. PPD (receipt) generation
8. Payment confirmation

### Czech Context
- Cash payments require PPD (Příjmový pokladní doklad)
- Club billing generates monthly invoice
- Discounts must have justification

---

## DOMAIN LAYER

### File: `Billing/CashierTransaction.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Billing;

public class CashierTransaction
{
    public Guid Id { get; private set; }
    public Guid ServiceId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid? ClubId { get; private set; }
    public decimal OriginalPrice { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal FinalPrice { get; private set; }
    public decimal VatRate { get; private set; }
    public decimal VatAmount { get; private set; }
    public PaymentMethod PaymentMethod { get; private set; }
    public string? DiscountReason { get; private set; }
    public string? Notes { get; private set; }
    public Guid? DocumentId { get; private set; }
    public TransactionStatus Status { get; private set; } = TransactionStatus.Pending;
    public DateTime CreatedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public Guid? CreatedByUserId { get; private set; }

    public static CashierTransaction Create(
        Guid serviceId, Guid patientId, decimal originalPrice,
        decimal vatRate, PaymentMethod paymentMethod, Guid? userId)
    {
        return new CashierTransaction
        {
            Id = Guid.NewGuid(),
            ServiceId = serviceId,
            PatientId = patientId,
            OriginalPrice = originalPrice,
            VatRate = vatRate,
            PaymentMethod = paymentMethod,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void ApplyDiscount(decimal amount, string reason)
    {
        if (amount < 0 || amount > OriginalPrice)
            throw new ArgumentException("Invalid discount amount");

        DiscountAmount = amount;
        DiscountReason = reason;
        Recalculate();
    }

    public void SetClub(Guid clubId)
    {
        ClubId = clubId;
        PaymentMethod = PaymentMethod.ClubBilling;
    }

    public void Complete(Guid documentId)
    {
        Status = TransactionStatus.Completed;
        DocumentId = documentId;
        CompletedAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        Status = TransactionStatus.Cancelled;
    }

    private void Recalculate()
    {
        var baseAmount = OriginalPrice - DiscountAmount;
        VatAmount = baseAmount * (VatRate / 100);
        FinalPrice = baseAmount + VatAmount;
    }
}

public enum PaymentMethod
{
    Cash = 0,
    Card = 1,
    ClubBilling = 2,
    BankTransfer = 3
}

public enum TransactionStatus
{
    Pending = 0,
    Completed = 1,
    Cancelled = 2,
    Refunded = 3
}
```

### File: `Billing/ICashierRepository.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Billing;

public interface ICashierRepository
{
    Task<CashierTransaction?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<CashierTransaction> CreateAsync(CashierTransaction transaction, CancellationToken ct = default);
    Task UpdateAsync(CashierTransaction transaction, CancellationToken ct = default);
    Task<List<CashierTransaction>> GetByDateAsync(DateTime date, CancellationToken ct = default);
    Task<List<CashierTransaction>> GetByPatientAsync(Guid patientId, CancellationToken ct = default);
    Task<DashboardStats> GetDashboardStatsAsync(DateTime date, CancellationToken ct = default);
}
```

### File: `Billing/DashboardStats.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Billing;

public class DashboardStats
{
    public decimal TodayRevenue { get; set; }
    public int TransactionsCount { get; set; }
    public int CashTransactions { get; set; }
    public int CardTransactions { get; set; }
    public int ClubBillingTransactions { get; set; }
    public decimal AverageTransaction { get; set; }
    public List<ServiceStats> TopServices { get; set; } = new();
}

public class ServiceStats
{
    public string ServiceName { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal Revenue { get; set; }
}
```

---

## APPLICATION LAYER

### File: `Billing/CashierService.cs`
```csharp
using SportMedical.Diagnostics.Domain.Billing;
using SportMedical.Diagnostics.Application.Documents;

namespace SportMedical.Diagnostics.Application.Billing;

public class CashierService
{
    private readonly ICashierRepository _repository;
    private readonly DocumentService _documentService;
    private readonly NumberSeriesService _numberSeriesService;

    public CashierService(
        ICashierRepository repository,
        DocumentService documentService,
        NumberSeriesService numberSeriesService)
    {
        _repository = repository;
        _documentService = documentService;
        _numberSeriesService = numberSeriesService;
    }

    /// <summary>
    /// Create a new cashier transaction
    /// </summary>
    public async Task<CashierTransaction> CreateTransactionAsync(
        CreateTransactionCommand command, CancellationToken ct = default)
    {
        var transaction = CashierTransaction.Create(
            command.ServiceId,
            command.PatientId,
            command.OriginalPrice,
            command.VatRate,
            command.PaymentMethod,
            command.UserId);

        if (command.DiscountAmount > 0)
        {
            transaction.ApplyDiscount(command.DiscountAmount, command.DiscountReason);
        }

        if (command.ClubId.HasValue)
        {
            transaction.SetClub(command.ClubId.Value);
        }

        return await _repository.CreateAsync(transaction, ct);
    }

    /// <summary>
    /// Complete transaction and generate PPD
    /// </summary>
    public async Task<Document> CompleteTransactionAsync(
        CompleteTransactionCommand command, CancellationToken ct = default)
    {
        var transaction = await _repository.GetByIdAsync(command.TransactionId, ct);
        if (transaction == null)
            throw new NotFoundException("Transaction not found");

        if (transaction.Status != TransactionStatus.Pending)
            throw new InvalidOperationException("Transaction is not in pending status");

        // Generate PPD document
        var document = await _documentService.CreatePPDAsync(new CreatePPDCommand(
            PatientName: command.PatientName,
            Description: command.ServiceDescription,
            Amount: transaction.FinalPrice,
            VatRate: transaction.VatRate
        ), ct);

        // Generate PDF
        var pdfPath = await _documentService.GenerateAndSavePdfAsync(document.Id, ct);

        // Complete transaction
        transaction.Complete(document.Id);
        await _repository.UpdateAsync(transaction, ct);

        return document;
    }

    /// <summary>
    /// Get today's dashboard stats
    /// </summary>
    public async Task<DashboardStats> GetDashboardAsync(CancellationToken ct = default)
    {
        return await _repository.GetDashboardStatsAsync(DateTime.UtcNow.Date, ct);
    }

    /// <summary>
    /// Get transactions for date
    /// </summary>
    public async Task<List<CashierTransaction>> GetTransactionsAsync(
        DateTime date, CancellationToken ct = default)
    {
        return await _repository.GetByDateAsync(date, ct);
    }

    /// <summary>
    /// Refund transaction
    /// </summary>
    public async Task RefundTransactionAsync(Guid transactionId, string reason, CancellationToken ct = default)
    {
        var transaction = await _repository.GetByIdAsync(transactionId, ct);
        if (transaction == null)
            throw new NotFoundException("Transaction not found");

        if (transaction.Status != TransactionStatus.Completed)
            throw new InvalidOperationException("Only completed transactions can be refunded");

        // Create credit note document
        // Mark transaction as refunded
        transaction.Status = TransactionStatus.Refunded;
        await _repository.UpdateAsync(transaction, ct);
    }
}

public record CreateTransactionCommand(
    Guid ServiceId,
    Guid PatientId,
    decimal OriginalPrice,
    decimal VatRate,
    PaymentMethod PaymentMethod,
    decimal DiscountAmount = 0,
    string? DiscountReason = null,
    Guid? ClubId = null,
    Guid? UserId = null
);

public record CompleteTransactionCommand(
    Guid TransactionId,
    string PatientName,
    string ServiceDescription
);
```

---

## API LAYER

### File: `CashierController.cs`
```csharp
using Microsoft.AspNetCore.Mvc;
using SportMedical.Diagnostics.Application.Billing;

namespace SportMedical.Diagnostics.Api.Controllers;

[ApiController]
[Route("api/cashier")]
public class CashierController : ControllerBase
{
    private readonly CashierService _service;

    public CashierController(CashierService service)
    {
        _service = service;
    }

    [HttpPost("transactions")]
    public async Task<IActionResult> CreateTransaction([FromBody] CreateTransactionCommand command, CancellationToken ct)
    {
        var transaction = await _service.CreateTransactionAsync(command, ct);
        return Ok(transaction);
    }

    [HttpPost("transactions/{id}/complete")]
    public async Task<IActionResult> CompleteTransaction(Guid id, [FromBody] CompleteTransactionCommand command, CancellationToken ct)
    {
        try
        {
            var document = await _service.CompleteTransactionAsync(
                command with { TransactionId = id }, ct);
            return Ok(new { DocumentId = document.Id, DocumentNumber = document.Number });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard(CancellationToken ct)
    {
        var stats = await _service.GetDashboardAsync(ct);
        return Ok(stats);
    }

    [HttpGet("transactions")]
    public async Task<IActionResult> GetTransactions([FromQuery] DateTime date, CancellationToken ct)
    {
        var transactions = await _service.GetTransactionsAsync(date, ct);
        return Ok(transactions);
    }

    [HttpPost("transactions/{id}/refund")]
    public async Task<IActionResult> RefundTransaction(Guid id, [FromBody] RefundRequest request, CancellationToken ct)
    {
        try
        {
            await _service.RefundTransactionAsync(id, request.Reason, ct);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}

public record RefundRequest(string Reason);
```

---

## FRONTEND

### File: `services/cashierApi.ts`
```typescript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export enum PaymentMethod {
  Cash = 0,
  Card = 1,
  ClubBilling = 2,
  BankTransfer = 3,
}

export interface CashierTransaction {
  id: string;
  serviceId: string;
  patientId: string;
  clubId?: string;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  vatRate: number;
  paymentMethod: PaymentMethod;
  status: string;
  createdAt: string;
}

export interface DashboardStats {
  todayRevenue: number;
  transactionsCount: number;
  cashTransactions: number;
  cardTransactions: number;
  clubBillingTransactions: number;
  averageTransaction: number;
  topServices: Array<{
    serviceName: string;
    count: number;
    revenue: number;
  }>;
}

export const cashierApi = {
  createTransaction: async (data: any): Promise<CashierTransaction> => {
    const response = await axios.post(`${API_BASE}/cashier/transactions`, data);
    return response.data;
  },

  completeTransaction: async (id: string, patientName: string, serviceDescription: string): Promise<any> => {
    const response = await axios.post(`${API_BASE}/cashier/transactions/${id}/complete`, {
      patientName,
      serviceDescription,
    });
    return response.data;
  },

  getDashboard: async (): Promise<DashboardStats> => {
    const response = await axios.get(`${API_BASE}/cashier/dashboard`);
    return response.data;
  },

  getTransactions: async (date: string): Promise<CashierTransaction[]> => {
    const response = await axios.get(`${API_BASE}/cashier/transactions`, { params: { date } });
    return response.data;
  },

  refundTransaction: async (id: string, reason: string): Promise<void> => {
    await axios.post(`${API_BASE}/cashier/transactions/${id}/refund`, { reason });
  },
};
```

### File: `pages/Cashier.tsx`
```tsx
import React, { useState } from 'react';
import {
  Card, CardContent, Typography, Grid, Button, Box, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel, Divider
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashierApi, PaymentMethod, DashboardStats } from '../services/cashierApi';
import { toast } from 'react-hot-toast';

export const CashierPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const [discount, setDiscount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState('');
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['cashierDashboard'],
    queryFn: cashierApi.getDashboard,
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['cashierTransactions'],
    queryFn: () => cashierApi.getTransactions(new Date().toISOString().split('T')[0]),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, patientName, serviceDescription }: any) =>
      cashierApi.completeTransaction(id, patientName, serviceDescription),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashierDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['cashierTransactions'] });
      toast.success('Transakce dokončena');
    },
    onError: () => {
      toast.error('Chyba při dokončení');
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
    }).format(amount);
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case PaymentMethod.Cash: return 'Hotovost';
      case PaymentMethod.Card: return 'Karta';
      case PaymentMethod.ClubBilling: return 'Na klub';
      case PaymentMethod.BankTransfer: return 'Převod';
      default: return 'Neznámý';
    }
  };

  return (
    <Grid container spacing={3}>
      {/* Dashboard Stats */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>Pokladna - Dnešní přehled</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {formatCurrency(dashboard?.todayRevenue || 0)}
                  </Typography>
                  <Typography color="text.secondary">Dnešní tržba</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4">{dashboard?.transactionsCount || 0}</Typography>
                  <Typography color="text.secondary">Transakcí</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4">{dashboard?.cashTransactions || 0}</Typography>
                  <Typography color="text.secondary">Hotovost</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4">{dashboard?.cardTransactions || 0}</Typography>
                  <Typography color="text.secondary">Karta</Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Quick Actions */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Rychlá platba</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Kategorie služby</InputLabel>
                  <Select value={selectedService} onChange={(e) => setSelectedService(e.target.value)}>
                    <MenuItem value="1">Sportovní prohlídka</MenuItem>
                    <MenuItem value="2">Spiroergometrie</MenuItem>
                    <MenuItem value="3">Konzultace</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Způsob platby</InputLabel>
                  <Select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(Number(e.target.value) as PaymentMethod)}
                  >
                    <MenuItem value={PaymentMethod.Cash}>Hotovost</MenuItem>
                    <MenuItem value={PaymentMethod.Card}>Karta</MenuItem>
                    <MenuItem value={PaymentMethod.ClubBilling}>Na klub</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={!selectedService}
                >
                  Zaplatit
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Recent Transactions */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Dnešní transakce</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Čas</TableCell>
                    <TableCell>Služba</TableCell>
                    <TableCell>Částka</TableCell>
                    <TableCell>Platba</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.slice(0, 10).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{new Date(t.createdAt).toLocaleTimeString('cs-CZ')}</TableCell>
                      <TableCell>Služba</TableCell>
                      <TableCell>{formatCurrency(t.finalPrice)}</TableCell>
                      <TableCell>
                        <Chip
                          label={getPaymentMethodLabel(t.paymentMethod)}
                          size="small"
                        />
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
  );
};
```

---

## INSTRUCTIONS

1. Create all files in the locations specified above
2. Follow the existing code style in the project
3. Use the same patterns (records, factory methods, etc.)
4. Add proper XML documentation
5. Create unit tests for cashier operations
6. Test payment flow end-to-end

**DO NOT:**
- Modify existing files unless necessary
- Add new NuGet packages (use existing ones)
- Change the architecture pattern
- Skip discount audit trail

---

## VERIFICATION

After implementation:
1. Run `dotnet build` - must pass
2. Run `dotnet test` - must pass
3. Test transaction creation
4. Test payment completion
5. Test PPD generation
6. Test refund process
7. Verify dashboard stats
