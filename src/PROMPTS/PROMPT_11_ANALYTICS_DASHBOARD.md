# PROMPT 11: ANALYTICS DASHBOARD
## For: SportMedical.Diagnostics (.NET 10 / React 19)

---

## CONTEXT

You are working on **SportMedical.Diagnostics**, a medical diagnostics platform.

**Tech Stack:**
- Backend: .NET 10 / C# 14 / ASP.NET Core / Entity Framework Core
- Frontend: React 19 / TypeScript / MUI / React Query / Zustand / Recharts
- Database: PostgreSQL (production) / SQLite (local)

**Architecture:** Clean Architecture with Domain, Application, Infrastructure, Persistence layers.

---

## REQUIREMENT

Implement **Analytics Dashboard** with real-time statistics and charts.

### Business Rules
1. Real-time dashboard with key metrics
2. Daily/weekly/monthly views
3. Revenue by service
4. Patient statistics
5. Booking statistics
6. Occupancy rate
7. Export to PDF/Excel

### Key Metrics
- Today's revenue
- Appointments completed/cancelled/no-show
- New vs returning patients
- Service utilization
- Average wait time

---

## DOMAIN LAYER

### File: `Analytics/DashboardMetrics.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Analytics;

public class DashboardMetrics
{
    // Revenue
    public decimal TodayRevenue { get; set; }
    public decimal WeekRevenue { get; set; }
    public decimal MonthRevenue { get; set; }
    public decimal YearRevenue { get; set; }
    public decimal AverageTransaction { get; set; }
    
    // Bookings
    public int TodayAppointments { get; set; }
    public int CompletedToday { get; set; }
    public int CancelledToday { get; set; }
    public int NoShowToday { get; set; }
    public double OccupancyRate { get; set; }
    
    // Patients
    public int TotalPatients { get; set; }
    public int NewPatientsToday { get; set; }
    public int NewPatientsWeek { get; set; }
    public int ReturningPatients { get; set; }
    
    // Services
    public List<ServiceMetrics> TopServices { get; set; } = new();
    public List<HourlyMetric> HourlyDistribution { get; set; } = new();
    public List<DailyMetric> DailyTrend { get; set; } = new();
}

public class ServiceMetrics
{
    public string ServiceName { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal Revenue { get; set; }
    public double Percentage { get; set; }
}

public class HourlyMetric
{
    public int Hour { get; set; }
    public int Appointments { get; set; }
    public decimal Revenue { get; set; }
}

public class DailyMetric
{
    public DateTime Date { get; set; }
    public int Appointments { get; set; }
    public decimal Revenue { get; set; }
    public int NewPatients { get; set; }
}
```

### File: `Analytics/IAnalyticsRepository.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Analytics;

public interface IAnalyticsRepository
{
    Task<DashboardMetrics> GetDashboardMetricsAsync(DateTime date, CancellationToken ct = default);
    Task<List<DailyMetric>> GetDailyTrendAsync(DateTime from, DateTime to, CancellationToken ct = default);
    Task<List<ServiceMetrics>> GetServiceMetricsAsync(DateTime from, DateTime to, CancellationToken ct = default);
    Task<List<HourlyMetric>> GetHourlyDistributionAsync(DateTime date, CancellationToken ct = default);
    Task<Dictionary<string, int>> GetPatientDemographicsAsync(CancellationToken ct = default);
}
```

---

## APPLICATION LAYER

### File: `Analytics/AnalyticsService.cs`
```csharp
using SportMedical.Diagnostics.Domain.Analytics;

namespace SportMedical.Diagnostics.Application.Analytics;

public class AnalyticsService
{
    private readonly IAnalyticsRepository _repository;

    public AnalyticsService(IAnalyticsRepository repository)
    {
        _repository = repository;
    }

    public async Task<DashboardMetrics> GetDashboardAsync(DateTime? date = null, CancellationToken ct = default)
    {
        var targetDate = date ?? DateTime.UtcNow.Date;
        return await _repository.GetDashboardMetricsAsync(targetDate, ct);
    }

    public async Task<AnalyticsReport> GetReportAsync(ReportQuery query, CancellationToken ct = default)
    {
        var dailyTrend = await _repository.GetDailyTrendAsync(query.DateFrom, query.DateTo, ct);
        var serviceMetrics = await _repository.GetServiceMetricsAsync(query.DateFrom, query.DateTo, ct);
        var hourlyDistribution = await _repository.GetHourlyDistributionAsync(query.DateFrom, ct);
        
        return new AnalyticsReport
        {
            DateFrom = query.DateFrom,
            DateTo = query.DateTo,
            DailyTrend = dailyTrend,
            ServiceMetrics = serviceMetrics,
            HourlyDistribution = hourlyDistribution,
            TotalRevenue = dailyTrend.Sum(d => d.Revenue),
            TotalAppointments = dailyTrend.Sum(d => d.Appointments),
            TotalNewPatients = dailyTrend.Sum(d => d.NewPatients)
        };
    }

