# REPORT — Session 2026-08-29 (Session 3)
## Backend Foundation: Ceník, Documents, Legal Gates, Sqlite

---

## COMPLETED THIS SESSION

### A2. Ceník Entity + Service Catalog ✅
| Component | Status | File |
|-----------|--------|------|
| `ServiceItem` entity | ✅ Existed | `Domain/Services/ServiceItem.cs` |
| `ServiceCatalogService` | ✅ Existed | `Persistence/Operational/ServiceCatalogService.cs` |
| `ServicesController` API | ✅ Existed | `Api/Controllers/ServicesController.cs` |
| `ServiceItemDtos` | ✅ Existed | `Contracts/Services/ServiceItemDtos.cs` |
| **Seed 8 services** | ✅ **Added** | `Persistence/PersistenceServiceExtensions.cs` |

**8 Services Seeded:**
| Code | Name | Duration | Price |
|------|------|----------|-------|
| ZP | Základní prohlídka | 30 min | 1 500 Kč |
| KP | Komplexní prohlídka | 60 min | 3 000 Kč |
| SPG | Spiroergometrie | 90 min | 4 500 Kč |
| ZD | Základní diagnostika | 45 min | 2 000 Kč |
| KD | Komplexní diagnostika | 90 min | 5 000 Kč |
| VO2 | VO2max | 60 min | 3 500 Kč |
| VKP | Video kompenzační plány | 45 min | 2 500 Kč |
| IB770 | InBody770 | 15 min | 800 Kč |

**API Endpoints:**
- `GET /api/services` — list all active services
- `GET /api/services/{id}` — get service by ID
- `POST /api/services` — create new service
- `PUT /api/services/{id}` — update service
- `DELETE /api/services/{id}` — archive (soft delete)

---

### A3. Document Management ✅
| Component | File |
|-----------|------|
| `DocumentTemplate` entity | `Domain/Documents/DocumentTemplate.cs` |
| `PatientDocument` entity | `Domain/Documents/PatientDocument.cs` |
| `IDocumentRepository` | `Application/Documents/IDocumentRepository.cs` |
| `IDocumentService` | `Application/Documents/IDocumentService.cs` |
| `DocumentRepository` (EF) | `Persistence/Documents/DocumentRepository.cs` |
| `DocumentService` | `Persistence/Documents/DocumentService.cs` |
| `DocumentsController` API | `Api/Controllers/DocumentsController.cs` |
| DbContext DbSets | `SportMedicalDbContext.cs` |

**7 Document Templates Seeded:**
| Type | Name | Required | First Visit | Age Gated |
|------|------|----------|-------------|-----------|
| Vypis | Výpis ze zdravotní dokumentace | ✅ | ✅ | ❌ |
| Dotaznik | Dotazník zdravotního stavu | ✅ | ❌ | ❌ |
| GDPR | GDPR souhlas se zpracováním osobních údajů | ✅ | ✅ | ❌ |
| ZakonnyZastupce | Prohlášení zákonného zástupce | ✅ | ❌ | ✅ (<18) |
| InformovanySouhlas | Informovaný souhlas | ❌ | ❌ | ❌ |
| Cenik | Ceník poskytovaných služeb | ❌ | ❌ | ❌ |
| Podminky | Podmínky poskytování služeb | ❌ | ❌ | ❌ |

**API Endpoints:**
- `GET /api/documents/templates` — list active templates
- `GET /api/documents/templates/{id}` — get template by ID
- `GET /api/documents/patient/{id}` — list patient documents
- `GET /api/documents/patient/{id}/check` — check required documents
- `GET /api/documents/patient/{id}/summary` — status summary for UI badges
- `POST /api/documents/upload` — upload document for patient
- `POST /api/documents/{id}/sign` — mark document as signed

---

### A4. Legal Gates ✅
| Component | File |
|-----------|------|
| `IDocumentGateService` | `Application/Documents/IDocumentGateService.cs` |
| `DocumentGateService` | `Persistence/Documents/DocumentGateService.cs` |

**Gate Rules:**
- `CanBookAppointmentAsync` — blocks if Výpis/GDPR/guardian missing
- `CanCreateInvoiceAsync` — blocks if required documents missing
- `CanStartDiagnosticAsync` — blocks if Výpis/GDPR missing

**Error messages (Czech):**
- "Nelze rezervovat termín — chybí povinné dokumenty: ..."
- "Nelze vystavit fakturu — chybí povinné dokumenty: ..."
- "Nelze spustit diagnostiku — chybí povinné dokumenty: ..."

---

### A6. Sqlite Default ✅
| Change | Before | After |
|--------|--------|-------|
| `Database:Provider` | `InMemory` | **`Sqlite`** |
| Data persistence | Lost on restart | **Survives restart** ✅ |

**Config:** `appsettings.json` → `Database.Provider = "Sqlite"`, `Database.SqlitePath = "sportmedical.db"`

---

