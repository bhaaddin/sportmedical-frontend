# PROMPT 1: NUMBER SERIES SYSTEM (Číselné řady)
## For: SportMedical.Diagnostics (.NET 10 / React 19)

---

## CONTEXT

You are working on **SportMedical.Diagnostics**, a medical diagnostics platform.

**Tech Stack:**
- Backend: .NET 10 / C# 14 / ASP.NET Core / Entity Framework Core
- Frontend: React 19 / TypeScript / MUI / React Query / Zustand
- Database: PostgreSQL (production) / SQLite (local)

**Architecture:** Clean Architecture with Domain, Application, Infrastructure, Persistence layers.

**Existing Code Location:**
- Backend: `SportMedical.Diagnostics/src/`
- Frontend: `sportmedical-frontend/src/`

---

## REQUIREMENT

Implement a **Number Series System** (Číselné řady) for generating unique, sequential document numbers.

### Business Rules (Czech Legislation § 563/1991 Sb.)
1. Number series must be **continuous and unique** per type per year
2. Format: `{PREFIX}-{YEAR}-{COUNTER:0000}` (e.g., `PPD-2026-0001`)
3. Counter resets each year
4. Race condition protection required (concurrent access)
5. Audit trail for number assignment

### Document Types
| Code | Name | Prefix |
|------|------|--------|
| PPD | Příjmový pokladní doklad | PPD |
| FA | Faktura | FA |
| DO | Dobropis | DO |
| ZL | Zálohový list | ZL |

---

## DOMAIN LAYER (Create in `SportMedical.Diagnostics.Domain`)

### File: `NumberSeries/NumberSeries.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.NumberSeries;

public class NumberSeries
{
    public Guid Id { get; private set; }
    public string DocumentType { get; private set; } = string.Empty;
    public string Prefix { get; private set; } = string.Empty;
    public int Year { get; private set; }
    public int Counter { get; private set; }
    public int Padding { get; private set; } = 4;
    public bool IsActive { get; private set; } = true;
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    // Factory method
    public static NumberSeries Create(string documentType, string prefix, int year, int padding = 4)
    {
        return new NumberSeries
        {
            Id = Guid.NewGuid(),
            DocumentType = documentType,
            Prefix = prefix,
            Year = year,
            Counter = 0,
            Padding = padding,
            CreatedAt = DateTime.UtcNow
        };
    }

    // Generate next number
    public string GenerateNext()
    {
        Counter++;
        UpdatedAt = DateTime.UtcNow;
        return $"{Prefix}-{Year}-{Counter.ToString().PadLeft(Padding, '0')}";
    }

    // Get current number without incrementing
    public string PeekNext()
    {
        return $"{Prefix}-{Year}-{(Counter + 1).ToString().PadLeft(Padding, '0')}";
    }
}
```

### File: `NumberSeries/INumberSeriesRepository.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.NumberSeries;

public interface INumberSeriesRepository
{
    Task<NumberSeries?> GetByTypeAndYearAsync(string documentType, int year, CancellationToken ct = default);
    Task<NumberSeries> CreateAsync(NumberSeries series, CancellationToken ct = default);
    Task UpdateAsync(NumberSeries series, CancellationToken ct = default);
    Task<bool> ExistsAsync(string documentType, int year, CancellationToken ct = default);
}
```

### File: `NumberSeries/NumberSeriesEntry.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.NumberSeries;

/// <summary>
/// Audit log entry for number assignment
/// </summary>
public class NumberSeriesEntry
{
    public Guid Id { get; private set; }
    public string DocumentType { get; private set; } = string.Empty;
    public string AssignedNumber { get; private set; } = string.Empty;
    public Guid? DocumentId { get; private set; }
    public Guid? AssignedByUserId { get; private set; }
    public DateTime AssignedAt { get; private set; }

