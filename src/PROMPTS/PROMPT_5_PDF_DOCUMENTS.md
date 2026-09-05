# PROMPT 5: PDF GENERATION & DOCUMENTS
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

Implement **PDF Generation** for Czech accounting documents (PPD, Invoices).

### Business Rules (Czech Legislation § 563/1991 Sb., § 235/2004 Sb.)
1. PPD (Příjmový pokladní doklad) - Cash receipt
2. Invoice (Faktura) - For club/corporate clients
3. Must contain all mandatory fields per § 11
4. Company header with logo
5. Patient/customer details
6. Line items with VAT breakdown
7. Legal footer text
8. Czech formatting (dates, currency)

### Document Types
| Code | Name | Required Fields |
|------|------|-----------------|
| PPD | Příjmový pokladní doklad | Number, Date, Patient, Amount, Payment Method |
| FA | Faktura | Number, Date, Due Date, Customer, Items, VAT |

---

## DOMAIN LAYER

### File: `Documents/DocumentType.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Documents;

public enum DocumentType
{
    PPD = 0,        // Příjmový pokladní doklad
    Invoice = 1,    // Faktura
    CreditNote = 2, // Dobropis
    Proforma = 3    // Proforma faktura
}
```

### File: `Documents/Document.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Documents;

public class Document
{
    public Guid Id { get; private set; }
    public DocumentType Type { get; private set; }
    public string Number { get; private set; } = string.Empty;
    public DateTime IssueDate { get; private set; }
    public DateTime DuZp { get; private set; } // Datum uskutečnění plnění
    public DateTime? DueDate { get; private set; }
    
    // Supplier (our company)
    public string SupplierName { get; private set; } = string.Empty;
    public string SupplierIco { get; private set; } = string.Empty;
    public string? SupplierDic { get; private set; }
    public string SupplierAddress { get; private set; } = string.Empty;
    
    // Customer
    public string CustomerName { get; private set; } = string.Empty;
    public string? CustomerIco { get; private set; }
    public string? CustomerDic { get; private set; }
    public string? CustomerAddress { get; private set; }
    
    // Financial
    public decimal BaseAmount { get; private set; }
    public decimal VatRate { get; private set; }
    public decimal VatAmount { get; private set; }
    public decimal TotalAmount { get; private set; }
    public string Currency { get; private set; } = "CZK";
    
    // Payment
    public string? PaymentMethod { get; private set; }
    public string? BankAccount { get; private set; }
    public string? BankCode { get; private set; }
    public string? Iban { get; private set; }
    public string? VariableSymbol { get; private set; }
    
    // Related entities
    public Guid? PatientId { get; private set; }
    public Guid? BookingId { get; private set; }
    public Guid? ClubId { get; private set; }
    
