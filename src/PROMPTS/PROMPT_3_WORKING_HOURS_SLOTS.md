# PROMPT 3: WORKING HOURS & TIME SLOT GENERATION
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

Implement **Working Hours** with **Week Parity** (sudé/liché týdny) and **Time Slot Generation**.

### Business Rules
1. Working hours per day of week (0=Sunday, 6=Saturday)
2. Week parity support: Odd weeks, Even weeks, All weeks
3. Break times (lunch break)
4. Time slot generation based on service duration
5. Buffer time between slots
6. Holiday exclusion
7. Slot status management (Available, Reserved, Blocked)

### Czech Context
- Week parity is used for alternating schedules (e.g., "odd weeks: 8:00-12:00, even weeks: 14:00-18:00")
- Czech public holidays must be excluded
- Working hours typically: 7:00 - 19:00

---

## DOMAIN LAYER

### File: `Scheduling/WorkingHours/WorkingHour.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Scheduling.WorkingHours;

public class WorkingHour
{
    public Guid Id { get; private set; }
    public Guid CalendarId { get; private set; }
    public DayOfWeek DayOfWeek { get; private set; }
    public TimeOnly StartTime { get; private set; }
    public TimeOnly EndTime { get; private set; }
    public WeekParity WeekParity { get; private set; } = WeekParity.All;
    public TimeOnly? BreakStart { get; private set; }
    public TimeOnly? BreakEnd { get; private set; }
    public bool IsActive { get; private set; } = true;
    public DateTime CreatedAt { get; private set; }

    public static WorkingHour Create(
        Guid calendarId, DayOfWeek dayOfWeek, 
        TimeOnly startTime, TimeOnly endTime,
        WeekParity weekParity = WeekParity.All,
        TimeOnly? breakStart = null, TimeOnly? breakEnd = null)
    {
        return new WorkingHour
        {
            Id = Guid.NewGuid(),
            CalendarId = calendarId,
            DayOfWeek = dayOfWeek,
            StartTime = startTime,
            EndTime = endTime,
            WeekParity = weekParity,
            BreakStart = breakStart,
            BreakEnd = breakEnd,
            CreatedAt = DateTime.UtcNow
        };
    }

    public bool IsWorking(DateTime date)
    {
        if (!IsActive) return false;
        
        var parity = GetWeekParity(date);
        return WeekParity == WeekParity.All || WeekParity == parity;
    }

    private WeekParity GetWeekParity(DateTime date)
    {
        var calendar = System.Globalization.CultureInfo.CurrentCulture.Calendar;
        var weekNumber = calendar.GetWeekOfYear(date, System.Globalization.CalendarWeekRule.FirstDay, DayOfWeek.Monday);
        return weekNumber % 2 == 0 ? WeekParity.Even : WeekParity.Odd;
    }
}

public enum WeekParity
{
    All = 0,
    Odd = 1,
    Even = 2
}
```

### File: `Scheduling/WorkingHours/IWorkingHoursRepository.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Scheduling.WorkingHours;

