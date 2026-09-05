# PROMPT 10: ACCOUNTING EXPORT
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

Implement **Accounting Export** for Czech accounting systems.

### Business Rules
1. CSV export for general use
2. XML export for Pohoda accounting system
3. Integration with Money S3
4. VAT reporting
5. Control statement (kontrolní hlášení) preparation

### Export Formats
| Format | Target System | Use Case |
|--------|--------------|----------|
| CSV | General | Manual import |
| XML (Pohoda) | Pohoda | Direct import |
| XML (Money S3) | Money S3 | Direct import |

---

## DOMAIN LAYER

### File: `Accounting/ExportFormat.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Accounting;

public enum ExportFormat
{
    CSV = 0,
    PohodaXml = 1,
    MoneyS3Xml = 2,
    IdokladXml = 3
}

public enum ExportType
{
    Invoices = 0,
    CreditNotes = 1,
    Payments = 2,
    All = 3
}
```

### File: `Accounting/ExportResult.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Accounting;

public class ExportResult
{
    public Guid Id { get; set; }
    public ExportFormat Format { get; set; }
    public ExportType Type { get; set; }
    public DateTime DateFrom { get; set; }
    public DateTime DateTo { get; set; }
    public int RecordCount { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public DateTime ExportedAt { get; set; }
    public string? ExportedBy { get; set; }
}
```

---

## INFRASTRUCTURE LAYER

### File: `Accounting/IAccountingExporter.cs`
```csharp
namespace SportMedical.Diagnostics.Infrastructure.Accounting;

public interface IAccountingExporter
{
    Task<byte[]> ExportInvoicesAsync(DateTime from, DateTime to, ExportFormat format, CancellationToken ct = default);
    Task<byte[]> ExportPaymentsAsync(DateTime from, DateTime to, ExportFormat format, CancellationToken ct = default);
    Task<string> GetFileName(ExportFormat format, ExportType type, DateTime from, DateTime to);
}
```

### File: `Accounting/CsvExporter.cs`
```csharp
using System.Text;
using SportMedical.Diagnostics.Domain.Accounting;

namespace SportMedical.Diagnostics.Infrastructure.Accounting;

public class CsvExporter : IAccountingExporter
{
    public async Task<byte[]> ExportInvoicesAsync(DateTime from, DateTime to, ExportFormat format, CancellationToken ct = default)
    {
        // Implementation for CSV export
        var sb = new StringBuilder();
        sb.AppendLine("Číslo dokladu;Datum vystavení;Odběratel;IČO;DIČ;Základ daně;DPH;Celkem");
        
        // Would fetch from database and format
        // Example row:
        // sb.AppendLine("FA-2026-0001;04.09.2026;FC Sparta Praha;87654321;CZ87654321;92500;19425;111925");
        
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public async Task<byte[]> ExportPaymentsAsync(DateTime from, DateTime to, ExportFormat format, CancellationToken ct = default)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Číslo dokladu;Datum platby;Způsob platby;Částka;Stav");
        
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public Task<string> GetFileName(ExportFormat format, ExportType type, DateTime from, DateTime to)
    {
        var typeName = type switch
        {
            ExportType.Invoices => "faktury",
            ExportType.CreditNotes => "dobropisy",
            ExportType.Payments => "platby",
            _ => "export"
        };
        
        return Task.FromResult($"export_{typeName}_{from:yyyyMMdd}_{to:yyyyMMdd}.csv");
    }
}
```

### File: `Accounting/PohodaXmlExporter.cs`
```csharp
using System.Xml;
using System.Text;
using SportMedical.Diagnostics.Domain.Accounting;

namespace SportMedical.Diagnostics.Infrastructure.Accounting;

public class PohodaXmlExporter : IAccountingExporter
{
    public async Task<byte[]> ExportInvoicesAsync(DateTime from, DateTime to, ExportFormat format, CancellationToken ct = default)
    {
        var settings = new XmlWriterSettings
        {
            Indent = true,
            Encoding = Encoding.UTF8
        };

        using var stream = new MemoryStream();
        using var writer = XmlWriter.Create(stream, settings);

        writer.WriteStartDocument();
        writer.WriteStartElement("data");
        writer.WriteStartElement("import");

        // Header
        writer.WriteStartElement("header");
        writer.WriteElementString("date", DateTime.Now.ToString("yyyy-MM-dd"));
        writer.WriteElementString("order", "1");
        writer.WriteEndElement();

        // Would fetch invoices from database
        // Example invoice:
        writer.WriteStartElement("invoice");
        writer.WriteElementString("number", "FA-2026-0001");
        writer.WriteElementString("date", "2026-09-04");
        writer.WriteElementString("dueDate", "2026-09-18");
        writer.WriteElementString("customerName", "FC Sparta Praha");
        writer.WriteElementString("customerIco", "87654321");
        writer.WriteElementString("customerDic", "CZ87654321");
        writer.WriteElementString("baseAmount", "92500");
        writer.WriteElementString("vatAmount", "19425");
        writer.WriteElementString("totalAmount", "111925");
        writer.WriteElementString("paymentMethod", "bankTransfer");
        writer.WriteEndElement();

        writer.WriteEndElement(); // import
        writer.WriteEndElement(); // data
        writer.WriteEndDocument();

        return stream.ToArray();
    }

