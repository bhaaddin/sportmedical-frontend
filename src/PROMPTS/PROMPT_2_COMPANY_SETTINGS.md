# PROMPT 2: COMPANY SETTINGS & ARES INTEGRATION
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

Implement **Company Settings** with **ARES integration** (Czech Business Registry lookup).

### Business Rules
1. Store company details: IČO, DIČ, name, address, bank account, logo
2. Validate IČO (8 digits) and DIČ (CZ + 8-10 digits)
3. ARES lookup for auto-fill company details from IČO
4. Cache ARES results for 24 hours
5. Fallback to manual entry if ARES fails

### ARES API
- Endpoint: `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}`
- Returns: Company name, address, legal form, DIČ
- Rate limit: 100 requests/day

---

## DOMAIN LAYER

### File: `Settings/CompanySettings.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Settings;

public class CompanySettings
{
    public Guid Id { get; private set; }
    public string CompanyName { get; private set; } = string.Empty;
    public string Ico { get; private set; } = string.Empty;
    public string? Dic { get; private set; }
    public string? Address { get; private set; }
    public string? City { get; private set; }
    public string? PostalCode { get; private set; }
    public string? BankAccount { get; private set; }
    public string? BankCode { get; private set; }
    public string? Iban { get; private set; }
    public string? LogoPath { get; private set; }
    public string? Phone { get; private set; }
    public string? Email { get; private set; }
    public string? Website { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public static CompanySettings Create(string companyName, string ico)
    {
        return new CompanySettings
        {
            Id = Guid.NewGuid(),
            CompanyName = companyName,
            Ico = ico,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Update(string companyName, string ico, string? dic, string? address, 
        string? city, string? postalCode, string? bankAccount, string? bankCode, 
        string? iban, string? phone, string? email, string? website)
    {
        CompanyName = companyName;
        Ico = ico;
        Dic = dic;
        Address = address;
        City = city;
        PostalCode = postalCode;
        BankAccount = bankAccount;
        BankCode = bankCode;
        Iban = iban;
        Phone = phone;
        Email = email;
        Website = website;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetLogo(string logoPath)
    {
        LogoPath = logoPath;
        UpdatedAt = DateTime.UtcNow;
    }
}
```

### File: `Settings/ICompanySettingsRepository.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Settings;

public interface ICompanySettingsRepository
{
    Task<CompanySettings?> GetAsync(CancellationToken ct = default);
    Task<CompanySettings> CreateAsync(CompanySettings settings, CancellationToken ct = default);
    Task UpdateAsync(CompanySettings settings, CancellationToken ct = default);
}
```

---

## INFRASTRUCTURE LAYER

### File: `Integrations/Ares/AresDto.cs`
```csharp
namespace SportMedical.Diagnostics.Infrastructure.Integrations.Ares;

public class AresResponse
{
    public List<AresSubject> EkonomickeSubjekty { get; set; } = new();
}

public class AresSubject
{
    public string ObchodniJmeno { get; set; } = string.Empty;
    public string Sidlo { get; set; } = string.Empty;
    public string Ico { get; set; } = string.Empty;
    public string?Dic { get; set; }
    public string PravniForma { get; set; } = string.Empty;
    public string?Ulice { get; set; }
    public string?CisloDomovni { get; set; }
    public string?Obec { get; set; }
    public string?Psc { get; set; }
}
```

### File: `Integrations/Ares/IAresService.cs`
```csharp
namespace SportMedical.Diagnostics.Infrastructure.Integrations.Ares;

public interface IAresService
{
    Task<AresSubject?> LookupByIcoAsync(string ico, CancellationToken ct = default);
}
```

### File: `Integrations/Ares/AresService.cs`
```csharp
using System.Net.Http.Json;
using Microsoft.Extensions.Caching.Memory;

namespace SportMedical.Diagnostics.Infrastructure.Integrations.Ares;

public class AresService : IAresService
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private const string CacheKeyPrefix = "ARES_";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(24);

    public AresService(HttpClient httpClient, IMemoryCache cache)
    {
        _httpClient = httpClient;
        _cache = cache;
    }

    public async Task<AresSubject?> LookupByIcoAsync(string ico, CancellationToken ct = default)
    {
        var cacheKey = $"{CacheKeyPrefix}{ico}";
        
        if (_cache.TryGetValue(cacheKey, out AresSubject? cached))
        {
            return cached;
        }

        try
        {
            var url = $"https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}";
            var response = await _httpClient.GetFromJsonAsync<AresResponse>(url, ct);
            
            var subject = response?.EkonomickeSubjekty?.FirstOrDefault();
            
            if (subject != null)
            {
                _cache.Set(cacheKey, subject, CacheDuration);
            }
            
            return subject;
        }
        catch (Exception)
        {
            // Return null on failure - allow manual entry
            return null;
        }
    }
}
```

---

## APPLICATION LAYER

### File: `Settings/CompanySettingsService.cs`
```csharp
using SportMedical.Diagnostics.Domain.Settings;
using SportMedical.Diagnostics.Infrastructure.Integrations.Ares;

namespace SportMedical.Diagnostics.Application.Settings;

public class CompanySettingsService
{
    private readonly ICompanySettingsRepository _repository;
    private readonly IAresService _aresService;

    public CompanySettingsService(ICompanySettingsRepository repository, IAresService aresService)
    {
        _repository = repository;
        _aresService = aresService;
    }

    public async Task<CompanySettings?> GetAsync(CancellationToken ct = default)
    {
        return await _repository.GetAsync(ct);
    }

    public async Task<CompanySettings> UpdateAsync(UpdateCompanySettingsCommand command, CancellationToken ct = default)
    {
        var settings = await _repository.GetAsync(ct);
        
        if (settings == null)
        {
            settings = CompanySettings.Create(command.CompanyName, command.Ico);
            await _repository.CreateAsync(settings, ct);
        }
        else
        {
            settings.Update(
                command.CompanyName, command.Ico, command.Dic,
                command.Address, command.City, command.PostalCode,
                command.BankAccount, command.BankCode, command.Iban,
                command.Phone, command.Email, command.Website
            );
            await _repository.UpdateAsync(settings, ct);
        }

        return settings;
    }

    public async Task<AresSubject?> LookupAresAsync(string ico, CancellationToken ct = default)
    {
        // Validate IČO format
        if (string.IsNullOrWhiteSpace(ico) || ico.Length != 8 || !ico.All(char.IsDigit))
        {
            throw new ArgumentException("IČO must be exactly 8 digits");
        }

        return await _aresService.LookupByIcoAsync(ico, ct);
    }
}

public record UpdateCompanySettingsCommand(
    string CompanyName,
    string Ico,
    string? Dic,
    string? Address,
    string? City,
    string? PostalCode,
    string? BankAccount,
    string? BankCode,
    string? Iban,
    string? Phone,
    string? Email,
    string? Website
);
```

---

## API LAYER

### File: `CompanySettingsController.cs`
```csharp
using Microsoft.AspNetCore.Mvc;
using SportMedical.Diagnostics.Application.Settings;

namespace SportMedical.Diagnostics.Api.Controllers;

[ApiController]
[Route("api/company-settings")]
public class CompanySettingsController : ControllerBase
{
    private readonly CompanySettingsService _service;

    public CompanySettingsController(CompanySettingsService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var settings = await _service.GetAsync(ct);
        return Ok(settings);
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateCompanySettingsCommand command, CancellationToken ct)
    {
        var settings = await _service.UpdateAsync(command, ct);
        return Ok(settings);
    }

    [HttpGet("ares/{ico}")]
    public async Task<IActionResult> LookupAres(string ico, CancellationToken ct)
    {
        try
        {
            var result = await _service.LookupAresAsync(ico, ct);
            if (result == null)
                return NotFound(new { Message = "Company not found in ARES" });
            
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}
```

---

## FRONTEND

### File: `services/companySettingsApi.ts`
```typescript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface CompanySettings {
  id: string;
  companyName: string;
  ico: string;
  dic?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  bankAccount?: string;
  bankCode?: string;
  iban?: string;
  logoPath?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface AresSubject {
  obchodniJmeno: string;
  ico: string;
  dic?: string;
  ulice?: string;
  cisloDomovni?: string;
  obec?: string;
  psc?: string;
  pravniForma: string;
}

export const companySettingsApi = {
  get: async (): Promise<CompanySettings | null> => {
    const response = await axios.get(`${API_BASE}/company-settings`);
    return response.data;
  },

  update: async (settings: Partial<CompanySettings>): Promise<CompanySettings> => {
    const response = await axios.put(`${API_BASE}/company-settings`, settings);
    return response.data;
  },

  lookupAres: async (ico: string): Promise<AresSubject> => {
    const response = await axios.get(`${API_BASE}/company-settings/ares/${ico}`);
    return response.data;
  },
};
```

### File: `pages/CompanySettings.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, Typography, TextField, Button, Grid, 
  Box, Alert, CircularProgress, Divider
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companySettingsApi, AresSubject } from '../services/companySettingsApi';
import { toast } from 'react-hot-toast';

export const CompanySettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [aresLoading, setAresLoading] = useState(false);
  const [aresError, setAresError] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['companySettings'],
    queryFn: companySettingsApi.get,
  });

  const [form, setForm] = useState({
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
  });

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

  const updateMutation = useMutation({
    mutationFn: companySettingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
      toast.success('Nastavení uloženo');
    },
    onError: () => {
      toast.error('Chyba při ukládání');
    },
  });

  const handleAresLookup = async () => {
    if (form.ico.length !== 8) {
      setAresError('IČO musí mít přesně 8 číslic');
      return;
    }

    setAresLoading(true);
    setAresError(null);

    try {
      const result = await companySettingsApi.lookupAres(form.ico);
      setForm(prev => ({
        ...prev,
        companyName: result.obchodniJmeno,
        dic: result.dic || '',
        address: result.ulice ? `${result.ulice} ${result.cisloDomovni || ''}` : '',
        city: result.obec || '',
        postalCode: result.psc || '',
      }));
      toast.success('Data z ARES načtena');
    } catch (error) {
      setAresError('Firma nenalezena v ARES');
    } finally {
      setAresLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  if (isLoading) {
    return <CircularProgress />;
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Nastavení společnosti
        </Typography>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* IČO with ARES lookup */}
            <Grid item xs={12} md={6}>
              <Box display="flex" gap={1}>
                <TextField
                  fullWidth
                  label="IČO"
                  value={form.ico}
                  onChange={(e) => setForm({ ...form, ico: e.target.value })}
                  inputProps={{ maxLength: 8 }}
                />
                <Button
                  variant="outlined"
                  onClick={handleAresLookup}
                  disabled={aresLoading || form.ico.length !== 8}
                  sx={{ minWidth: 120 }}
                >
                  {aresLoading ? <CircularProgress size={20} /> : 'ARES'}
                </Button>
              </Box>
              {aresError && <Alert severity="warning" sx={{ mt: 1 }}>{aresError}</Alert>}
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="DIČ"
                value={form.dic}
                onChange={(e) => setForm({ ...form, dic: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Název společnosti"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Adresa"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Město"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="PSČ"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6">Bankovní spojení</Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Číslo účtu"
                value={form.bankAccount}
                onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Kód banky"
                value={form.bankCode}
                onChange={(e) => setForm({ ...form, bankCode: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="IBAN"
                value={form.iban}
                onChange={(e) => setForm({ ...form, iban: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6">Kontaktní údaje</Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Telefon"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Web"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Ukládání...' : 'Uložit nastavení'}
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
5. Create unit tests
6. Register services in DI container

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
3. Verify ARES lookup works with test IČO: `12345678`
4. Verify settings save/load correctly