    public async Task<byte[]> ExportToCsvAsync(ReportQuery query, CancellationToken ct = default)
    {
        var report = await GetReportAsync(query, ct);
        
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("Datum;Rezervace;Tržba;Noví pacienti");
        
        foreach (var day in report.DailyTrend)
        {
            sb.AppendLine($"{day.Date:dd.MM.yyyy};{day.Appointments};{day.Revenue};{day.NewPatients}");
        }
        
        return System.Text.Encoding.UTF8.GetBytes(sb.ToString());
    }
}

public record ReportQuery(
    DateTime DateFrom,
    DateTime DateTo,
    string? ServiceFilter = null
);

public class AnalyticsReport
{
    public DateTime DateFrom { get; set; }
    public DateTime DateTo { get; set; }
    public List<DailyMetric> DailyTrend { get; set; } = new();
    public List<ServiceMetrics> ServiceMetrics { get; set; } = new();
    public List<HourlyMetric> HourlyDistribution { get; set; } = new();
    public decimal TotalRevenue { get; set; }
    public int TotalAppointments { get; set; }
    public int TotalNewPatients { get; set; }
}
```

---

## API LAYER

### File: `AnalyticsController.cs`
```csharp
using Microsoft.AspNetCore.Mvc;
using SportMedical.Diagnostics.Application.Analytics;

namespace SportMedical.Diagnostics.Api.Controllers;

[ApiController]
[Route("api/analytics")]
public class AnalyticsController : ControllerBase
{
    private readonly AnalyticsService _service;

    public AnalyticsController(AnalyticsService service)
    {
        _service = service;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard([FromQuery] DateTime? date, CancellationToken ct)
    {
        var metrics = await _service.GetDashboardAsync(date, ct);
        return Ok(metrics);
    }

    [HttpGet("report")]
    public async Task<IActionResult> GetReport(
        [FromQuery] DateTime dateFrom,
        [FromQuery] DateTime dateTo,
        [FromQuery] string? serviceFilter,
        CancellationToken ct)
    {
        var query = new ReportQuery(dateFrom, dateTo, serviceFilter);
        var report = await _service.GetReportAsync(query, ct);
        return Ok(report);
    }

    [HttpGet("export/csv")]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] DateTime dateFrom,
        [FromQuery] DateTime dateTo,
        CancellationToken ct)
    {
        var query = new ReportQuery(dateFrom, dateTo);
        var data = await _service.ExportToCsvAsync(query, ct);
        return File(data, "text/csv", $"analytics_{dateFrom:yyyyMMdd}_{dateTo:yyyyMMdd}.csv");
    }
}
```

---

## FRONTEND

### File: `services/analyticsApi.ts`
```typescript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface DashboardMetrics {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  todayAppointments: number;
  completedToday: number;
  cancelledToday: number;
  noShowToday: number;
  occupancyRate: number;
  totalPatients: number;
  newPatientsToday: number;
  topServices: Array<{
    serviceName: string;
    count: number;
    revenue: number;
    percentage: number;
  }>;
  hourlyDistribution: Array<{
    hour: number;
    appointments: number;
    revenue: number;
  }>;
  dailyTrend: Array<{
    date: string;
    appointments: number;
    revenue: number;
    newPatients: number;
  }>;
}

export interface AnalyticsReport {
  dateFrom: string;
  dateTo: string;
  dailyTrend: Array<{
    date: string;
    appointments: number;
    revenue: number;
    newPatients: number;
  }>;
  serviceMetrics: Array<{
    serviceName: string;
    count: number;
    revenue: number;
    percentage: number;
  }>;
  totalRevenue: number;
  totalAppointments: number;
  totalNewPatients: number;
}

export const analyticsApi = {
  getDashboard: async (date?: string): Promise<DashboardMetrics> => {
    const response = await axios.get(`${API_BASE}/analytics/dashboard`, {
      params: { date },
    });
    return response.data;
  },

  getReport: async (dateFrom: string, dateTo: string, serviceFilter?: string): Promise<AnalyticsReport> => {
    const response = await axios.get(`${API_BASE}/analytics/report`, {
      params: { dateFrom, dateTo, serviceFilter },
    });
    return response.data;
  },

  exportCsv: async (dateFrom: string, dateTo: string): Promise<Blob> => {
    const response = await axios.get(`${API_BASE}/analytics/export/csv`, {
      params: { dateFrom, dateTo },
      responseType: 'blob',
    });
    return response.data;
  },
};
```

### File: `components/RevenueChart.tsx`
```tsx
import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';

