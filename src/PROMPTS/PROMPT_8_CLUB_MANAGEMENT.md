# PROMPT 8: CLUB/CORPORATE MANAGEMENT
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

Implement **Club/Corporate Management** for sports clubs and corporate clients.

### Business Rules
1. Club profile with IČO, DIČ, address, contact person
2. Club members (athletes/patients)
3. Club-specific pricing
4. Monthly invoicing
5. ARES integration for auto-fill
6. Club dashboard with statistics

---

## DOMAIN LAYER

### File: `Clubs/Club.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Clubs;

public class Club
{
    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Ico { get; private set; } = string.Empty;
    public string? Dic { get; private set; }
    public string? Address { get; private set; }
    public string? City { get; private set; }
    public string? PostalCode { get; private set; }
    public string? ContactPerson { get; private set; }
    public string? ContactEmail { get; private set; }
    public string? ContactPhone { get; private set; }
    public string? BankAccount { get; private set; }
    public string? BankCode { get; private set; }
    public string? Iban { get; private set; }
    public int PaymentTermsDays { get; private set; } = 14;
    public bool IsActive { get; private set; } = true;
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public static Club Create(string name, string ico)
    {
        return new Club
        {
            Id = Guid.NewGuid(),
            Name = name,
            Ico = ico,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Update(string name, string ico, string? dic, string? address,
        string? city, string? postalCode, string? contactPerson, string? contactEmail,
        string? contactPhone, string? bankAccount, string? bankCode, string? iban,
        int paymentTermsDays)
    {
        Name = name;
        Ico = ico;
        Dic = dic;
        Address = address;
        City = city;
        PostalCode = postalCode;
        ContactPerson = contactPerson;
        ContactEmail = contactEmail;
        ContactPhone = contactPhone;
        BankAccount = bankAccount;
        BankCode = bankCode;
        Iban = iban;
        PaymentTermsDays = paymentTermsDays;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }
}
```

### File: `Clubs/ClubMember.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Clubs;

public class ClubMember
{
    public Guid Id { get; private set; }
    public Guid ClubId { get; private set; }
    public Guid PatientId { get; private set; }
    public string? MemberNumber { get; private set; }
    public string? Position { get; private set; }
    public DateTime JoinedAt { get; private set; }
    public DateTime? LeftAt { get; private set; }
    public bool IsActive { get; private set; } = true;

    public static ClubMember Create(Guid clubId, Guid patientId, string? memberNumber = null)
    {
        return new ClubMember
        {
            Id = Guid.NewGuid(),
            ClubId = clubId,
            PatientId = patientId,
            MemberNumber = memberNumber,
            JoinedAt = DateTime.UtcNow
        };
    }

    public void Deactivate()
    {
        IsActive = false;
        LeftAt = DateTime.UtcNow;
    }
}
```

### File: `Clubs/ClubPricing.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Clubs;

public class ClubPricing
{
    public Guid Id { get; private set; }
    public Guid ClubId { get; private set; }
    public Guid ServiceId { get; private set; }
    public decimal SpecialPrice { get; private set; }
    public decimal? DiscountPercent { get; private set; }
    public DateTime ValidFrom { get; private set; }
    public DateTime? ValidTo { get; private set; }
    public bool IsActive { get; private set; } = true;

    public static ClubPricing Create(Guid clubId, Guid serviceId, decimal specialPrice, DateTime validFrom)
    {
        return new ClubPricing
        {
            Id = Guid.NewGuid(),
            ClubId = clubId,
            ServiceId = serviceId,
            SpecialPrice = specialPrice,
            ValidFrom = validFrom,
            CreatedAt = DateTime.UtcNow
        };
    }

    public decimal CalculatePrice(decimal originalPrice)
    {
        if (SpecialPrice > 0)
            return SpecialPrice;
        
        if (DiscountPercent.HasValue)
            return originalPrice * (1 - DiscountPercent.Value / 100);
        
        return originalPrice;
    }
}
```

### File: `Clubs/IClubRepository.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Clubs;

public interface IClubRepository
{
    Task<List<Club>> GetAllAsync(CancellationToken ct = default);
    Task<Club?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Club> CreateAsync(Club club, CancellationToken ct = default);
    Task UpdateAsync(Club club, CancellationToken ct = default);
    Task<List<ClubMember>> GetMembersAsync(Guid clubId, CancellationToken ct = default);
    Task<ClubMember> AddMemberAsync(ClubMember member, CancellationToken ct = default);
    Task RemoveMemberAsync(Guid memberId, CancellationToken ct = default);
    Task<List<ClubPricing>> GetPricingAsync(Guid clubId, CancellationToken ct = default);
    Task<ClubPricing> SetPricingAsync(ClubPricing pricing, CancellationToken ct = default);
}
```

---

## APPLICATION LAYER

### File: `Clubs/ClubService.cs`
```csharp
using SportMedical.Diagnostics.Domain.Clubs;
using SportMedical.Diagnostics.Infrastructure.Integrations.Ares;

namespace SportMedical.Diagnostics.Application.Clubs;

public class ClubService
{
    private readonly IClubRepository _repository;
    private readonly IAresService _aresService;

    public ClubService(IClubRepository repository, IAresService aresService)
    {
        _repository = repository;
        _aresService = aresService;
    }

    public async Task<List<Club>> GetAllAsync(CancellationToken ct = default)
    {
        return await _repository.GetAllAsync(ct);
    }

    public async Task<Club?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _repository.GetByIdAsync(id, ct);
    }

    public async Task<Club> CreateAsync(CreateClubCommand command, CancellationToken ct = default)
    {
        var club = Club.Create(command.Name, command.Ico);
        
        club.Update(
            command.Name, command.Ico, command.Dic,
            command.Address, command.City, command.PostalCode,
            command.ContactPerson, command.ContactEmail, command.ContactPhone,
            command.BankAccount, command.BankCode, command.Iban,
            command.PaymentTermsDays);

        return await _repository.CreateAsync(club, ct);
    }

    public async Task UpdateAsync(Guid id, UpdateClubCommand command, CancellationToken ct = default)
    {
        var club = await _repository.GetByIdAsync(id, ct);
        if (club == null)
            throw new NotFoundException("Club not found");

        club.Update(
            command.Name, command.Ico, command.Dic,
            command.Address, command.City, command.PostalCode,
            command.ContactPerson, command.ContactEmail, command.ContactPhone,
            command.BankAccount, command.BankCode, command.Iban,
            command.PaymentTermsDays);

        await _repository.UpdateAsync(club, ct);
    }

    public async Task<Club> LookupAresAsync(string ico, CancellationToken ct = default)
    {
        var aresResult = await _aresService.LookupByIcoAsync(ico, ct);
        if (aresResult == null)
            throw new NotFoundException("Company not found in ARES");

        return Club.Create(aresResult.ObchodniJmeno, aresResult.Ico);
    }

    public async Task<List<ClubMember>> GetMembersAsync(Guid clubId, CancellationToken ct = default)
    {
        return await _repository.GetMembersAsync(clubId, ct);
    }

    public async Task<ClubMember> AddMemberAsync(AddClubMemberCommand command, CancellationToken ct = default)
    {
        var member = ClubMember.Create(command.ClubId, command.PatientId, command.MemberNumber);
        return await _repository.AddMemberAsync(member, ct);
    }

    public async Task RemoveMemberAsync(Guid memberId, CancellationToken ct = default)
    {
        await _repository.RemoveMemberAsync(memberId, ct);
    }

    public async Task<ClubPricing> SetPricingAsync(SetClubPricingCommand command, CancellationToken ct = default)
    {
        var pricing = ClubPricing.Create(
            command.ClubId, command.ServiceId,
            command.SpecialPrice, command.ValidFrom);
        
        return await _repository.SetPricingAsync(pricing, ct);
    }

    public async Task<ClubDashboardDto> GetDashboardAsync(Guid clubId, CancellationToken ct = default)
    {
        var club = await _repository.GetByIdAsync(clubId, ct);
        var members = await _repository.GetMembersAsync(clubId, ct);
        
        return new ClubDashboardDto
        {
            Club = club!,
            ActiveMembers = members.Count(m => m.IsActive),
            TotalMembers = members.Count
        };
    }
}

public record CreateClubCommand(
    string Name, string Ico, string? Dic, string? Address,
    string? City, string? PostalCode, string? ContactPerson,
    string? ContactEmail, string? ContactPhone, string? BankAccount,
    string? BankCode, string? Iban, int PaymentTermsDays = 14
);

public record UpdateClubCommand(
    string Name, string Ico, string? Dic, string? Address,
    string? City, string? PostalCode, string? ContactPerson,
    string? ContactEmail, string? ContactPhone, string? BankAccount,
    string? BankCode, string? Iban, int PaymentTermsDays = 14
);

public record AddClubMemberCommand(Guid ClubId, Guid PatientId, string? MemberNumber);

public record SetClubPricingCommand(
    Guid ClubId, Guid ServiceId, decimal SpecialPrice, DateTime ValidFrom
);

public class ClubDashboardDto
{
    public Club Club { get; set; } = null!;
    public int ActiveMembers { get; set; }
    public int TotalMembers { get; set; }
}
```

---

## API LAYER

### File: `ClubsController.cs`
```csharp
using Microsoft.AspNetCore.Mvc;
using SportMedical.Diagnostics.Application.Clubs;

namespace SportMedical.Diagnostics.Api.Controllers;

[ApiController]
[Route("api/clubs")]
public class ClubsController : ControllerBase
{
    private readonly ClubService _service;