    public static NumberSeriesEntry Create(string documentType, string assignedNumber, Guid? documentId, Guid? userId)
    {
        return new NumberSeriesEntry
        {
            Id = Guid.NewGuid(),
            DocumentType = documentType,
            AssignedNumber = assignedNumber,
            DocumentId = documentId,
            AssignedByUserId = userId,
            AssignedAt = DateTime.UtcNow
        };
    }
}
```

---

## APPLICATION LAYER (Create in `SportMedical.Diagnostics.Application`)

### File: `NumberSeries/NumberSeriesService.cs`
```csharp
using SportMedical.Diagnostics.Domain.NumberSeries;

namespace SportMedical.Diagnostics.Application.NumberSeries;

public class NumberSeriesService
{
    private readonly INumberSeriesRepository _repository;

    public NumberSeriesService(INumberSeriesRepository repository)
    {
        _repository = repository;
    }

    /// <summary>
    /// Get next number for document type with concurrency protection
    /// Uses database-level locking to prevent race conditions
    /// </summary>
    public async Task<string> GetNextNumberAsync(string documentType, CancellationToken ct = default)
    {
        var year = DateTime.UtcNow.Year;
        
        // Get or create series for this type and year
        var series = await _repository.GetByTypeAndYearAsync(documentType, year, ct);
        
        if (series == null)
        {
            var prefix = GetPrefixForType(documentType);
            series = NumberSeries.Create(documentType, prefix, year);
            await _repository.CreateAsync(series, ct);
        }

        // Generate next number (thread-safe via repository lock)
        var nextNumber = series.GenerateNext();
        await _repository.UpdateAsync(series, ct);

        return nextNumber;
    }

    /// <summary>
    /// Preview next number without incrementing
    /// </summary>
    public async Task<string> PeekNextNumberAsync(string documentType, CancellationToken ct = default)
    {
        var year = DateTime.UtcNow.Year;
        var series = await _repository.GetByTypeAndYearAsync(documentType, year, ct);
        
        if (series == null)
        {
            var prefix = GetPrefixForType(documentType);
            return $"{prefix}-{year}-0001";
        }

        return series.PeekNext();
    }

    private static string GetPrefixForType(string documentType) => documentType switch
    {
        "PPD" => "PPD",
        "FA" => "FA",
        "DO" => "DO",
        "ZL" => "ZL",
        _ => "DOC"
    };
}
```

### File: `NumberSeries/GetNextNumberQuery.cs`
```csharp
namespace SportMedical.Diagnostics.Application.NumberSeries;

public record GetNextNumberQuery(string DocumentType);
public record PeekNextNumberQuery(string DocumentType);
```

---

## PERSISTENCE LAYER (Create in `SportMedical.Diagnostics.Persistence`)

### File: `NumberSeriesRepository.cs`
```csharp
using Microsoft.EntityFrameworkCore;
using SportMedical.Diagnostics.Domain.NumberSeries;

namespace SportMedical.Diagnostics.Persistence;

public class NumberSeriesRepository : INumberSeriesRepository
{
    private readonly DbContext _context;

    public NumberSeriesRepository(DbContext context)
    {
        _context = context;
    }

    public async Task<NumberSeries?> GetByTypeAndYearAsync(string documentType, int year, CancellationToken ct = default)
    {
        return await _context.Set<NumberSeries>()
            .FirstOrDefaultAsync(s => s.DocumentType == documentType && s.Year == year, ct);
    }

    public async Task<NumberSeries> CreateAsync(NumberSeries series, CancellationToken ct = default)
    {
        _context.Set<NumberSeries>().Add(series);
        await _context.SaveChangesAsync(ct);
        return series;
    }

    public async Task UpdateAsync(NumberSeries series, CancellationToken ct = default)
    {
        _context.Set<NumberSeries>().Update(series);
        await _context.SaveChangesAsync(ct);
    }