public interface IWorkingHoursRepository
{
    Task<List<WorkingHour>> GetByCalendarAsync(Guid calendarId, CancellationToken ct = default);
    Task<List<WorkingHour>> GetByCalendarAndDayAsync(Guid calendarId, DayOfWeek dayOfWeek, CancellationToken ct = default);
    Task<WorkingHour> CreateAsync(WorkingHour workingHour, CancellationToken ct = default);
    Task UpdateAsync(WorkingHour workingHour, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<bool> HasConflictAsync(Guid calendarId, DayOfWeek dayOfWeek, TimeOnly start, TimeOnly end, 
        WeekParity parity, Guid? excludeId = null, CancellationToken ct = default);
}
```

### File: `Scheduling/TimeSlots/TimeSlot.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Scheduling.TimeSlots;

public class TimeSlot
{
    public Guid Id { get; private set; }
    public Guid CalendarId { get; private set; }
    public Guid? ServiceId { get; private set; }
    public DateTime StartAt { get; private set; }
    public DateTime EndAt { get; private set; }
    public TimeSlotStatus Status { get; private set; } = TimeSlotStatus.Available;
    public Guid? BookingId { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public static TimeSlot Create(Guid calendarId, Guid? serviceId, DateTime startAt, DateTime endAt)
    {
        return new TimeSlot
        {
            Id = Guid.NewGuid(),
            CalendarId = calendarId,
            ServiceId = serviceId,
            StartAt = startAt,
            EndAt = endAt,
            Status = TimeSlotStatus.Available,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Reserve(Guid bookingId)
    {
        if (Status != TimeSlotStatus.Available)
            throw new InvalidOperationException("Slot is not available");
        
        Status = TimeSlotStatus.Reserved;
        BookingId = bookingId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Release()
    {
        Status = TimeSlotStatus.Available;
        BookingId = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Block(string? notes = null)
    {
        Status = TimeSlotStatus.Blocked;
        Notes = notes;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool IsAvailable => Status == TimeSlotStatus.Available;
    public TimeSpan Duration => EndAt - StartAt;
}

public enum TimeSlotStatus
{
    Available = 0,
    Reserved = 1,
    Blocked = 2,
    Completed = 3,
    NoShow = 4
}
```

### File: `Scheduling/TimeSlots/ITimeSlotRepository.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Scheduling.TimeSlots;

public interface ITimeSlotRepository
{
    Task<List<TimeSlot>> GetByDateRangeAsync(Guid calendarId, DateTime start, DateTime end, CancellationToken ct = default);
    Task<List<TimeSlot>> GetAvailableByDateRangeAsync(Guid calendarId, DateTime start, DateTime end, CancellationToken ct = default);
    Task<TimeSlot?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<TimeSlot> CreateAsync(TimeSlot slot, CancellationToken ct = default);
    Task UpdateAsync(TimeSlot slot, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<int> BulkCreateAsync(List<TimeSlot> slots, CancellationToken ct = default);
    Task<int> DeleteByDateRangeAsync(Guid calendarId, DateTime start, DateTime end, CancellationToken ct = default);
}
```

---

## APPLICATION LAYER

### File: `Scheduling/SlotGeneration/SlotGeneratorService.cs`
```csharp
using SportMedical.Diagnostics.Domain.Scheduling.WorkingHours;
using SportMedical.Diagnostics.Domain.Scheduling.TimeSlots;

namespace SportMedical.Diagnostics.Application.Scheduling.SlotGeneration;

public class SlotGeneratorService
{
    private readonly IWorkingHoursRepository _workingHoursRepo;
    private readonly ITimeSlotRepository _timeSlotRepo;
    private readonly IHolidayService _holidayService;

    public SlotGeneratorService(
        IWorkingHoursRepository workingHoursRepo,
        ITimeSlotRepository timeSlotRepo,
        IHolidayService holidayService)
    {
        _workingHoursRepo = workingHoursRepo;
        _timeSlotRepo = timeSlotRepo;
        _holidayService = holidayService;
    }

    /// <summary>
    /// Generate time slots for a date range based on working hours
    /// </summary>
    public async Task<int> GenerateSlotsAsync(
        Guid calendarId,
        DateTime startDate,
        DateTime endDate,
        int slotDurationMinutes,
        int bufferMinutes = 0,
        CancellationToken ct = default)
    {
        var workingHours = await _workingHoursRepo.GetByCalendarAsync(calendarId, ct);
        var holidays = await _holidayService.GetHolidaysAsync(startDate.Year, endDate.Year, ct);
        
        var slots = new List<TimeSlot>();
        var currentDate = startDate.Date;

        while (currentDate <= endDate.Date)
        {
            // Skip holidays
            if (IsHoliday(currentDate, holidays))
            {
                currentDate = currentDate.AddDays(1);
                continue;
            }

            // Get working hours for this day
            var dayHours = workingHours.Where(wh => 
                wh.DayOfWeek == currentDate.DayOfWeek && 
                wh.IsWorking(currentDate)).ToList();

            foreach (var wh in dayHours)
            {
                var slotsForDay = GenerateSlotsForDay(
                    calendarId, currentDate, wh, 
                    slotDurationMinutes, bufferMinutes);
                slots.AddRange(slotsForDay);
            }

            currentDate = currentDate.AddDays(1);
        }

        // Bulk insert
        if (slots.Any())
        {
            await _timeSlotRepo.BulkCreateAsync(slots, ct);
        }

        return slots.Count;
    }

    private List<TimeSlot> GenerateSlotsForDay(
        Guid calendarId, DateTime date, WorkingHour workingHour,
        int slotDurationMinutes, int bufferMinutes)
    {
        var slots = new List<TimeSlot>();
        var currentStart = date.Date.Add(workingHour.StartTime.ToTimeSpan());
        var dayEnd = date.Date.Add(workingHour.EndTime.ToTimeSpan());
        var slotDuration = TimeSpan.FromMinutes(slotDurationMinutes);
        var buffer = TimeSpan.FromMinutes(bufferMinutes);

        // Handle break time
        var breakStart = workingHour.BreakStart?.ToTimeSpan();
        var breakEnd = workingHour.BreakEnd?.ToTimeSpan();

        while (currentStart + slotDuration <= dayEnd)
        {
            var slotEnd = currentStart + slotDuration;

            // Skip if slot overlaps with break
            if (breakStart.HasValue && breakEnd.HasValue)
            {
                if (currentStart < breakEnd.Value && slotEnd > breakStart.Value)
                {
                    currentStart = breakEnd.Value + buffer;
                    continue;
                }
            }

            slots.Add(TimeSlot.Create(calendarId, null, currentStart, slotEnd));
            currentStart = slotEnd + buffer;
        }

        return slots;
    }

    private bool IsHoliday(DateTime date, List<DateTime> holidays)
    {
        return holidays.Any(h => h.Date == date.Date);
    }
}
```

### File: `Scheduling/SlotGeneration/GenerateSlotsCommand.cs`
```csharp
namespace SportMedical.Diagnostics.Application.Scheduling.SlotGeneration;

public record GenerateSlotsCommand(
    Guid CalendarId,
    DateTime StartDate,
    DateTime EndDate,
    int SlotDurationMinutes,
    int BufferMinutes = 0
);

public record GenerateSlotsResult(
    int SlotsGenerated,
    DateTime From,
    DateTime To
);
```

### File: `Scheduling/WorkingHours/WorkingHoursService.cs`
```csharp
using SportMedical.Diagnostics.Domain.Scheduling.WorkingHours;

namespace SportMedical.Diagnostics.Application.Scheduling.WorkingHours;

public class WorkingHoursService
{
    private readonly IWorkingHoursRepository _repository;

    public WorkingHoursService(IWorkingHoursRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<WorkingHour>> GetByCalendarAsync(Guid calendarId, CancellationToken ct = default)
    {
        return await _repository.GetByCalendarAsync(calendarId, ct);
    }

    public async Task<WorkingHour> CreateAsync(CreateWorkingHourCommand command, CancellationToken ct = default)
    {
        // Check for conflicts
        var hasConflict = await _repository.HasConflictAsync(
            command.CalendarId, command.DayOfWeek,
            command.StartTime, command.EndTime,
            command.WeekParity, ct: ct);

        if (hasConflict)
            throw new InvalidOperationException("Working hours conflict with existing schedule");

        var workingHour = WorkingHour.Create(
            command.CalendarId, command.DayOfWeek,
            command.StartTime, command.EndTime,
            command.WeekParity,
            command.BreakStart, command.BreakEnd);

        return await _repository.CreateAsync(workingHour, ct);
    }

    public async Task UpdateAsync(Guid id, UpdateWorkingHourCommand command, CancellationToken ct = default)
    {
        var existing = (await _repository.GetByCalendarAsync(command.CalendarId, ct))
            .FirstOrDefault(wh => wh.Id == id);

        if (existing == null)
            throw new NotFoundException("Working hour not found");

        // Check for conflicts (excluding current)
        var hasConflict = await _repository.HasConflictAsync(
            command.CalendarId, command.DayOfWeek,
            command.StartTime, command.EndTime,
            command.WeekParity, id, ct);

        if (hasConflict)
            throw new InvalidOperationException("Working hours conflict with existing schedule");

        // Update would require adding update method to domain entity
        await _repository.UpdateAsync(existing, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        await _repository.DeleteAsync(id, ct);
    }
}

public record CreateWorkingHourCommand(
    Guid CalendarId,
    DayOfWeek DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    WeekParity WeekParity = WeekParity.All,
    TimeOnly? BreakStart = null,
    TimeOnly? BreakEnd = null
);

public record UpdateWorkingHourCommand(
    Guid CalendarId,
    DayOfWeek DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    WeekParity WeekParity = WeekParity.All,
    TimeOnly? BreakStart = null,
    TimeOnly? BreakEnd = null
);

public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message) { }
}
```

---

## API LAYER

### File: `WorkingHoursController.cs`
```csharp
using Microsoft.AspNetCore.Mvc;
using SportMedical.Diagnostics.Application.Scheduling.WorkingHours;

namespace SportMedical.Diagnostics.Api.Controllers;

[ApiController]
[Route("api/calendars/{calendarId}/working-hours")]
public class WorkingHoursController : ControllerBase
{
    private readonly WorkingHoursService _service;

    public WorkingHoursController(WorkingHoursService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Get(Guid calendarId, CancellationToken ct)
    {
        var hours = await _service.GetByCalendarAsync(calendarId, ct);
        return Ok(hours);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid calendarId, [FromBody] CreateWorkingHourCommand command, CancellationToken ct)
    {
        try
        {
            var result = await _service.CreateAsync(command with { CalendarId = calendarId }, ct);
            return CreatedAtAction(nameof(Get), new { calendarId }, result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { Message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid calendarId, Guid id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }
}
```

### File: `SlotGenerationController.cs`
```csharp
using Microsoft.AspNetCore.Mvc;
using SportMedical.Diagnostics.Application.Scheduling.SlotGeneration;

namespace SportMedical.Diagnostics.Api.Controllers;

[ApiController]
[Route("api/calendars/{calendarId}/slots")]
public class SlotGenerationController : ControllerBase
{
    private readonly SlotGeneratorService _service;

    public SlotGenerationController(SlotGeneratorService service)
    {
        _service = service;
    }

    [HttpPost("generate")]
    public async Task<IActionResult> Generate(
        Guid calendarId,
        [FromBody] GenerateSlotsRequest request,
        CancellationToken ct)
    {
        var command = new GenerateSlotsCommand(
            calendarId,
            request.StartDate,
            request.EndDate,
            request.SlotDurationMinutes,
            request.BufferMinutes);

        var result = await _service.GenerateSlotsAsync(command, ct);
        return Ok(new { SlotsGenerated = result });
    }

    [HttpGet]
    public async Task<IActionResult> GetSlots(
        Guid calendarId,
        [FromQuery] DateTime start,
        [FromQuery] DateTime end,
        CancellationToken ct)
    {
        // Implementation would fetch slots from repository
        return Ok(new { Message = "Slots fetched" });
    }
}

public record GenerateSlotsRequest(
    DateTime StartDate,
    DateTime EndDate,
    int SlotDurationMinutes,
    int BufferMinutes = 0
);
```

---

## FRONTEND

### File: `services/workingHoursApi.ts`
```typescript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export enum WeekParity {
  All = 0,
  Odd = 1,
  Even = 2,
}

export interface WorkingHour {
  id: string;
  calendarId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weekParity: WeekParity;
  breakStart?: string;
  breakEnd?: string;
  isActive: boolean;
}

export const workingHoursApi = {
  getByCalendar: async (calendarId: string): Promise<WorkingHour[]> => {
    const response = await axios.get(`${API_BASE}/calendars/${calendarId}/working-hours`);
    return response.data;
  },

  create: async (calendarId: string, data: Partial<WorkingHour>): Promise<WorkingHour> => {
    const response = await axios.post(`${API_BASE}/calendars/${calendarId}/working-hours`, data);
    return response.data;
  },

  delete: async (calendarId: string, id: string): Promise<void> => {
    await axios.delete(`${API_BASE}/calendars/${calendarId}/working-hours/${id}`);
  },
};
```

### File: `components/WorkingHoursEditor.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, Typography, Grid, TextField, Select, MenuItem,
  FormControl, InputLabel, Button, Box, Chip, IconButton, Switch,
  FormControlLabel, Divider
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workingHoursApi, WorkingHour, WeekParity } from '../services/workingHoursApi';
import { toast } from 'react-hot-toast';

const DAYS_OF_WEEK = [
  'Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'
];

interface WorkingHoursEditorProps {
  calendarId: string;
}

export const WorkingHoursEditor: React.FC<WorkingHoursEditorProps> = ({ calendarId }) => {
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState<number>(1); // Monday
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [weekParity, setWeekParity] = useState<WeekParity>(WeekParity.All);
  const [breakStart, setBreakStart] = useState('12:00');
  const [breakEnd, setBreakEnd] = useState('13:00');
  const [useBreak, setUseBreak] = useState(true);

  const { data: workingHours = [], isLoading } = useQuery({
    queryKey: ['workingHours', calendarId],
    queryFn: () => workingHoursApi.getByCalendar(calendarId),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<WorkingHour>) => 
      workingHoursApi.create(calendarId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workingHours', calendarId] });
      toast.success('Pracovní doba přidána');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Chyba při přidávání');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workingHoursApi.delete(calendarId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workingHours', calendarId] });
      toast.success('Pracovní doba smazána');
    },
  });

  const handleAdd = () => {
    createMutation.mutate({
      dayOfWeek: selectedDay,
      startTime,
      endTime,
      weekParity,
      breakStart: useBreak ? breakStart : undefined,
      breakEnd: useBreak ? breakEnd : undefined,
    });
  };

  const getParityLabel = (parity: WeekParity) => {
    switch (parity) {
      case WeekParity.Odd: return 'Lichý týden';
      case WeekParity.Even: return 'Sudý týden';
      default: return 'Všechny týdny';
    }
  };

  // Group by day
  const groupedByDay = workingHours.reduce((acc, wh) => {
    if (!acc[wh.dayOfWeek]) acc[wh.dayOfWeek] = [];
    acc[wh.dayOfWeek].push(wh);
    return acc;
  }, {} as Record<number, WorkingHour[]>);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Pracovní doba
        </Typography>

        {/* Add new working hours form */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Den</InputLabel>
              <Select
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
                label="Den"
              >
                {DAYS_OF_WEEK.map((day, index) => (
                  <MenuItem key={index} value={index}>{day}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Začátek"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Konec"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Týden</InputLabel>
              <Select
                value={weekParity}
                onChange={(e) => setWeekParity(Number(e.target.value) as WeekParity)}
                label="Týden"
              >
                <MenuItem value={WeekParity.All}>Všechny</MenuItem>
                <MenuItem value={WeekParity.Odd}>Lichý</MenuItem>
                <MenuItem value={WeekParity.Even}>Sudý</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={useBreak}
                  onChange={(e) => setUseBreak(e.target.checked)}
                />
              }
              label="Pauza"
            />
          </Grid>

          {useBreak && (
            <>
              <Grid item xs={6} md={1}>
                <TextField
                  fullWidth
                  label="Pauza od"
                  type="time"
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6} md={1}>
                <TextField
                  fullWidth
                  label="Pauza do"
                  type="time"
                  value={breakEnd}
                  onChange={(e) => setBreakEnd(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </>
          )}

          <Grid item xs={12}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
              disabled={createMutation.isPending}
            >
              Přidat
            </Button>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Display existing working hours by day */}
        {DAYS_OF_WEEK.map((day, dayIndex) => (
          <Box key={dayIndex} sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {day}
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {(groupedByDay[dayIndex] || []).map((wh) => (
                <Chip
                  key={wh.id}
                  label={`${wh.startTime} - ${wh.endTime} (${getParityLabel(wh.weekParity)})`}
                  onDelete={() => deleteMutation.mutate(wh.id)}
                  color={wh.isActive ? 'primary' : 'default'}
                />
              ))}
              {(!groupedByDay[dayIndex] || groupedByDay[dayIndex].length === 0) && (
                <Typography variant="body2" color="text.secondary">
                  Volno
                </Typography>
              )}
            </Box>
          </Box>
        ))}
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
5. Create unit tests for slot generation logic
6. Test week parity calculation
7. Test holiday exclusion

**DO NOT:**
- Modify existing files unless necessary
- Add new NuGet packages (use existing ones)
- Change the architecture pattern
- Skip break time handling

---

## VERIFICATION

After implementation:
1. Run `dotnet build` - must pass
2. Run `dotnet test` - must pass
3. Test slot generation for a week
4. Test week parity (odd vs even)
5. Test break time exclusion
6. Test holiday exclusion
