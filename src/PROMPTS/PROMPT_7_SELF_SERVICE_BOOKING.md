# PROMPT 7: SELF-SERVICE BOOKING
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

Implement **Self-service Booking** with cancellation/reschedule tokens.

### Business Rules
1. Patients can cancel/reschedule via secure token link
2. Token valid for 24 hours
3. Token is single-use
4. Email confirmation with token link
5. SMS reminder (optional)

### Flow
1. Patient books appointment → receives confirmation email with token
2. Patient clicks "Manage booking" link in email
3. Patient can cancel or reschedule
4. System validates token and processes request
5. Confirmation email sent for changes

---

## DOMAIN LAYER

### File: `Scheduling/BookingToken.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Scheduling;

public class BookingToken
{
    public Guid Id { get; private set; }
    public Guid BookingId { get; private set; }
    public string Token { get; private set; } = string.Empty;
    public BookingTokenType Type { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public bool IsUsed { get; private set; }
    public DateTime? UsedAt { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public static BookingToken Create(Guid bookingId, BookingTokenType type, int expirationHours = 24)
    {
        return new BookingToken
        {
            Id = Guid.NewGuid(),
            BookingId = bookingId,
            Token = GenerateSecureToken(),
            Type = type,
            ExpiresAt = DateTime.UtcNow.AddHours(expirationHours),
            CreatedAt = DateTime.UtcNow
        };
    }

    public bool IsValid => !IsUsed && ExpiresAt > DateTime.UtcNow;

    public void MarkAsUsed()
    {
        if (!IsValid)
            throw new InvalidOperationException("Token is invalid or expired");
        
        IsUsed = true;
        UsedAt = DateTime.UtcNow;
    }

    private static string GenerateSecureToken()
    {
        var bytes = new byte[32];
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }
}

public enum BookingTokenType
{
    Cancel = 0,
    Reschedule = 1,
    Both = 2
}
```

### File: `Scheduling/IBookingTokenRepository.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Scheduling;

public interface IBookingTokenRepository
{
    Task<BookingToken?> GetByTokenAsync(string token, CancellationToken ct = default);
    Task<BookingToken> CreateAsync(BookingToken token, CancellationToken ct = default);
    Task UpdateAsync(BookingToken token, CancellationToken ct = default);
    Task<List<BookingToken>> GetByBookingIdAsync(Guid bookingId, CancellationToken ct = default);
}
```

---

## APPLICATION LAYER

### File: `Scheduling/SelfServiceBookingService.cs`
```csharp
using SportMedical.Diagnostics.Domain.Scheduling;
using SportMedical.Diagnostics.Domain.Scheduling.TimeSlots;

namespace SportMedical.Diagnostics.Application.Scheduling;

public class SelfServiceBookingService
{
    private readonly IBookingTokenRepository _tokenRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly ITimeSlotRepository _slotRepository;
    private readonly IEmailService _emailService;

    public SelfServiceBookingService(
        IBookingTokenRepository tokenRepository,
        IBookingRepository bookingRepository,
        ITimeSlotRepository slotRepository,
        IEmailService emailService)
    {
        _tokenRepository = tokenRepository;
        _bookingRepository = bookingRepository;
        _slotRepository = slotRepository;
        _emailService = emailService;
    }

    /// <summary>
    /// Generate cancellation token for a booking
    /// </summary>
    public async Task<string> GenerateCancelTokenAsync(Guid bookingId, CancellationToken ct = default)
    {
        var token = BookingToken.Create(bookingId, BookingTokenType.Cancel);
        await _tokenRepository.CreateAsync(token, ct);
        return token.Token;
    }

    /// <summary>
    /// Generate reschedule token for a booking
    /// </summary>
    public async Task<string> GenerateRescheduleTokenAsync(Guid bookingId, CancellationToken ct = default)
    {
        var token = BookingToken.Create(bookingId, BookingTokenType.Reschedule);
        await _tokenRepository.CreateAsync(token, ct);
        return token.Token;
    }

    /// <summary>
    /// Cancel booking via token
    /// </summary>
    public async Task CancelBookingAsync(string token, string? reason = null, CancellationToken ct = default)
    {
        var bookingToken = await _tokenRepository.GetByTokenAsync(token, ct);
        
        if (bookingToken == null || !bookingToken.IsValid)
            throw new InvalidOperationException("Token is invalid or expired");

        if (bookingToken.Type != BookingTokenType.Cancel && bookingToken.Type != BookingTokenType.Both)
            throw new InvalidOperationException("Token does not allow cancellation");

        var booking = await _bookingRepository.GetByIdAsync(bookingToken.BookingId, ct);
        if (booking == null)
            throw new NotFoundException("Booking not found");

        // Mark token as used
        bookingToken.MarkAsUsed();
        await _tokenRepository.UpdateAsync(bookingToken, ct);

        // Cancel booking
        booking.Cancel(reason);
        await _bookingRepository.UpdateAsync(booking, ct);

        // Release time slot
        var slot = await _slotRepository.GetByIdAsync(booking.SlotId, ct);
        if (slot != null)
        {
            slot.Release();
            await _slotRepository.UpdateAsync(slot, ct);
        }

        // Send confirmation email
        await _emailService.SendBookingCancellationAsync(booking, reason, ct);
    }

    /// <summary>
    /// Reschedule booking to new slot
    /// </summary>
    public async Task RescheduleBookingAsync(string token, Guid newSlotId, CancellationToken ct = default)
    {
        var bookingToken = await _tokenRepository.GetByTokenAsync(token, ct);
        
        if (bookingToken == null || !bookingToken.IsValid)
            throw new InvalidOperationException("Token is invalid or expired");

        if (bookingToken.Type != BookingTokenType.Reschedule && bookingToken.Type != BookingTokenType.Both)
            throw new InvalidOperationException("Token does not allow rescheduling");

        var booking = await _bookingRepository.GetByIdAsync(bookingToken.BookingId, ct);
        if (booking == null)
            throw new NotFoundException("Booking not found");

        var newSlot = await _slotRepository.GetByIdAsync(newSlotId, ct);
        if (newSlot == null || !newSlot.IsAvailable)
            throw new InvalidOperationException("New slot is not available");

        // Mark token as used
        bookingToken.MarkAsUsed();
        await _tokenRepository.UpdateAsync(bookingToken, ct);

        // Release old slot
        var oldSlot = await _slotRepository.GetByIdAsync(booking.SlotId, ct);
        if (oldSlot != null)
        {
            oldSlot.Release();
            await _slotRepository.UpdateAsync(oldSlot, ct);
        }

        // Reserve new slot
        newSlot.Reserve(booking.Id);
        await _slotRepository.UpdateAsync(newSlot, ct);

        // Update booking
        booking.Reschedule(newSlotId);
        await _bookingRepository.UpdateAsync(booking, ct);

        // Send confirmation email
        await _emailService.SendBookingRescheduleAsync(booking, newSlot, ct);
    }

    /// <summary>
    /// Get available slots for rescheduling
    /// </summary>
    public async Task<List<TimeSlot>> GetAvailableSlotsAsync(
        Guid calendarId, DateTime startDate, DateTime endDate, CancellationToken ct = default)
    {
        return await _slotRepository.GetAvailableByDateRangeAsync(calendarId, startDate, endDate, ct);
    }

    /// <summary>
    /// Validate token without using it
    /// </summary>
    public async Task<bool> ValidateTokenAsync(string token, CancellationToken ct = default)
    {
        var bookingToken = await _tokenRepository.GetByTokenAsync(token, ct);
        return bookingToken?.IsValid == true;
    }

    /// <summary>
    /// Get booking details by token (for public view)
    /// </summary>
    public async Task<BookingDetailsDto?> GetBookingByTokenAsync(string token, CancellationToken ct = default)
    {
        var bookingToken = await _tokenRepository.GetByTokenAsync(token, ct);
        
        if (bookingToken == null || !bookingToken.IsValid)
            return null;

        var booking = await _bookingRepository.GetByIdAsync(bookingToken.BookingId, ct);
        if (booking == null)
            return null;

        return new BookingDetailsDto
        {
            BookingId = booking.Id,
            ServiceName = booking.ServiceName,
            Date = booking.Date,
            Time = booking.Time,
            Status = booking.Status.ToString(),
            CanCancel = bookingToken.Type == BookingTokenType.Cancel || bookingToken.Type == BookingTokenType.Both,
            CanReschedule = bookingToken.Type == BookingTokenType.Reschedule || bookingToken.Type == BookingTokenType.Both,
            ExpiresAt = bookingToken.ExpiresAt
        };
    }
}

public class BookingDetailsDto
{
    public Guid BookingId { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string Time { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool CanCancel { get; set; }
    public bool CanReschedule { get; set; }
    public DateTime ExpiresAt { get; set; }
}
```

---

## API LAYER

### File: `PublicBookingController.cs`
```csharp
using Microsoft.AspNetCore.Mvc;
using SportMedical.Diagnostics.Application.Scheduling;

namespace SportMedical.Diagnostics.Api.Controllers;

[ApiController]
[Route("api/public/booking")]
public class PublicBookingController : ControllerBase
{
    private readonly SelfServiceBookingService _service;

    public PublicBookingController(SelfServiceBookingService service)
    {
        _service = service;
    }

    [HttpGet("manage/{token}")]
    public async Task<IActionResult> GetBookingDetails(string token, CancellationToken ct)
    {
        var details = await _service.GetBookingByTokenAsync(token, ct);
        if (details == null)
            return NotFound(new { Message = "Invalid or expired token" });

        return Ok(details);
    }

    [HttpPost("cancel/{token}")]
    public async Task<IActionResult> CancelBooking(string token, [FromBody] CancelRequest request, CancellationToken ct)
    {
        try
        {
            await _service.CancelBookingAsync(token, request.Reason, ct);
            return Ok(new { Message = "Booking cancelled successfully" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("reschedule/{token}")]
    public async Task<IActionResult> RescheduleBooking(string token, [FromBody] RescheduleRequest request, CancellationToken ct)
    {
        try
        {
            await _service.RescheduleBookingAsync(token, request.NewSlotId, ct);
            return Ok(new { Message = "Booking rescheduled successfully" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("available-slots/{calendarId}")]
    public async Task<IActionResult> GetAvailableSlots(
        Guid calendarId,
        [FromQuery] DateTime start,
        [FromQuery] DateTime end,
        CancellationToken ct)
    {
        var slots = await _service.GetAvailableSlotsAsync(calendarId, start, end, ct);
        return Ok(slots);
    }
}

public record CancelRequest(string? Reason);
public record RescheduleRequest(Guid NewSlotId);
```

---

## FRONTEND

### File: `pages/PublicBookingManage.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, CardContent, Typography, Button, Box, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, List, ListItem,
  ListItemText, Chip
} from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

interface BookingDetails {
  bookingId: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
  canCancel: boolean;
  canReschedule: boolean;
  expiresAt: string;
}

interface TimeSlot {
  id: string;
  startAt: string;
  endAt: string;
}

export const PublicBookingManagePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['booking', token],
    queryFn: async (): Promise<BookingDetails> => {
      const response = await axios.get(`${API_BASE}/public/booking/manage/${token}`);
      return response.data;
    },
    enabled: !!token,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_BASE}/public/booking/cancel/${token}`, { reason: cancelReason });
    },
    onSuccess: () => {
      toast.success('Rezervace zrušena');
      setCancelDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Chyba při rušení');
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async (newSlotId: string) => {
      await axios.post(`${API_BASE}/public/booking/reschedule/${token}`, { newSlotId });
    },
    onSuccess: () => {
      toast.success('Rezervace přesunuta');
      setRescheduleDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Chyba při přesouvání');
    },
  });

  const fetchAvailableSlots = async () => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 14);
    
    const response = await axios.get(`${API_BASE}/public/booking/available-slots/`, {
      params: { start: start.toISOString(), end: end.toISOString() }
    });
    setAvailableSlots(response.data);
  };

  if (isLoading) {
    return <Typography>Načítání...</Typography>;
  }

  if (error || !booking) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            Neplatný nebo vypršelý odkaz. Požádejte o nový odkaz na recepci.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Správa rezervace
        </Typography>

        <Box mb={3}>
          <Typography variant="subtitle1">Služba: {booking.serviceName}</Typography>
          <Typography variant="body1">Datum: {new Date(booking.date).toLocaleDateString('cs-CZ')}</Typography>
          <Typography variant="body1">Čas: {booking.time}</Typography>
          <Chip label={booking.status} color="primary" sx={{ mt: 1 }} />
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          Odkaz vyplatí: {new Date(booking.expiresAt).toLocaleString('cs-CZ')}
        </Alert>

        <Box display="flex" gap={2}>
          {booking.canCancel && (
            <Button
              variant="contained"
              color="error"
              onClick={() => setCancelDialogOpen(true)}
            >
              Zrušit rezervaci
            </Button>
          )}
          {booking.canReschedule && (
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                fetchAvailableSlots();
                setRescheduleDialogOpen(true);
              }}
            >
              Přesunout rezervaci
            </Button>
          )}
        </Box>

        {/* Cancel Dialog */}
        <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
          <DialogTitle>Zrušit rezervaci</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              Opravdu chcete zrušit tuto rezervaci?
            </Typography>
            <textarea
              placeholder="Důvod zrušení (nepovinné)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              style={{ width: '100%', minHeight: 100, marginTop: 16 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelDialogOpen(false)}>Zpět</Button>
            <Button
              color="error"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Rušení...' : 'Zrušit rezervaci'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reschedule Dialog */}
        <Dialog
          open={rescheduleDialogOpen}
          onClose={() => setRescheduleDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Přesunout rezervaci</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              Vyberte nový termín:
            </Typography>
            <List>
              {availableSlots.map((slot) => (
                <ListItem
                  key={slot.id}
                  button
                  selected={selectedSlot === slot.id}
                  onClick={() => setSelectedSlot(slot.id)}
                >
                  <ListItemText
                    primary={new Date(slot.startAt).toLocaleString('cs-CZ')}
                    secondary={new Date(slot.endAt).toLocaleTimeString('cs-CZ')}
                  />
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRescheduleDialogOpen(false)}>Zpět</Button>
            <Button
              onClick={() => selectedSlot && rescheduleMutation.mutate(selectedSlot)}
              disabled={!selectedSlot || rescheduleMutation.isPending}
            >
              {rescheduleMutation.isPending ? 'Přesouvání...' : 'Přesunout'}
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
5. Create unit tests for token generation and validation
6. Test cancellation and reschedule flows

**DO NOT:**
- Modify existing files unless necessary
- Add new NuGet packages (use existing ones)
- Change the architecture pattern
- Skip email notifications

---

## VERIFICATION

After implementation:
1. Run `dotnet build` - must pass
2. Run `dotnet test` - must pass
3. Test token generation
4. Test booking cancellation via token
5. Test booking reschedule via token
6. Verify email notifications are sent