    public async Task<byte[]> ExportPaymentsAsync(DateTime from, DateTime to, ExportFormat format, CancellationToken ct = default)
    {
        // Similar implementation for payments
        return Array.Empty<byte>();
    }

    public Task<string> GetFileName(ExportFormat format, ExportType type, DateTime from, DateTime to)
    {
        return Task.FromResult($"pohoda_export_{from:yyyyMMdd}_{to:yyyyMMdd}.xml");
    }
}
```

---

## APPLICATION LAYER

### File: `Accounting/AccountingExportService.cs`
```csharp
using SportMedical.Diagnostics.Domain.Accounting;
using SportMedical.Diagnostics.Infrastructure.Accounting;

namespace SportMedical.Diagnostics.Application.Accounting;

public class AccountingExportService
{
    private readonly IEnumerable<IAccountingExporter> _exporters;
    private readonly IExportRepository _repository;

    public AccountingExportService(
        IEnumerable<IAccountingExporter> exporters,
        IExportRepository repository)
    {
        _exporters = exporters;
        _repository = repository;
    }

    public async Task<ExportResult> ExportAsync(ExportCommand command, CancellationToken ct = default)
    {
        var exporter = GetExporter(command.Format);
        
        var data = command.Type switch
        {
            ExportType.Invoices => await exporter.ExportInvoicesAsync(command.DateFrom, command.DateTo, command.Format, ct),
            ExportType.Payments => await exporter.ExportPaymentsAsync(command.DateFrom, command.DateTo, command.Format, ct),
            _ => throw new ArgumentException("Invalid export type")
        };

        var fileName = await exporter.GetFileName(command.Format, command.Type, command.DateFrom, command.DateTo);
        
        // Save to file system
        var filePath = await SaveExportAsync(data, fileName, ct);

        // Record export
        var result = new ExportResult
        {
            Id = Guid.NewGuid(),
            Format = command.Format,
            Type = command.Type,
            DateFrom = command.DateFrom,
            DateTo = command.DateTo,
            RecordCount = 0, // Would be calculated from data
            FilePath = filePath,
            ExportedAt = DateTime.UtcNow,
            ExportedBy = command.UserId
        };

        await _repository.SaveExportResultAsync(result, ct);

        return result;
    }

    public async Task<byte[]> DownloadExportAsync(Guid exportId, CancellationToken ct = default)
    {
        var result = await _repository.GetExportResultAsync(exportId, ct);
        if (result == null)
            throw new NotFoundException("Export not found");

        return await File.ReadAllBytesAsync(result.FilePath, ct);
    }