    public ClubsController(ClubService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var clubs = await _service.GetAllAsync(ct);
        return Ok(clubs);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var club = await _service.GetByIdAsync(id, ct);
        if (club == null) return NotFound();
        return Ok(club);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateClubCommand command, CancellationToken ct)
    {
        var club = await _service.CreateAsync(command, ct);
        return CreatedAtAction(nameof(GetById), new { id = club.Id }, club);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateClubCommand command, CancellationToken ct)
    {
        await _service.UpdateAsync(id, command, ct);
        return Ok();
    }

    [HttpGet("{id}/members")]
    public async Task<IActionResult> GetMembers(Guid id, CancellationToken ct)
    {
        var members = await _service.GetMembersAsync(id, ct);
        return Ok(members);
    }

    [HttpPost("{id}/members")]
    public async Task<IActionResult> AddMember(Guid id, [FromBody] AddClubMemberCommand command, CancellationToken ct)
    {
        var member = await _service.AddMemberAsync(command with { ClubId = id }, ct);
        return Ok(member);
    }

    [HttpGet("{id}/dashboard")]
    public async Task<IActionResult> GetDashboard(Guid id, CancellationToken ct)
    {
        var dashboard = await _service.GetDashboardAsync(id, ct);
        return Ok(dashboard);
    }

