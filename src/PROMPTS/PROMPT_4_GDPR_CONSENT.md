# PROMPT 4: GDPR & CONSENT MANAGEMENT
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

Implement **GDPR Consent Management** for health data processing.

### Business Rules (GDPR Article 9 - Special Categories)
1. Explicit consent required for health data processing
2. Consent types: Treatment, Marketing, Communication, Club Sharing
3. Consent versioning (track changes)
4. Consent expiry management
5. Audit trail for all consent operations
6. Data export (Article 15 - Right of Access)
7. Data deletion/anonymization (Article 17 - Right to Erasure)

### Czech Context
- Health data requires explicit consent under GDPR
- Consent must be freely given, specific, informed, unambiguous
- Must be able to prove consent was given

---

## DOMAIN LAYER

### File: `Patients/Consent/Consent.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Patients.Consent;

public class Consent
{
    public Guid Id { get; private set; }
    public Guid PatientId { get; private set; }
    public ConsentType Type { get; private set; }
    public bool IsGranted { get; private set; }
    public string? Purpose { get; private set; }
    public int Version { get; private set; } = 1;
    public DateTime GrantedAt { get; private set; }
    public DateTime? ExpiresAt { get; private set; }
    public DateTime? RevokedAt { get; private set; }
    public string? IpAddress { get; private set; }
    public string? UserAgent { get; private set; }
    public Guid? GrantedByUserId { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public static Consent Create(
        Guid patientId, ConsentType type, bool isGranted,
        string? purpose, string? ipAddress, string? userAgent, Guid? userId)
    {
        return new Consent
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            Type = type,
            IsGranted = isGranted,
            Purpose = purpose,
            GrantedAt = DateTime.UtcNow,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            GrantedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Revoke(string? notes = null)
    {
        if (!IsGranted)
            throw new InvalidOperationException("Cannot revoke a non-granted consent");
        
        IsGranted = false;
        RevokedAt = DateTime.UtcNow;
        Notes = notes;
    }

    public bool IsValid => IsGranted && !RevokedAt.HasValue && 
        (!ExpiresAt.HasValue || ExpiresAt > DateTime.UtcNow);
}

public enum ConsentType
{
    Treatment = 0,        // Léčebný souhlas
    Marketing = 1,        // Marketingový souhlas
    Communication = 2,    // Komunikace (email, SMS)
    ClubSharing = 3,      // Sdílení s klubem
    DataExport = 4        // Export dat
}
```

### File: `Patients/Consent/IConsentRepository.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Patients.Consent;

public interface IConsentRepository
{
    Task<List<Consent>> GetByPatientAsync(Guid patientId, CancellationToken ct = default);
    Task<Consent?> GetLatestByPatientAndTypeAsync(Guid patientId, ConsentType type, CancellationToken ct = default);
    Task<Consent> CreateAsync(Consent consent, CancellationToken ct = default);
    Task UpdateAsync(Consent consent, CancellationToken ct = default);
    Task<bool> HasValidConsentAsync(Guid patientId, ConsentType type, CancellationToken ct = default);
    Task<int> GetCountByTypeAsync(ConsentType type, CancellationToken ct = default);
}
```

### File: `Patients/Consent/ConsentAuditLog.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Patients.Consent;

public class ConsentAuditLog
{
    public Guid Id { get; private set; }
    public Guid ConsentId { get; private set; }
    public ConsentAction Action { get; private set; }
    public ConsentType ConsentType { get; private set; }
    public bool? PreviousValue { get; private set; }
    public bool? NewValue { get; private set; }
    public string? PerformedBy { get; private set; }
    public string? IpAddress { get; private set; }
    public DateTime PerformedAt { get; private set; }

    public static ConsentAuditLog Create(
        Consent consent, ConsentAction action,
        bool? previousValue, bool? newValue,
        string? performedBy, string? ipAddress)
    {
        return new ConsentAuditLog
        {
            Id = Guid.NewGuid(),
            ConsentId = consent.Id,
            Action = action,
            ConsentType = consent.Type,
            PreviousValue = previousValue,
            NewValue = newValue,
            PerformedBy = performedBy,
            IpAddress = ipAddress,
            PerformedAt = DateTime.UtcNow
        };
    }
}

public enum ConsentAction
{
    Granted = 0,
    Revoked = 1,
    Updated = 2,
    Expired = 3
}
```

---

## APPLICATION LAYER

### File: `Patients/Consent/ConsentService.cs`
```csharp
using SportMedical.Diagnostics.Domain.Patients.Consent;

namespace SportMedical.Diagnostics.Application.Patients.Consent;

public class ConsentService
{
    private readonly IConsentRepository _repository;

    public ConsentService(IConsentRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<Consent>> GetByPatientAsync(Guid patientId, CancellationToken ct = default)
    {
        return await _repository.GetByPatientAsync(patientId, ct);
    }

    public async Task<Consent> GrantConsentAsync(GrantConsentCommand command, CancellationToken ct = default)
    {
        // Check if already granted
        var existing = await _repository.GetLatestByPatientAndTypeAsync(
            command.PatientId, command.Type, ct);

        if (existing?.IsValid == true)
            throw new InvalidOperationException("Consent already granted");

        var consent = Consent.Create(
            command.PatientId,
            command.Type,
            true,
            command.Purpose,
            command.IpAddress,
            command.UserAgent,
            command.UserId);

        if (command.ExpiresInDays.HasValue)
        {
            consent.ExpiresAt = DateTime.UtcNow.AddDays(command.ExpiresInDays.Value);
        }

        return await _repository.CreateAsync(consent, ct);
    }

    public async Task RevokeConsentAsync(RevokeConsentCommand command, CancellationToken ct = default)
    {
        var consent = await _repository.GetLatestByPatientAndTypeAsync(
            command.PatientId, command.Type, ct);

        if (consent == null)
            throw new NotFoundException("Consent not found");

        consent.Revoke(command.Notes);
        await _repository.UpdateAsync(consent, ct);
    }

    public async Task<bool> HasValidConsentAsync(Guid patientId, ConsentType type, CancellationToken ct = default)
    {
        return await _repository.HasValidConsentAsync(patientId, type, ct);
    }

    public async Task<ConsentDataExport> ExportPatientDataAsync(Guid patientId, CancellationToken ct = default)
    {
        var consents = await _repository.GetByPatientAsync(patientId, ct);
        
        return new ConsentDataExport
        {
            PatientId = patientId,
            Consents = consents.Select(c => new ConsentExportItem
            {
                Type = c.Type.ToString(),
                IsGranted = c.IsGranted,
                GrantedAt = c.GrantedAt,
                RevokedAt = c.RevokedAt,
                ExpiresAt = c.ExpiresAt,
                Purpose = c.Purpose
            }).ToList(),
            ExportedAt = DateTime.UtcNow
        };
    }
}

public record GrantConsentCommand(
    Guid PatientId,
    ConsentType Type,
    string? Purpose,
    int? ExpiresInDays,
    string? IpAddress,
    string? UserAgent,
    Guid? UserId
);

public record RevokeConsentCommand(
    Guid PatientId,
    ConsentType Type,
    string? Notes
);

public class ConsentDataExport
{
    public Guid PatientId { get; set; }
    public List<ConsentExportItem> Consents { get; set; } = new();
    public DateTime ExportedAt { get; set; }
}

public class ConsentExportItem
{
    public string Type { get; set; } = string.Empty;
    public bool IsGranted { get; set; }
    public DateTime GrantedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string? Purpose { get; set; }
}
```

---

## API LAYER

### File: `ConsentController.cs`
```csharp
using Microsoft.AspNetCore.Mvc;
using SportMedical.Diagnostics.Application.Patients.Consent;
using SportMedical.Diagnostics.Domain.Patients.Consent;

namespace SportMedical.Diagnostics.Api.Controllers;

[ApiController]
[Route("api/patients/{patientId}/consents")]
public class ConsentController : ControllerBase
{
    private readonly ConsentService _service;

    public ConsentController(ConsentService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetByPatient(Guid patientId, CancellationToken ct)
    {
        var consents = await _service.GetByPatientAsync(patientId, ct);
        return Ok(consents);
    }

    [HttpPost("grant")]
    public async Task<IActionResult> Grant(Guid patientId, [FromBody] GrantConsentRequest request, CancellationToken ct)
    {
        try
        {
            var command = new GrantConsentCommand(
                patientId,
                request.Type,
                request.Purpose,
                request.ExpiresInDays,
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                HttpContext.Request.Headers.UserAgent.ToString(),
                GetUserId());

            var consent = await _service.GrantConsentAsync(command, ct);
            return Ok(consent);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { Message = ex.Message });
        }
    }

    [HttpPost("revoke")]
    public async Task<IActionResult> Revoke(Guid patientId, [FromBody] RevokeConsentRequest request, CancellationToken ct)
    {
        try
        {
            var command = new RevokeConsentCommand(patientId, request.Type, request.Notes);
            await _service.RevokeConsentAsync(command, ct);
            return Ok();
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { Message = ex.Message });
        }
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportData(Guid patientId, CancellationToken ct)
    {
        var data = await _service.ExportPatientDataAsync(patientId, ct);
        return Ok(data);
    }

    private Guid? GetUserId()
    {
        // Implementation depends on your auth system
        return null;
    }
}

public record GrantConsentRequest(
    ConsentType Type,
    string? Purpose,
    int? ExpiresInDays
);

public record RevokeConsentRequest(
    ConsentType Type,
    string? Notes
);
```

---

## FRONTEND

### File: `services/consentApi.ts`
```typescript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export enum ConsentType {
  Treatment = 0,
  Marketing = 1,
  Communication = 2,
  ClubSharing = 3,
  DataExport = 4,
}

export interface Consent {
  id: string;
  patientId: string;
  type: ConsentType;
  isGranted: boolean;
  purpose?: string;
  version: number;
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

export const consentApi = {
  getByPatient: async (patientId: string): Promise<Consent[]> => {
    const response = await axios.get(`${API_BASE}/patients/${patientId}/consents`);
    return response.data;
  },

  grant: async (patientId: string, type: ConsentType, purpose?: string, expiresInDays?: number): Promise<Consent> => {
    const response = await axios.post(`${API_BASE}/patients/${patientId}/consents/grant`, {
      type,
      purpose,
      expiresInDays,
    });
    return response.data;
  },

  revoke: async (patientId: string, type: ConsentType, notes?: string): Promise<void> => {
    await axios.post(`${API_BASE}/patients/${patientId}/consents/revoke`, {
      type,
      notes,
    });
  },

  exportData: async (patientId: string): Promise<any> => {
    const response = await axios.get(`${API_BASE}/patients/${patientId}/consents/export`);
    return response.data;
  },
};
```

### File: `components/ConsentManager.tsx`
```tsx
import React from 'react';
import {
  Card, CardContent, Typography, Switch, FormControlLabel,
  Box, Alert, Chip, Button, Divider
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { consentApi, ConsentType, Consent } from '../services/consentApi';
import { toast } from 'react-hot-toast';

const CONSENT_LABELS: Record<ConsentType, { label: string; description: string }> = {
  [ConsentType.Treatment]: {
    label: 'Léčebný souhlas',
    description: 'Souhlas se zpracováním zdravotních údajů pro účely poskytování zdravotních služeb',
  },
  [ConsentType.Marketing]: {
    label: 'Marketingový souhlas',
    description: 'Souhlas se zasíláním informací o službách a akcích',
  },
  [ConsentType.Communication]: {
    label: 'Komunikace',
    description: 'Souhlas se zasíláním emailových a SMS notifikací',
  },
  [ConsentType.ClubSharing]: {
    label: 'Sdílení s klubem',
    description: 'Souhlas se sdílením výsledků se sportovním klubem',
  },
  [ConsentType.DataExport]: {
    label: 'Export dat',
    description: 'Souhlas s exportem osobních údajů',
  },
};

interface ConsentManagerProps {
  patientId: string;
}

export const ConsentManager: React.FC<ConsentManagerProps> = ({ patientId }) => {
  const queryClient = useQueryClient();

  const { data: consents = [], isLoading } = useQuery({
    queryKey: ['consents', patientId],
    queryFn: () => consentApi.getByPatient(patientId),
  });

  const grantMutation = useMutation({
    mutationFn: (type: ConsentType) => consentApi.grant(patientId, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consents', patientId] });
      toast.success('Souhlas udělen');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Chyba při udělování souhlasu');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (type: ConsentType) => consentApi.revoke(patientId, type, 'Odvoláno uživatelem'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consents', patientId] });
      toast.success('Souhlas odvolán');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Chyba při odvolání souhlasu');
    },
  });

  const getConsentStatus = (type: ConsentType): Consent | undefined => {
    return consents.find(c => c.type === type);
  };

  const handleExport = async () => {
    try {
      const data = await consentApi.exportData(patientId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consent-export-${patientId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exportována');
    } catch (error) {
      toast.error('Chyba při exportu');
    }
  };

  if (isLoading) {
    return <Typography>Načítání...</Typography>;
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Správa souhlasů (GDPR)</Typography>
          <Button variant="outlined" onClick={handleExport}>
            Exportovat data
          </Button>
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          Zdravotní údaje vyžadují explicitní souhlas dle GDPR čl. 9
        </Alert>

        {Object.entries(CONSENT_LABELS).map(([type, info]) => {
          const consentType = Number(type) as ConsentType;
          const consent = getConsentStatus(consentType);
          const isGranted = consent?.isGranted && consent?.revokedAt === null;

          return (
            <React.Fragment key={type}>
              <Box display="flex" alignItems="center" justifyContent="space-between" py={1}>
                <Box flex={1}>
                  <Typography variant="subtitle1">{info.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {info.description}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={2}>
                  {consent && (
                    <Box textAlign="right">
                      <Chip
                        label={isGranted ? 'Aktivní' : 'Neaktivní'}
                        color={isGranted ? 'success' : 'default'}
                        size="small"
                      />
                      <Typography variant="caption" display="block" color="text.secondary">
                        {new Date(consent.grantedAt).toLocaleDateString('cs-CZ')}
                      </Typography>
                    </Box>
                  )}
                  <Switch
                    checked={isGranted}
                    onChange={(e) => {
                      if (e.target.checked) {
                        grantMutation.mutate(consentType);
                      } else {
                        revokeMutation.mutate(consentType);
                      }
                    }}
                    disabled={grantMutation.isPending || revokeMutation.isPending}
                  />
                </Box>
              </Box>
              <Divider />
            </React.Fragment>
          );
        })}
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
5. Create unit tests for consent operations
6. Test consent granting, revoking, and expiry

**DO NOT:**
- Modify existing files unless necessary
- Add new NuGet packages (use existing ones)
- Change the architecture pattern
- Skip audit trail

---

## VERIFICATION

After implementation:
1. Run `dotnet build` - must pass
2. Run `dotnet test` - must pass
3. Test consent granting flow
4. Test consent revocation flow
5. Test data export
6. Verify audit trail is created