    public async Task<List<ExportResult>> GetExportHistoryAsync(CancellationToken ct = default)
    {
        return await _repository.GetExportHistoryAsync(ct);
    }

    private IAccountingExporter GetExporter(ExportFormat format)
    {
        var exporter = _exporters.FirstOrDefault(e => 
            e.GetType().Name.Contains(format.ToString()));
        
        if (exporter == null)
            throw new NotSupportedException($"Export format {format} is not supported");

        return exporter;
    }

    private async Task<string> SaveExportAsync(byte[] data, string fileName, CancellationToken ct)
    {
        var exportsPath = Path.Combine(Directory.GetCurrentDirectory(), "exports");
        Directory.CreateDirectory(exportsPath);
        
        var filePath = Path.Combine(exportsPath, fileName);
        await File.WriteAllBytesAsync(filePath, data, ct);
        
        return filePath;
    }
}

public record ExportCommand(
    ExportFormat Format,
    ExportType Type,
    DateTime DateFrom,
    DateTime DateTo,
    string? UserId = null
);
```

---

## API LAYER

### File: `AccountingExportController.cs`
```csharp
using Microsoft.AspNetCore.Mvc;
using SportMedical.Diagnostics.Application.Accounting;
using SportMedical.Diagnostics.Domain.Accounting;

namespace SportMedical.Diagnostics.Api.Controllers;

[ApiController]
[Route("api/accounting/export")]
public class AccountingExportController : ControllerBase
{
    private readonly AccountingExportService _service;

    public AccountingExportController(AccountingExportService service)
    {
        _service = service;
    }

    [HttpPost]
    public async Task<IActionResult> Export([FromBody] ExportCommand command, CancellationToken ct)
    {
        var result = await _service.ExportAsync(command, ct);
        return Ok(result);
    }