    [HttpGet("ares/{ico}")]
    public async Task<IActionResult> LookupAres(string ico, CancellationToken ct)
    {
        try
        {
            var club = await _service.LookupAresAsync(ico, ct);
            return Ok(club);
        }
        catch (NotFoundException)
        {
            return NotFound(new { Message = "Company not found in ARES" });
        }
    }
}
```

---

## FRONTEND

### File: `services/clubsApi.ts`
```typescript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface Club {
  id: string;
  name: string;
  ico: string;
  dic?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
}

export interface ClubMember {
  id: string;
  clubId: string;
  patientId: string;
  memberNumber?: string;
  position?: string;
  joinedAt: string;
  isActive: boolean;
}

export interface ClubDashboard {
  club: Club;
  activeMembers: number;
  totalMembers: number;
}

export const clubsApi = {
  getAll: async (): Promise<Club[]> => {
    const response = await axios.get(`${API_BASE}/clubs`);
    return response.data;
  },

  getById: async (id: string): Promise<Club> => {
    const response = await axios.get(`${API_BASE}/clubs/${id}`);
    return response.data;
  },

  create: async (data: Partial<Club>): Promise<Club> => {
    const response = await axios.post(`${API_BASE}/clubs`, data);
    return response.data;
  },

  update: async (id: string, data: Partial<Club>): Promise<void> => {
    await axios.put(`${API_BASE}/clubs/${id}`, data);
  },

  getMembers: async (clubId: string): Promise<ClubMember[]> => {
    const response = await axios.get(`${API_BASE}/clubs/${clubId}/members`);
    return response.data;
  },

  addMember: async (clubId: string, patientId: string, memberNumber?: string): Promise<ClubMember> => {
    const response = await axios.post(`${API_BASE}/clubs/${clubId}/members`, { patientId, memberNumber });
    return response.data;
  },

  getDashboard: async (clubId: string): Promise<ClubDashboard> => {
    const response = await axios.get(`${API_BASE}/clubs/${clubId}/dashboard`);
    return response.data;
  },

  lookupAres: async (ico: string): Promise<Club> => {
    const response = await axios.get(`${API_BASE}/clubs/ares/${ico}`);
    return response.data;
  },
};
```

### File: `pages/Clubs.tsx`
```tsx
import React, { useState } from 'react';
import {
  Card, CardContent, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Grid, Box, IconButton, Chip
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, People as PeopleIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clubsApi, Club } from '../services/clubsApi';
import { toast } from 'react-hot-toast';

export const ClubsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [aresLoading, setAresLoading] = useState(false);

  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: clubsApi.getAll,
  });

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
  });

  const createMutation = useMutation({
    mutationFn: clubsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast.success('Klub vytvořen');
      setDialogOpen(false);
    },
    onError: () => {
      toast.error('Chyba při vytváření');
    },
  });

  const handleAresLookup = async () => {
    if (formData.ico.length !== 8) return;
    
    setAresLoading(true);
    try {
      const result = await clubsApi.lookupAres(formData.ico);
      setFormData(prev => ({
        ...prev,
        name: result.name,
      }));
      toast.success('Data z ARES načtena');
    } catch (error) {
      toast.error('Firma nenalezena v ARES');
    } finally {
      setAresLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5">Kluby a firmy</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
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
                  <TableCell>{club.contactPerson}</TableCell>
                  <TableCell>{club.contactEmail}</TableCell>
                  <TableCell>
                    <Chip
                      label={club.isActive ? 'Aktivní' : 'Neaktivní'}
                      color={club.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small">
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small">
                      <PeopleIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Create Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Nový klub</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="Název"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Box display="flex" gap={1}>
                  <TextField
                    fullWidth
                    label="IČO"
                    value={formData.ico}
                    onChange={(e) => setFormData({ ...formData, ico: e.target.value })}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleAresLookup}
                    disabled={aresLoading || formData.ico.length !== 8}
                  >
                    ARES
                  </Button>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="DIČ"
                  value={formData.dic}
                  onChange={(e) => setFormData({ ...formData, dic: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Adresa"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Kontaktní osoba"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Zrušit</Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Vytváření...' : 'Vytvořit'}
            </Button>
          </DialogActions>
        </Dialog>
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
5. Create unit tests for club operations
6. Test ARES integration

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
3. Test club creation
4. Test ARES lookup
5. Test member management
6. Test club dashboard
