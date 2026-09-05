# PROMPT 6: EMAIL & SMS TEMPLATES
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

Implement **Email & SMS Templates** system with variable substitution.

### Business Rules
1. Templates for: Booking confirmation, Reminder, Cancellation, Follow-up
2. Variable substitution: {{patient_name}}, {{date}}, {{time}}, {{service}}, etc.
3. Template preview before sending
4. Test send functionality
5. Template versioning
6. Usage tracking

### Template Types
| Code | Name | Variables |
|------|------|-----------|
| BOOKING_CONFIRM | Potvrzení rezervace | patient_name, date, time, service, clinic |
| BOOKING_REMINDER | Připomínka | patient_name, date, time, service |
| BOOKING_CANCEL | Zrušení | patient_name, date, time, reason |
| FOLLOW_UP | Následná péče | patient_name, date, service, notes |
| WELCOME | Vítejte | patient_name, clinic |

---

## DOMAIN LAYER

### File: `Notifications/EmailTemplate.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Notifications;

public class EmailTemplate
{
    public Guid Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Subject { get; private set; } = string.Empty;
    public string BodyHtml { get; private set; } = string.Empty;
    public string? BodyText { get; private set; }
    public List<string> Variables { get; private set; } = new();
    public bool IsActive { get; private set; } = true;
    public int Version { get; private set; } = 1;
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public static EmailTemplate Create(string code, string name, string subject, string bodyHtml, List<string> variables)
    {
        return new EmailTemplate
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = name,
            Subject = subject,
            BodyHtml = bodyHtml,
            Variables = variables,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Update(string subject, string bodyHtml, string? bodyText = null)
    {
        Subject = subject;
        BodyHtml = bodyHtml;
        BodyText = bodyText;
        Version++;
        UpdatedAt = DateTime.UtcNow;
    }

    public string Render(Dictionary<string, string> variables)
    {
        var result = Subject;
        foreach (var kvp in variables)
        {
            result = result.Replace($"{{{{{kvp.Key}}}}}", kvp.Value);
        }
        return result;
    }

    public string RenderBody(Dictionary<string, string> variables)
    {
        var result = BodyHtml;
        foreach (var kvp in variables)
        {
            result = result.Replace($"{{{{{kvp.Key}}}}}", kvp.Value);
        }
        return result;
    }
}
```

### File: `Notifications/SmsTemplate.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Notifications;

public class SmsTemplate
{
    public Guid Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty;
    public List<string> Variables { get; private set; } = new();
    public bool IsActive { get; private set; } = true;
    public int Version { get; private set; } = 1;
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public static SmsTemplate Create(string code, string name, string body, List<string> variables)
    {
        return new SmsTemplate
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = name,
            Body = body,
            Variables = variables,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Update(string body)
    {
        Body = body;
        Version++;
        UpdatedAt = DateTime.UtcNow;
    }

    public string Render(Dictionary<string, string> variables)
    {
        var result = Body;
        foreach (var kvp in variables)
        {
            result = result.Replace($"{{{{{kvp.Key}}}}}", kvp.Value);
        }
        return result;
    }

    public int GetSmsCount()
    {
        // Czech SMS: 160 chars per segment
        return (int)Math.Ceiling(Body.Length / 160.0);
    }
}
```

### File: `Notifications/INotificationTemplateRepository.cs`
```csharp
namespace SportMedical.Diagnostics.Domain.Notifications;

public interface INotificationTemplateRepository
{
    Task<List<EmailTemplate>> GetAllEmailTemplatesAsync(CancellationToken ct = default);
    Task<EmailTemplate?> GetEmailTemplateByCodeAsync(string code, CancellationToken ct = default);
    Task<EmailTemplate> CreateEmailTemplateAsync(EmailTemplate template, CancellationToken ct = default);
    Task UpdateEmailTemplateAsync(EmailTemplate template, CancellationToken ct = default);
    
    Task<List<SmsTemplate>> GetAllSmsTemplatesAsync(CancellationToken ct = default);
    Task<SmsTemplate?> GetSmsTemplateByCodeAsync(string code, CancellationToken ct = default);
    Task<SmsTemplate> CreateSmsTemplateAsync(SmsTemplate template, CancellationToken ct = default);
    Task UpdateSmsTemplateAsync(SmsTemplate template, CancellationToken ct = default);
}
```

---

## APPLICATION LAYER

### File: `Notifications/TemplateService.cs`
```csharp
using SportMedical.Diagnostics.Domain.Notifications;

namespace SportMedical.Diagnostics.Application.Notifications;

public class TemplateService
{
    private readonly INotificationTemplateRepository _repository;