interface RevenueChartProps {
  data: Array<{
    date: string;
    revenue: number;
    appointments: number;
  }>;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Vývoj tržeb
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(date) => new Date(date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' })}
            />
            <YAxis yAxisId="left" tickFormatter={formatCurrency} />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip 
              formatter={(value, name) => {
                if (name === 'revenue') return formatCurrency(value);
                return value;
              }}
              labelFormatter={(date) => new Date(date).toLocaleDateString('cs-CZ')}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              name="Tržba"
              stroke="#1976d2"
              strokeWidth={2}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="appointments"
              name="Rezervace"
              stroke="#4caf50"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
```

### File: `components/ServicesPieChart.tsx`
```tsx
import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ServicesPieChartProps {
  data: Array<{
    serviceName: string;
    count: number;
    revenue: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const ServicesPieChart: React.FC<ServicesPieChartProps> = ({ data }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Rozdělení dle služeb
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ serviceName, percent }) => `${serviceName} (${(percent * 100).toFixed(0)}%)`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="count"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
```

### File: `components/KPICards.tsx`
```tsx
import React from 'react';
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';
import { TrendingUp, TrendingDown, People, AttachMoney, Event, Cancel } from '@mui/icons-material';

interface KPICardsProps {
  metrics: {
    todayRevenue: number;
    todayAppointments: number;
    completedToday: number;
    cancelledToday: number;
    newPatientsToday: number;
    occupancyRate: number;
  };
}

export const KPICards: React.FC<KPICardsProps> = ({ metrics }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const cards = [
    {
      title: 'Dnešní tržba',
      value: formatCurrency(metrics.todayRevenue),
      icon: <AttachMoney />,
      color: '#4caf50',
    },
    {
      title: 'Rezervace',
      value: metrics.todayAppointments,
      icon: <Event />,
      color: '#2196f3',
    },
    {
      title: 'Noví pacienti',
      value: metrics.newPatientsToday,
      icon: <People />,
      color: '#9c27b0',
    },
    {
      title: 'Obsazenost',
      value: `${metrics.occupancyRate.toFixed(1)}%`,
      icon: <TrendingUp />,
      color: metrics.occupancyRate > 70 ? '#4caf50' : '#ff9800',
    },
  ];

  return (
    <Grid container spacing={3}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    {card.title}
                  </Typography>
                  <Typography variant="h4" sx={{ color: card.color }}>
                    {card.value}
                  </Typography>
                </Box>
                <Box sx={{ color: card.color, opacity: 0.5 }}>
                  {card.icon}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};
```

### File: `pages/Analytics.tsx`
```tsx
import React, { useState } from 'react';
import { Grid, Card, CardContent, Typography, TextField, Button, Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, DashboardMetrics } from '../services/analyticsApi';
import { KPICards } from '../components/KPICards';
import { RevenueChart } from '../components/RevenueChart';
import { ServicesPieChart } from '../components/ServicesPieChart';

export const AnalyticsPage: React.FC = () => {
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['analyticsDashboard'],
    queryFn: () => analyticsApi.getDashboard(),
  });

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['analyticsReport', dateFrom, dateTo],
    queryFn: () => analyticsApi.getReport(dateFrom, dateTo),
  });

  const handleExport = async () => {
    try {
      const blob = await analyticsApi.exportCsv(dateFrom, dateTo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_${dateFrom}_${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (dashboardLoading || reportLoading) {
    return <Typography>Načítání...</Typography>;
  }

  return (
    <Grid container spacing={3}>
      {/* Header */}
      <Grid item xs={12}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">Analytika</Typography>
          <Box display="flex" gap={2}>
            <TextField
              type="date"
              label="Od"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <TextField
              type="date"
              label="Do"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <Button variant="outlined" onClick={handleExport}>
              Export CSV
            </Button>
          </Box>
        </Box>
      </Grid>

      {/* KPI Cards */}
      {dashboard && (
        <Grid item xs={12}>
          <KPICards metrics={dashboard} />
        </Grid>
      )}

      {/* Charts */}
      <Grid item xs={12} md={8}>
        {report && (
          <RevenueChart data={report.dailyTrend} />
        )}
      </Grid>

      <Grid item xs={12} md={4}>
        {dashboard && (
          <ServicesPieChart data={dashboard.topServices} />
        )}
      </Grid>

      {/* Summary */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Souhrn období
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={4}>
                <Typography color="text.secondary">Celková tržba</Typography>
                <Typography variant="h5">
                  {new Intl.NumberFormat('cs-CZ', {
                    style: 'currency',
                    currency: 'CZK',
                  }).format(report?.totalRevenue || 0)}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography color="text.secondary">Celkem rezervací</Typography>
                <Typography variant="h5">{report?.totalAppointments || 0}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography color="text.secondary">Noví pacienti</Typography>
                <Typography variant="h5">{report?.totalNewPatients || 0}</Typography>
              </Grid>
            </Grid>
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
5. Create unit tests for analytics calculations
6. Test chart rendering
7. Ensure responsive design

**Required Frontend Packages (already in package.json):**
- recharts (for charts)
- @mui/material (for UI)

**DO NOT:**
- Modify existing files unless necessary
- Add new NuGet packages (use existing ones)
- Change the architecture pattern
- Skip responsive design

---

## VERIFICATION

After implementation:
1. Run `dotnet build` - must pass
2. Run `dotnet test` - must pass
3. Verify dashboard loads with metrics
4. Test date range selection
5. Test CSV export
6. Verify charts render correctly
7. Test responsive design on mobile