    public async Task<bool> ExistsAsync(string documentType, int year, CancellationToken ct = default)
    {
        return await _context.Set<NumberSeries>()
            .AnyAsync(s => s.DocumentType == documentType && s.Year == year, ct);
    }
}
```

---

## API LAYER (Create in `SportMedical.Diagnostics.Api/Controllers`)

### File: `NumberSeriesController.cs`
```csharp
using Microsoft.AspNetCore.Mvc;
using SportMedical.Diagnostics.Application.NumberSeries;

namespace SportMedical.Diagnostics.Api.Controllers;

[ApiController]
[Route("api/number-series")]
public class NumberSeriesController : ControllerBase
{
    private readonly NumberSeriesService _service;

    public NumberSeriesController(NumberSeriesService service)
    {
        _service = service;
    }

    [HttpGet("next/{documentType}")]
    public async Task<IActionResult> GetNextNumber(string documentType, CancellationToken ct)
    {
        var number = await _service.GetNextNumberAsync(documentType, ct);
        return Ok(new { Number = number, DocumentType = documentType });
    }

    [HttpGet("peek/{documentType}")]
    public async Task<IActionResult> PeekNextNumber(string documentType, CancellationToken ct)
    {
        var number = await _service.PeekNextNumberAsync(documentType, ct);
        return Ok(new { Number = number, DocumentType = documentType });
    }
}
```

---

## FRONTEND (Create in `sportmedical-frontend/src`)

### File: `services/numberSeriesApi.ts`
```typescript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface NumberSeriesResponse {
  number: string;
  documentType: string;
}

export const numberSeriesApi = {
  getNextNumber: async (documentType: string): Promise<NumberSeriesResponse> => {
    const response = await axios.get(`${API_BASE}/number-series/next/${documentType}`);
    return response.data;
  },

  peekNextNumber: async (documentType: string): Promise<NumberSeriesResponse> => {
    const response = await axios.get(`${API_BASE}/number-series/peek/${documentType}`);
    return response.data;
  },
};
```

### File: `components/NumberSeriesPreview.tsx`
```tsx
import React, { useEffect, useState } from 'react';
import { Typography, Chip, Box } from '@mui/material';
import { numberSeriesApi } from '../services/numberSeriesApi';

interface NumberSeriesPreviewProps {
  documentType: string;
  showLabel?: boolean;
}

export const NumberSeriesPreview: React.FC<NumberSeriesPreviewProps> = ({
  documentType,
  showLabel = true,
}) => {
  const [nextNumber, setNextNumber] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNext = async () => {
      try {
        const response = await numberSeriesApi.peekNextNumber(documentType);
        setNextNumber(response.number);
      } catch (error) {
        console.error('Failed to fetch next number:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchNext();
  }, [documentType]);

  if (loading) return <Typography variant="caption">Načítání...</Typography>;

  return (
    <Box display="flex" alignItems="center" gap={1}>
      {showLabel && (
        <Typography variant="caption" color="text.secondary">
          Další číslo:
        </Typography>
      )}
      <Chip label={nextNumber} size="small" color="primary" variant="outlined" />
    </Box>
  );
};
```

---

## DATABASE MIGRATION

Add to your DbContext:
```csharp
public DbSet<NumberSeries> NumberSeries => Set<NumberSeries>();
public DbSet<NumberSeriesEntry> NumberSeriesEntries => Set<NumberSeriesEntry>();
```

Create migration:
```bash
dotnet ef migrations add AddNumberSeries --project SportMedical.Diagnostics.Persistence
```

---

## INSTRUCTIONS

1. Create all files in the locations specified above
2. Follow the existing code style in the project
3. Use the same patterns (records, factory methods, etc.)
4. Add proper XML documentation
5. Create unit tests in `SportMedical.Diagnostics.Tests`
6. Create integration tests for race condition protection

**DO NOT:**
- Modify existing files unless necessary
- Add new NuGet packages (use existing ones)
- Change the architecture pattern
- Skip the audit trail

---

## VERIFICATION

After implementation:
1. Run `dotnet build` - must pass
2. Run `dotnet test` - must pass
3. Verify API endpoints work with curl/Postman
4. Verify frontend components render correctly