    public TemplateService(INotificationTemplateRepository repository)
    {
        _repository = repository;
    }

    // Email Templates
    public async Task<List<EmailTemplate>> GetAllEmailTemplatesAsync(CancellationToken ct = default)
    {
        return await _repository.GetAllEmailTemplatesAsync(ct);
    }

    public async Task<EmailTemplate?> GetEmailTemplateAsync(string code, CancellationToken ct = default)
    {
        return await _repository.GetEmailTemplateByCodeAsync(code, ct);
    }

    public async Task<EmailTemplate> CreateEmailTemplateAsync(CreateEmailTemplateCommand command, CancellationToken ct = default)
    {
        var existing = await _repository.GetEmailTemplateByCodeAsync(command.Code, ct);
        if (existing != null)
            throw new InvalidOperationException("Template with this code already exists");

        var template = EmailTemplate.Create(
            command.Code, command.Name, command.Subject,
            command.BodyHtml, command.Variables);

        return await _repository.CreateEmailTemplateAsync(template, ct);
    }

    public async Task UpdateEmailTemplateAsync(string code, UpdateEmailTemplateCommand command, CancellationToken ct = default)
    {
        var template = await _repository.GetEmailTemplateByCodeAsync(code, ct);
        if (template == null)
            throw new NotFoundException("Template not found");

        template.Update(command.Subject, command.BodyHtml, command.BodyText);
        await _repository.UpdateEmailTemplateAsync(template, ct);
    }

    public string RenderEmailSubject(string code, Dictionary<string, string> variables)
    {
        var template = _repository.GetEmailTemplateByCodeAsync(code).Result;
        if (template == null)
            throw new NotFoundException("Template not found");

        return template.Render(variables);
    }

    public string RenderEmailBody(string code, Dictionary<string, string> variables)
    {
        var template = _repository.GetEmailTemplateByCodeAsync(code).Result;
        if (template == null)
            throw new NotFoundException("Template not found");

        return template.RenderBody(variables);
    }

    // SMS Templates
    public async Task<List<SmsTemplate>> GetAllSmsTemplatesAsync(CancellationToken ct = default)
    {
        return await _repository.GetAllSmsTemplatesAsync(ct);
    }

    public async Task<SmsTemplate?> GetSmsTemplateAsync(string code, CancellationToken ct = default)
    {
        return await _repository.GetSmsTemplateByCodeAsync(code, ct);
    }

    public async Task<SmsTemplate> CreateSmsTemplateAsync(CreateSmsTemplateCommand command, CancellationToken ct = default)
    {
        var template = SmsTemplate.Create(
            command.Code, command.Name, command.Body, command.Variables);

        return await _repository.CreateSmsTemplateAsync(template, ct);
    }

    public string RenderSmsBody(string code, Dictionary<string, string> variables)
    {
        var template = _repository.GetSmsTemplateByCodeAsync(code).Result;
        if (template == null)
            throw new NotFoundException("Template not found");

        return template.Render(variables);
    }
}

public record CreateEmailTemplateCommand(
    string Code,
    string Name,
    string Subject,
    string BodyHtml,
    List<string> Variables
);

public record UpdateEmailTemplateCommand(
    string Subject,
    string BodyHtml,
    string? BodyText
);

public record CreateSmsTemplateCommand(
    string Code,
    string Name,
    string Body,
    List<string> Variables
);
```

---

## API LAYER

### File: `TemplatesController.cs`
```csharp
using Microsoft.AspNetCore.Mvc;
using SportMedical.Diagnostics.Application.Notifications;

namespace SportMedical.Diagnostics.Api.Controllers;

[ApiController]
[Route("api/templates")]
public class TemplatesController : ControllerBase
{
    private readonly TemplateService _service;

    public TemplatesController(TemplateService service)
    {
        _service = service;
    }

    [HttpGet("email")]
    public async Task<IActionResult> GetEmailTemplates(CancellationToken ct)
    {
        var templates = await _service.GetAllEmailTemplatesAsync(ct);
        return Ok(templates);
    }

    [HttpGet("email/{code}")]
    public async Task<IActionResult> GetEmailTemplate(string code, CancellationToken ct)
    {
        var template = await _service.GetEmailTemplateAsync(code, ct);
        if (template == null)
            return NotFound();
        return Ok(template);
    }

    [HttpPost("email")]
    public async Task<IActionResult> CreateEmailTemplate([FromBody] CreateEmailTemplateCommand command, CancellationToken ct)
    {
        try
        {
            var template = await _service.CreateEmailTemplateAsync(command, ct);
            return CreatedAtAction(nameof(GetEmailTemplate), new { code = template.Code }, template);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { Message = ex.Message });
        }
    }