## BUILD STATUS
- ✅ **Full API build succeeded** (0 errors, 0 warnings)
- Projects compiled: Domain → Contracts → Application → Integrations → Infrastructure → Rules → Reporting → Knowledge → Persistence → Api

---

## NEW API ENDPOINTS (This Session)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/services` | List 8 services from Ceník |
| `GET` | `/api/services/{id}` | Get service details |
| `POST` | `/api/services` | Create new service |
| `PUT` | `/api/services/{id}` | Update service |
| `DELETE` | `/api/services/{id}` | Archive service |
| `GET` | `/api/documents/templates` | List 7 document templates |
| `GET` | `/api/documents/templates/{id}` | Get template details |
| `GET` | `/api/documents/patient/{id}` | Patient documents list |
| `GET` | `/api/documents/patient/{id}/check` | Check required docs |
| `GET` | `/api/documents/patient/{id}/summary` | Status summary (badges) |
| `POST` | `/api/documents/upload` | Upload document |
| `POST` | `/api/documents/{id}/sign` | Sign document |

**Total API endpoints: 28 (existing) + 12 (new) = 40**

---

## FULL PROJECT STATUS (Cumulative)

| Phase | Status | Notes |
|-------|--------|-------|
| A1. SchedulingPolicies | ✅ Fixed | 08:00-18:00, Ne closed, rooms, devices |
| A2. Ceník Entity | ✅ Done | 8 services seeded + API |
| A3. Document Management | ✅ Done | 7 templates + CRUD + status checks |
| A4. Legal Gates | ✅ Done | Blocks booking/billing/diagnostics |
| A5. Identity/Auth | ❌ Not started | Duende not wired |
| A6. EF Migration + Sqlite | ✅ Done | Default provider = Sqlite |
| A7. Audit Trail | ❌ Not started | No interceptor |
| C2. Frontend Pages | ✅ 12 pages | All Czech |
| C3. Design Language | ✅ Complete | Teal theme + dark mode |
| C4. API Layer | ✅ 6 modules | Typed endpoints |

---

## FILES CREATED THIS SESSION

### Backend — Domain
- `src/SportMedical.Diagnostics.Domain/Documents/DocumentTemplate.cs`
- `src/SportMedical.Diagnostics.Domain/Documents/PatientDocument.cs`

### Backend — Application
- `src/SportMedical.Diagnostics.Application/Documents/IDocumentService.cs`
- `src/SportMedical.Diagnostics.Application/Documents/IDocumentRepository.cs`
- `src/SportMedical.Diagnostics.Application/Documents/IDocumentGateService.cs`

### Backend — Persistence
- `src/SportMedical.Diagnostics.Persistence/Documents/DocumentRepository.cs`
- `src/SportMedical.Diagnostics.Persistence/Documents/DocumentService.cs`
- `src/SportMedical.Diagnostics.Persistence/Documents/DocumentGateService.cs`

### Backend — API
- `src/SportMedical.Diagnostics.Api/Controllers/DocumentsController.cs`

### Backend — Modified
- `src/SportMedical.Diagnostics.Domain/Scheduling/SchedulingPolicies.cs` (Session 2)
- `src/SportMedical.Diagnostics.Persistence/Database/SportMedicalDbContext.cs` (added DbSets)
- `src/SportMedical.Diagnostics.Persistence/PersistenceServiceExtensions.cs` (seed data)
- `src/SportMedical.Diagnostics.Api/Program.cs` (service registration)
- `src/SportMedical.Diagnostics.Api/appsettings.json` (Sqlite default)

---

## NEXT PRIORITIES (Per MASTER-PLAN)

| Order | Task | Est. | Impact |
|-------|------|------|--------|
| 1 | **A5. Identity/Auth (Duende)** | 6h | RBAC security |
| 2 | **A7. Audit Trail** | 3h | Compliance (vyhláška 391/2013) |
| 3 | **B1. ForceDecks/HumanTrak Import** | 4h | Device integration |
| 4 | **D1. Legal Gate UI** | 3h | Desktop banners |
| 5 | **D3. Ceník UI** | 2h | Desktop services view |

---

## HANDOFF INSTRUCTIONS

**To continue from here:**
1. Run `dotnet build` in SportMedical.Diagnostics to verify
2. Run `cd sportmedical-frontend && npm run dev` to see Czech UI + dark mode
3. Next task: **A5** — Wire Duende IdentityServer for RBAC
4. Then **A7** — Audit trail via SaveChangesInterceptor

**Key decisions made:**
- DocumentType enum: Vypis=0, Dotaznik=1, GDPR=2, ZakonnyZastupce=3, InformovanySouhlas=4, Cenik=5, Podminky=6
- DocumentStatus enum: Pending=0, SignedOff=1, Expired=2, Superseded=3, Rejected=4
- Sqlite as default provider (data survives restart)
- Legal gates return Czech error messages
- ServiceItem.Code: ZP, KP, SPG, ZD, KD, VO2, VKP, IB770