    // Status
    public DocumentStatus Status { get; private set; } = DocumentStatus.Draft;
    public string? PdfPath { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? SentAt { get; private set; }

    public static Document CreateInvoice(string number, DateTime issueDate, DateTime dueDate)
    {
        return new Document
        {
            Id = Guid.NewGuid(),
            Type = DocumentType.Invoice,
            Number = number,
            IssueDate = issueDate,
            DuZp = issueDate,
            DueDate = dueDate,
            CreatedAt = DateTime.UtcNow
        };
    }

    public static Document CreatePPD(string number, DateTime issueDate)
    {
        return new Document
        {
            Id = Guid.NewGuid(),
            Type = DocumentType.PPD,
            Number = number,
            IssueDate = issueDate,
            DuZp = issueDate,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void AddLineItem(string description, decimal quantity, decimal unitPrice, decimal vatRate)
    {
        var baseAmount = quantity * unitPrice;
        var vat = baseAmount * (vatRate / 100);
        
        BaseAmount += baseAmount;
        VatAmount += vat;
        TotalAmount += baseAmount + vat;
        VatRate = vatRate; // Simplified - in real impl, handle multiple rates
    }

    public void SetSupplier(string name, string ico, string? dic, string address)
    {
        SupplierName = name;
        SupplierIco = ico;
        SupplierDic = dic;
        SupplierAddress = address;
    }

    public void SetCustomer(string name, string? ico, string? dic, string? address)
    {
        CustomerName = name;
        CustomerIco = ico;
        CustomerDic = dic;
        CustomerAddress = address;
    }

    public void MarkAsSent(string pdfPath)
    {
        Status = DocumentStatus.Sent;
        PdfPath = pdfPath;
        SentAt = DateTime.UtcNow;
    }
}

public enum DocumentStatus
{
    Draft = 0,
    Sent = 1,
    Paid = 2,
    Overdue = 3,
    Cancelled = 4
}
```

### File: `Documents/DocumentLineItem.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Documents;

public class DocumentLineItem
{
    public Guid Id { get; private set; }
    public Guid DocumentId { get; private set; }
    public int Order { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public string? Unit { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal VatRate { get; private set; }
    public decimal BaseAmount => Quantity * UnitPrice;
    public decimal VatAmount => BaseAmount * (VatRate / 100);
    public decimal TotalAmount => BaseAmount + VatAmount;

    public static DocumentLineItem Create(int order, string description, decimal quantity, 
        decimal unitPrice, decimal vatRate, string? unit = null)
    {
        return new DocumentLineItem
        {
            Id = Guid.NewGuid(),
            Order = order,
            Description = description,
            Unit = unit,
            Quantity = quantity,
            UnitPrice = unitPrice,
            VatRate = vatRate
        };
    }
}
```

---

## INFRASTRUCTURE LAYER

### File: `Pdf/IPdfGenerator.cs`
```csharp
namespace SportMedical.Diagnostics.Infrastructure.Pdf;

public interface IPdfGenerator
{
    Task<byte[]> GenerateDocumentPdfAsync(Domain.Documents.Document document, CancellationToken ct = default);
    Task<string> SavePdfToFileAsync(byte[] pdfBytes, string fileName, CancellationToken ct = default);
}
```

### File: `Pdf/PdfGenerator.cs`
```csharp
using SportMedical.Diagnostics.Domain.Documents;

namespace SportMedical.Diagnostics.Infrastructure.Pdf;

public class PdfGenerator : IPdfGenerator
{
    private readonly IWebHostEnvironment _environment;

    public PdfGenerator(IWebHostEnvironment environment)
    {
        _environment = environment;
    }

    public async Task<byte[]> GenerateDocumentPdfAsync(Document document, CancellationToken ct = default)
    {
        // Use a PDF library like QuestPDF, iTextSharp, or PdfSharpCore
        // This is a simplified example using QuestPDF
        
        // var document = QuestPDF.Fluent.Document.Create(container =>
        // {
        //     container.Page(page =>
        //     {
        //         page.Size(PageSizes.A4);
        //         page.Margin(30);
        //         
        //         page.Header().Element(header =>
        //         {
        //             header.Row(row =>
        //             {
        //                 row.RelativeItem(2).Column(col =>
        //                 {
        //                     col.Item().Text(document.SupplierName).Bold().FontSize(14);
        //                     col.Item().Text(document.SupplierAddress);
        //                     col.Item().Text($"IČO: {document.SupplierIco}");
        //                     if (!string.IsNullOrEmpty(document.SupplierDic))
        //                         col.Item().Text($"DIČ: {document.SupplierDic}");
        //                 });
        //                 
        //                 row.RelativeItem().Column(col =>
        //                 {
        //                     col.Item().Text(document.Type.ToString()).Bold().FontSize(16);
        //                     col.Item().Text($"č. {document.Number}");
        //                     col.Item().Text($"Datum vystavení: {document.IssueDate:dd.MM.yyyy}");
        //                 });
        //             });
        //         });
        //         
        //         page.Content().Element(content =>
        //         {
        //             // Customer section
        //             content.PaddingVertical(10).Row(row =>
        //             {
        //                 row.RelativeItem(2).Column(col =>
        //                 {
        //                     col.Item().Text("Odběratel:").Bold();
        //                     col.Item().Text(document.CustomerName);
        //                     if (!string.IsNullOrEmpty(document.CustomerAddress))
        //                         col.Item().Text(document.CustomerAddress);
        //                 });
        //             });
        //             
        //             // Line items table
        //             content.Table(table =>
        //             {
        //                 table.ColumnsDefinition(columns =>
        //                 {
        //                     columns.RelativeColumn(); // Description
        //                     columns.ConstantColumn(60); // Quantity
        //                     columns.ConstantColumn(80); // Unit Price
        //                     columns.ConstantColumn(80); // Base Amount
        //                     columns.ConstantColumn(60); // VAT Rate
        //                     columns.ConstantColumn(80); // VAT Amount
        //                     columns.ConstantColumn(80); // Total
        //                 });
        //                 
        //                 // Header
        //                 table.Header(header =>
        //                 {
        //                     header.Cell().Text("Popis").Bold();
        //                     header.Cell().Text("Množství").Bold();
        //                     header.Cell().Text("Cena za MJ").Bold();
        //                     header.Cell().Text("Základ").Bold();
        //                     header.Cell().Text("DPH %").Bold();
        //                     header.Cell().Text("DPH").Bold();
        //                     header.Cell().Text("Celkem").Bold();
        //                 });
        //                 
        //                 // Rows would be added from document.LineItems
        //             });
        //             
        //             // Totals
        //             content.Row(row =>
        //             {
        //                 row.RelativeItem();
        //                 row.ConstantItem(200).Column(col =>
        //                 {
        //                     col.Item().Text($"Základ daně: {document.BaseAmount:N2} Kč").Bold();
        //                     col.Item().Text($"DPH ({document.VatRate}%): {document.VatAmount:N2} Kč").Bold();
        //                     col.Item().Text($"Celkem k úhradě: {document.TotalAmount:N2} Kč").Bold().FontSize(14);
        //                 });
        //             });
        //         });
        //         
        //         page.Footer().Element(footer =>
        //         {
        //             footer.Row(row =>
        //             {
        //                 row.RelativeItem().Column(col =>
        //                 {
        //                     col.Item().Text("Bankovní spojení:").Bold();
        //                     col.Item().Text($"{document.BankAccount}/{document.BankCode}");
        //                     if (!string.IsNullOrEmpty(document.Iban))
        //                         col.Item().Text($"IBAN: {document.Iban}");
        //                     if (!string.IsNullOrEmpty(document.VariableSymbol))
        //                         col.Item().Text($"Variabilní symbol: {document.VariableSymbol}");
        //                 });
        //                 
        //                 row.RelativeItem().AlignRight().Column(col =>
        //                 {
        //                     col.Item().Text($"Splatnost: {document.DueDate:dd.MM.yyyy}");
        //                 });
        //             });
        //             
        //             footer.AlignCenter().Text("Tento doklad byl vygenerován elektronicky.");
        //         });
        //     });
        // });
        //
        // return document.GeneratePdf();

        // Placeholder - implement with your preferred PDF library
        return await Task.FromResult(Array.Empty<byte>());
    }

    public async Task<string> SavePdfToFileAsync(byte[] pdfBytes, string fileName, CancellationToken ct = default)
    {
        var uploadsPath = Path.Combine(_environment.WebRootPath, "uploads", "documents");
        Directory.CreateDirectory(uploadsPath);
        
        var filePath = Path.Combine(uploadsPath, fileName);
        await File.WriteAllBytesAsync(filePath, pdfBytes, ct);
        
        return $"/uploads/documents/{fileName}";
    }
}
```

---

## APPLICATION LAYER

### File: `Documents/DocumentService.cs`
```csharp
using SportMedical.Diagnostics.Domain.Documents;
using SportMedical.Diagnostics.Infrastructure.Pdf;

namespace SportMedical.Diagnostics.Application.Documents;

public class DocumentService
{
    private readonly IDocumentRepository _repository;
    private readonly IPdfGenerator _pdfGenerator;
    private readonly ICompanySettingsRepository _settingsRepository;

    public DocumentService(
        IDocumentRepository repository,
        IPdfGenerator pdfGenerator,
        ICompanySettingsRepository settingsRepository)
    {
        _repository = repository;
        _pdfGenerator = pdfGenerator;
        _settingsRepository = settingsRepository;
    }

    public async Task<Document> CreateInvoiceAsync(CreateInvoiceCommand command, CancellationToken ct = default)
    {
        var settings = await _settingsRepository.GetAsync(ct);
        if (settings == null)
            throw new InvalidOperationException("Company settings not configured");

        var number = await GetNextNumberAsync(DocumentType.Invoice, ct);
        
        var document = Document.CreateInvoice(number, DateTime.UtcNow, command.DueDate);
        
        // Set supplier from settings
        document.SetSupplier(
            settings.CompanyName,
            settings.Ico,
            settings.Dic,
            $"{settings.Address}, {settings.PostalCode} {settings.City}");
        
        // Set customer
        document.SetCustomer(
            command.CustomerName,
            command.CustomerIco,
            command.CustomerDic,
            command.CustomerAddress);
        
        // Set payment details
        document.SetPayment(command.BankAccount, command.BankCode, command.Iban, command.VariableSymbol);
        
        // Add line items
        foreach (var item in command.Items)
        {
            document.AddLineItem(item.Description, item.Quantity, item.UnitPrice, item.VatRate);
        }

        return await _repository.CreateAsync(document, ct);
    }

    public async Task<Document> CreatePPDAsync(CreatePPDCommand command, CancellationToken ct = default)
    {
        var settings = await _settingsRepository.GetAsync(ct);
        if (settings == null)
            throw new InvalidOperationException("Company settings not configured");

        var number = await GetNextNumberAsync(DocumentType.PPD, ct);
        
        var document = Document.CreatePPD(number, DateTime.UtcNow);
        
        document.SetSupplier(
            settings.CompanyName,
            settings.Ico,
            settings.Dic,
            $"{settings.Address}, {settings.PostalCode} {settings.City}");
        
        document.SetCustomer(
            command.PatientName,
            null, null, null);
        
        document.AddLineItem(command.Description, 1, command.Amount, command.VatRate);

        return await _repository.CreateAsync(document, ct);
    }

    public async Task<byte[]> GeneratePdfAsync(Guid documentId, CancellationToken ct = default)
    {
        var document = await _repository.GetByIdAsync(documentId, ct);
        if (document == null)
            throw new NotFoundException("Document not found");

        return await _pdfGenerator.GenerateDocumentPdfAsync(document, ct);
    }

    public async Task<string> GenerateAndSavePdfAsync(Guid documentId, CancellationToken ct = default)
    {
        var pdfBytes = await GeneratePdfAsync(documentId, ct);
        var fileName = $"{document.Type}_{document.Number}.pdf";
        var path = await _pdfGenerator.SavePdfToFileAsync(pdfBytes, fileName, ct);
        
        document.MarkAsSent(path);
        await _repository.UpdateAsync(document, ct);
        
        return path;
    }

    private async Task<string> GetNextNumberAsync(DocumentType type, CancellationToken ct)
    {
        // Use the NumberSeries system from Prompt 1
        var prefix = type switch
        {
            DocumentType.Invoice => "FA",
            DocumentType.PPD => "PPD",
            DocumentType.CreditNote => "DO",
            DocumentType.Proforma => "ZL",
            _ => "DOC"
        };
        
        var year = DateTime.UtcNow.Year;
        return $"{prefix}-{year}-{DateTime.UtcNow.Ticks % 10000:D4}";
    }
}

public record CreateInvoiceCommand(
    DateTime DueDate,
    string CustomerName,
    string? CustomerIco,
    string? CustomerDic,
    string? CustomerAddress,
    string? BankAccount,
    string? BankCode,
    string? Iban,
    string? VariableSymbol,
    List<LineItemDto> Items
);

public record CreatePPDCommand(
    string PatientName,
    string Description,
    decimal Amount,
    decimal VatRate
);

public record LineItemDto(
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal VatRate
);
```

---

## API LAYER

### File: `DocumentsController.cs`
```csharp
using Microsoft.AspNetCore.Mvc;
using SportMedical.Diagnostics.Application.Documents;

namespace SportMedical.Diagnostics.Api.Controllers;

[ApiController]
[Route("api/documents")]
public class DocumentsController : ControllerBase
{
    private readonly DocumentService _service;

    public DocumentsController(DocumentService service)
    {
        _service = service;
    }

    [HttpPost("invoices")]
    public async Task<IActionResult> CreateInvoice([FromBody] CreateInvoiceCommand command, CancellationToken ct)
    {
        var document = await _service.CreateInvoiceAsync(command, ct);
        return CreatedAtAction(nameof(GetById), new { id = document.Id }, document);
    }

    [HttpPost("ppd")]
    public async Task<IActionResult> CreatePPD([FromBody] CreatePPDCommand command, CancellationToken ct)
    {
        var document = await _service.CreatePPDAsync(command, ct);
        return CreatedAtAction(nameof(GetById), new { id = document.Id }, document);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        // Implementation
        return Ok();
    }

    [HttpGet("{id}/pdf")]
    public async Task<IActionResult> GetPdf(Guid id, CancellationToken ct)
    {
        try
        {
            var pdfBytes = await _service.GeneratePdfAsync(id, ct);
            return File(pdfBytes, "application/pdf", $"document-{id}.pdf");
        }
        catch (NotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("{id}/pdf/save")]
    public async Task<IActionResult> SavePdf(Guid id, CancellationToken ct)
    {
        try
        {
            var path = await _service.GenerateAndSavePdfAsync(id, ct);
            return Ok(new { PdfPath = path });
        }
        catch (NotFoundException)
        {
            return NotFound();
        }
    }
}
```

---

## FRONTEND

### File: `services/documentsApi.ts`
```typescript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface CreateInvoiceData {
  dueDate: string;
  customerName: string;
  customerIco?: string;
  customerDic?: string;
  customerAddress?: string;
  bankAccount?: string;
  bankCode?: string;
  iban?: string;
  variableSymbol?: string;
  items: LineItem[];
}

export interface CreatePPDData {
  patientName: string;
  description: string;
  amount: number;
  vatRate: number;
}

export interface Document {
  id: string;
  type: number;
  number: string;
  issueDate: string;
  customerName: string;
  totalAmount: number;
  status: number;
  pdfPath?: string;
}

export const documentsApi = {
  createInvoice: async (data: CreateInvoiceData): Promise<Document> => {
    const response = await axios.post(`${API_BASE}/documents/invoices`, data);
    return response.data;
  },

  createPPD: async (data: CreatePPDData): Promise<Document> => {
    const response = await axios.post(`${API_BASE}/documents/ppd`, data);
    return response.data;
  },

  getById: async (id: string): Promise<Document> => {
    const response = await axios.get(`${API_BASE}/documents/${id}`);
    return response.data;
  },

  downloadPdf: async (id: string): Promise<Blob> => {
    const response = await axios.get(`${API_BASE}/documents/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  savePdf: async (id: string): Promise<{ pdfPath: string }> => {
    const response = await axios.post(`${API_BASE}/documents/${id}/pdf/save`);
    return response.data;
  },
};
```

### File: `components/InvoiceForm.tsx`
```tsx
import React, { useState } from 'react';
import {
  Card, CardContent, Typography, TextField, Button, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Box, Divider
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { documentsApi, LineItem, CreateInvoiceData } from '../services/documentsApi';
import { toast } from 'react-hot-toast';

interface InvoiceFormProps {
  onSuccess?: () => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<CreateInvoiceData>({
    dueDate: '',
    customerName: '',
    customerIco: '',
    customerDic: '',
    customerAddress: '',
    bankAccount: '',
    bankCode: '',
    iban: '',
    variableSymbol: '',
    items: [{ description: '', quantity: 1, unitPrice: 0, vatRate: 21 }],
  });

  const createMutation = useMutation({
    mutationFn: documentsApi.createInvoice,
    onSuccess: () => {
      toast.success('Faktura vytvořena');
      onSuccess?.();
    },
    onError: () => {
      toast.error('Chyba při vytváření faktury');
    },
  });

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, unitPrice: 0, vatRate: 21 }],
    });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotals = () => {
    const baseAmount = formData.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const vatAmount = formData.items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.vatRate / 100), 0);
    return { baseAmount, vatAmount, totalAmount: baseAmount + vatAmount };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const { baseAmount, vatAmount, totalAmount } = calculateTotals();

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Nová faktura
        </Typography>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Customer Info */}
            <Grid item xs={12}>
              <Typography variant="h6">Odběratel</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Název firmy"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="IČO"
                value={formData.customerIco}
                onChange={(e) => setFormData({ ...formData, customerIco: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="DIČ"
                value={formData.customerDic}
                onChange={(e) => setFormData({ ...formData, customerDic: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Adresa"
                value={formData.customerAddress}
                onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
              />
            </Grid>

            {/* Payment Info */}
            <Grid item xs={12}>
              <Typography variant="h6">Platební údaje</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Číslo účtu"
                value={formData.bankAccount}
                onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Kód banky"
                value={formData.bankCode}
                onChange={(e) => setFormData({ ...formData, bankCode: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="IBAN"
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Variabilní symbol"
                value={formData.variableSymbol}
                onChange={(e) => setFormData({ ...formData, variableSymbol: e.target.value })}
              />
            </Grid>

            {/* Line Items */}
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Položky</Typography>
                <Button startIcon={<AddIcon />} onClick={addItem}>
                  Přidat položku
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Popis</TableCell>
                      <TableCell width={100}>Množství</TableCell>
                      <TableCell width={120}>Cena za MJ</TableCell>
                      <TableCell width={80}>DPH %</TableCell>
                      <TableCell width={120}>Celkem</TableCell>
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
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={item.vatRate}
                            onChange={(e) => updateItem(index, 'vatRate', Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          {(item.quantity * item.unitPrice).toFixed(2)} Kč
                        </TableCell>
                        <TableCell>
                          <IconButton onClick={() => removeItem(index)} size="small">
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            {/* Totals */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box display="flex" justifyContent="flex-end">
                <Box textAlign="right">
                  <Typography>Základ daně: {baseAmount.toFixed(2)} Kč</Typography>
                  <Typography>DPH: {vatAmount.toFixed(2)} Kč</Typography>
                  <Typography variant="h6">Celkem: {totalAmount.toFixed(2)} Kč</Typography>
                </Box>
              </Box>
            </Grid>

            {/* Due Date */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="date"
                label="Splatnost"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>

            {/* Submit */}
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Vytváření...' : 'Vytvořit fakturu'}
              </Button>
            </Grid>
          </Grid>
        </form>
      </CardContent>
    </Card>
  );
};
```

---

## INSTRUCTIONS

1. Create all files in the locations specified above
2. Follow the existing code style in the project
3. Use the same patterns (records, factory methods, etc.)
4. Add proper XML documentation
5. Create unit tests for document creation
6. Create integration tests for PDF generation
7. Choose a PDF library (QuestPDF recommended for .NET)

**Required NuGet Package:**
```xml
<PackageReference Include="QuestPDF" Version="2024.3.0" />
```

**DO NOT:**
- Modify existing files unless necessary
- Change the architecture pattern
- Skip validation

---

## VERIFICATION

After implementation:
1. Run `dotnet build` - must pass
2. Run `dotnet test` - must pass
3. Create test invoice via API
4. Generate PDF and verify content
5. Verify Czech formatting (dates, currency)