    [HttpPut("email/{code}")]
    public async Task<IActionResult> UpdateEmailTemplate(string code, [FromBody] UpdateEmailTemplateCommand command, CancellationToken ct)
    {
        try
        {
            await _service.UpdateEmailTemplateAsync(code, command, ct);
            return Ok();
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { Message = ex.Message });
        }
    }

    [HttpPost("email/{code}/preview")]
    public async Task<IActionResult> PreviewEmail(string code, [FromBody] Dictionary<string, string> variables, CancellationToken ct)
    {
        try
        {
            var subject = _service.RenderEmailSubject(code, variables);
            var body = _service.RenderEmailBody(code, variables);
            return Ok(new { Subject = subject, Body = body });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { Message = ex.Message });
        }
    }

    [HttpGet("sms")]
    public async Task<IActionResult> GetSmsTemplates(CancellationToken ct)
    {
        var templates = await _service.GetAllSmsTemplatesAsync(ct);
        return Ok(templates);
    }

    [HttpPost("sms")]
    public async Task<IActionResult> CreateSmsTemplate([FromBody] CreateSmsTemplateCommand command, CancellationToken ct)
    {
        var template = await _service.CreateSmsTemplateAsync(command, ct);
        return CreatedAtAction(nameof(GetSmsTemplates), template);
    }
}
```

---

## FRONTEND

### File: `services/templatesApi.ts`
```typescript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface EmailTemplate {
  id: string;
  code: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables: string[];
  isActive: boolean;
  version: number;
}

export interface SmsTemplate {
  id: string;
  code: string;
  name: string;
  body: string;
  variables: string[];
  isActive: boolean;
  version: number;
}

export interface TemplatePreview {
  subject: string;
  body: string;
}

export const templatesApi = {
  // Email templates
  getEmailTemplates: async (): Promise<EmailTemplate[]> => {
    const response = await axios.get(`${API_BASE}/templates/email`);
    return response.data;
  },

  getEmailTemplate: async (code: string): Promise<EmailTemplate> => {
    const response = await axios.get(`${API_BASE}/templates/email/${code}`);
    return response.data;
  },

  createEmailTemplate: async (data: Partial<EmailTemplate>): Promise<EmailTemplate> => {
    const response = await axios.post(`${API_BASE}/templates/email`, data);
    return response.data;
  },

  updateEmailTemplate: async (code: string, data: Partial<EmailTemplate>): Promise<void> => {
    await axios.put(`${API_BASE}/templates/email/${code}`, data);
  },

  previewEmail: async (code: string, variables: Record<string, string>): Promise<TemplatePreview> => {
    const response = await axios.post(`${API_BASE}/templates/email/${code}/preview`, variables);
    return response.data;
  },

  // SMS templates
  getSmsTemplates: async (): Promise<SmsTemplate[]> => {
    const response = await axios.get(`${API_BASE}/templates/sms`);
    return response.data;
  },

  createSmsTemplate: async (data: Partial<SmsTemplate>): Promise<SmsTemplate> => {
    const response = await axios.post(`${API_BASE}/templates/sms`, data);
    return response.data;
  },
};
```

### File: `pages/EmailTemplates.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Grid, Box, Chip, Tabs, Tab
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi, EmailTemplate, SmsTemplate } from '../services/templatesApi';
import { toast } from 'react-hot-toast';

export const EmailTemplatesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<{ subject: string; body: string } | null>(null);

  const { data: emailTemplates = [], isLoading: emailLoading } = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: templatesApi.getEmailTemplates,
  });

  const { data: smsTemplates = [], isLoading: smsLoading } = useQuery({
    queryKey: ['smsTemplates'],
    queryFn: templatesApi.getSmsTemplates,
  });

  const handlePreview = async (template: EmailTemplate) => {
    setSelectedTemplate(template);
    // Initialize variables with empty values
    const vars: Record<string, string> = {};
    template.variables.forEach(v => { vars[v] = ''; });
    setPreviewVariables(vars);
    setPreviewDialogOpen(true);
  };

  const handlePreviewSubmit = async () => {
    if (!selectedTemplate) return;
    try {
      const result = await templatesApi.previewEmail(selectedTemplate.code, previewVariables);
      setPreviewResult(result);
    } catch (error) {
      toast.error('Chyba při generování náhledu');
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Šablony notifikací
        </Typography>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Email šablony" />
          <Tab label="SMS šablony" />
        </Tabs>

        {tab === 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Kód</TableCell>
                  <TableCell>Název</TableCell>
                  <TableCell>Předmět</TableCell>
                  <TableCell>Variabl