    [HttpGet("{id}/download")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        try
        {
            var data = await _service.DownloadExportAsync(id, ct);
            return File(data, "application/octet-stream", $"export-{id}.xml");
        }
        catch (NotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory(CancellationToken ct)
    {
        var history = await _service.GetExportHistoryAsync(ct);
        return Ok(history);
    }
}
```

---

## FRONTEND

### File: `services/accountingExportApi.ts`
```typescript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export enum ExportFormat {
  CSV = 0,
  PohodaXml = 1,
  MoneyS3Xml = 2,
}

export enum ExportType {
  Invoices = 0,
  CreditNotes = 1,
  Payments = 2,
  All = 3,
}

export interface ExportResult {
  id: string;
  format: ExportFormat;
  type: ExportType;
  dateFrom: string;
  dateTo: string;
  recordCount: number;
  filePath: string;
  exportedAt: string;
}

export const accountingExportApi = {
  export: async (command: {
    format: ExportFormat;
    type: ExportType;
    dateFrom: string;
    dateTo: string;
  }): Promise<ExportResult> => {
    const response = await axios.post(`${API_BASE}/accounting/export`, command);
    return response.data;
  },

  download: async (id: string): Promise<Blob> => {
    const response = await axios.get(`${API_BASE}/accounting/export/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getHistory: async (): Promise<ExportResult[]> => {
    const response = await axios.get(`${API_BASE}/accounting/export/history`);
    return response.data;
  },
};
```

### File: `pages/AccountingExport.tsx`
```tsx
import React, { useState } from 'react';
import {
  Card, CardContent, Typography, Grid, Button, Box, TextField,
  FormControl, InputLabel, Select, MenuItem, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingExportApi, ExportFormat, ExportType, ExportResult } from '../services/accountingExportApi';
import { toast } from 'react-hot-toast';

export const AccountingExportPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [format, setFormat] = useState<ExportFormat>(ExportFormat.PohodaXml);
  const [type, setType] = useState<ExportType>(ExportType.Invoices);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['exportHistory'],
    queryFn: accountingExportApi.getHistory,
  });

  const exportMutation = useMutation({
    mutationFn: accountingExportApi.export,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['exportHistory'] });
      toast.success('Export dokončen');
      // Auto-download
      handleDownload(result.id);
    },
    onError: () => {
      toast.error('Chyba při exportu');
    },
  });

  const handleDownload = async (id: string) => {
    try {
      const blob = await accountingExportApi.download(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${id}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Chyba při stahování');
    }
  };

  const handleExport = () => {
    if (!dateFrom || !dateTo) {
      toast.error('Vyberte období');
      return;
    }

    exportMutation.mutate({
      format,
      type,
      dateFrom,
      dateTo,
    });
  };

  const getFormatLabel = (format: ExportFormat) => {
    switch (format) {
      case ExportFormat.CSV: return 'CSV';
      case ExportFormat.PohodaXml: return 'Pohoda';
      case ExportFormat.MoneyS3Xml: return 'Money S3';
      default: return 'Neznámý';
    }
  };

  const getTypeLabel = (type: ExportType) => {
    switch (type) {
      case ExportType.Invoices: return 'Faktury';
      case ExportType.CreditNotes: return 'Dobropisy';
      case ExportType.Payments: return 'Platby';
      case ExportType.All: return 'Vše';
      default: return 'Neznámý';
    }
  };

  return (
    <Grid container spacing={3}>
      {/* Export Form */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>Účetní export</Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Formát</InputLabel>
                  <Select
                    value={format}
                    onChange={(e) => setFormat(Number(e.target.value) as ExportFormat)}
                    label="Formát"
                  >
                    <MenuItem value={ExportFormat.CSV}>CSV</MenuItem>
                    <MenuItem value={ExportFormat.PohodaXml}>Pohoda XML</MenuItem>
                    <MenuItem value={ExportFormat.MoneyS3Xml}>Money S3 XML</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Typ</InputLabel>
                  <Select
                    value={type}
                    onChange={(e) => setType(Number(e.target.value) as ExportType)}
                    label="Typ"
                  >
                    <MenuItem value={ExportType.Invoices}>Faktury</MenuItem>
                    <MenuItem value={ExportType.CreditNotes}>Dobropisy</MenuItem>
                    <MenuItem value={ExportType.Payments}>Platby</MenuItem>
                    <MenuItem value={ExportType.All}>Vše</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Od"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Do"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={handleExport}
                  disabled={exportMutation.isPending || !dateFrom || !dateTo}
                >
                  {exportMutation.isPending ? 'Exportuji...' : 'Exportovat'}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Export History */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>Historie exportů</Typography>
            
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Datum</TableCell>
                    <TableCell>Formát</TableCell>
                    <TableCell>Typ</TableCell>
                    <TableCell>Období</TableCell>
                    <TableCell>Akce</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell>{new Date(exp.exportedAt).toLocaleString('cs-CZ')}</TableCell>
                      <TableCell>
                        <Chip label={getFormatLabel(exp.format)} size="small" />
                      </TableCell>
                      <TableCell>{getTypeLabel(exp.type)}</TableCell>
                      <TableCell>
                        {new Date(exp.dateFrom).toLocaleDateString('cs-CZ')} - {new Date(exp.dateTo).toLocaleDateString('cs-CZ')}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          onClick={() => handleDownload(exp.id)}
                        >
                          Stáhnout
                        </Button>
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
5. Create unit tests for export logic
6. Test CSV and XML generation

**DO NOT:**
- Modify existing files unless necessary
- Add new NuGet packages (use existing ones)
- Change the architecture pattern
- Skip validation

---

## VERIFICATION

After implementation:
1. Run `dotnet build` - must pass
2. Run `dotnet test` - must pass
3. Test CSV export
4. Test Pohoda XML export
5. Verify XML structure
6. Test download functionality
