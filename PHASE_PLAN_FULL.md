# SportMedical Diagnostics — Complete Development Plan

**Created:** September 2, 2026  
**Status:** Awaiting approval

---

## Architecture Overview

### Three Apps, One Domain

```
sportmedical-diagnostics.cz/          → PUBLIC WEBSITE (React SPA)
sportmedical-diagnostics.cz/client    → CLIENT PORTAL (React SPA)
sportmedical-diagnostics.cz/portal    → STAFF PORTAL (React SPA — existing, improved)
```

### Monorepo Structure

```
sportmedical-diagnostics/
├── apps/
│   ├── public-website/          # New — replaces Shopify
│   │   ├── src/
│   │   │   ├── pages/           # Home, Services, Pricing, Booking, Contact, About
│   │   │   ├── components/      # Header, Footer, ServiceCard, BookingForm
│   │   │   ├── api/             # Shared API client
│   │   │   └── theme/           # Public site theme
│   │   └── package.json
│   │
│   ├── client-portal/           # New — client-facing
│   │   ├── src/
│   │   │   ├── pages/           # Dashboard, Appointments, Documents, Reports, Profile, Wearables
│   │   │   ├── components/      # AppointmentCard, DocumentList, QuestionnaireForm
│   │   │   ├── api/             # Client API calls
│   │   │   └── auth/            # Client auth flow
│   │   └── package.json
│   │
│   └── staff-portal/            # Existing — improved
│       ├── src/
│       │   ├── pages/           # All existing pages (fixed)
│       │   ├── components/      # All existing components (improved)
│       │   ├── api/             # All existing API calls (aligned)
│       │   └── store/           # Zustand stores
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── types/               # Shared TypeScript types
│       ├── api-client/          # Axios instance with interceptors
│       ├── utils/               # Date formatting, validation, etc.
│       └── constants/           # Enums, status codes, etc.
│
├── backend/                     # Existing .NET API
│   └── src/
│       └── SportMedical.Diagnostics.Api/
│
├── package.json                 # Root workspace config
├── turbo.json                   # Turborepo config
└── docker-compose.yml           # All services
```

---

## Phase 1: Fix Critical Bugs

**Goal:** Make existing features work correctly.

### 1.1 Calendar Saving Bug
- [ ] Reproduce "chyba pri ukladani" error
- [ ] Check `CalendarController.Create` endpoint
- [ ] Verify `CreateAppointmentRequest` fields match frontend
- [ ] Fix any type mismatches
- [ ] Test end-to-end: create appointment → verify in database

### 1.2 Player Data Saving Bug
- [ ] Find the player/athlete creation flow
- [ ] Check `TeamsController` or `AthleteMonitoringController`
- [ ] Verify request/response types match
- [ ] Fix and test

### 1.3 Injury Record Saving Bug
- [x] Fixed in Phase 1 Piece 3 (added `InjuryDate`, `IsRecurrence`, `Notes`)
- [ ] Verify end-to-end: create injury → appears in list

### 1.4 Invoicing Broken
- [x] Added missing endpoints in Phase 1 Piece 1
- [x] Fixed `PatientName` in DTO
- [x] Fixed patients list population
- [ ] Test full flow: create invoice → add line items → batch submit

### 1.5 Report Saving Bug
- [ ] Find the report generation/save flow
- [ ] Check `ReportsController` or PDF generation
- [ ] Fix and test

### 1.6 Vite Dev Server Stability
- [ ] Check for infinite re-render loops
- [ ] Check for memory leaks in hot reload
- [ ] Add error boundaries
- [ ] Test长时间 dev session

---

## Phase 2: Public Website (Replacing Shopify)

**Goal:** Clean, professional website with booking capability.

### 2.1 Project Setup
- [ ] Create `apps/public-website/` in monorepo
- [ ] Set up React + Vite + TypeScript + MUI
- [ ] Configure routing (React Router)
- [ ] Set up shared API client from `packages/shared/`
- [ ] Configure build output for single-domain deployment

### 2.2 Layout & Navigation
- [ ] **Header:** Logo, navigation links, Client Login/Register button (top right)
- [ ] **Footer:** Contact info, social links, Staff Access link (discreet, bottom right)
- [ ] **Responsive:** Mobile-first design
- [ ] **Language switcher:** Czech (default), Slovak, English

### 2.3 Home Page (`/`)
- [ ] Hero section with clinic name and tagline
- [ ] Services overview (3-4 cards)
- [ ] Why choose us section
- [ ] Quick booking CTA
- [ ] Testimonials (optional)

### 2.4 Services Page (`/sluzby`)
- [ ] List all services with descriptions
- [ ] Service categories (Prohlídka, Diagnostika, Měření, Terapie)
- [ ] Duration and pricing for each
- [ ] "Book this service" button on each

### 2.5 Pricing Page (`/cenik`)
- [ ] Full price list table
- [ ] Service codes, names, durations, prices
- [ ] Insurance information
- [ ] Downloadable PDF price list (optional)

### 2.6 Booking Calendar (`/rezervace`)
- [ ] Service selection dropdown
- [ ] Calendar view showing available dates
- [ ] Time slot selection (based on worker availability)
- [ ] Worker/practitioner display
- [ ] Registration form (comprehensive data collection):
  - [ ] First name, last name
  - [ ] Email, phone
  - [ ] Date of birth
  - [ ] Gender (Male/Female only)
  - [ ] Insurance provider
  - [ ] Sport type and position
  - [ ] Medical history summary
- [ ] Duplicate ID prevention (check existing clients by email/phone)
- [ ] Mandatory questionnaire after registration
- [ ] Required document uploads:
  - [ ] Výpis ze zdravotní dokumentace (first visit only)
  - [ ] Dotazník před prohlídkou
  - [ ] GDPR souhlas (first visit only)
  - [ ] Zákonný zástupce (for under 18)
- [ ] Confirmation page with details

### 2.7 Contact Page (`/kontakt`)
- [ ] Address, phone, email
- [ ] Map (Google Maps embed)
- [ ] Opening hours
- [ ] Contact form (optional)

### 2.8 About Us Page (`/o-nas`)
- [ ] Clinic description
- [ ] Team photos/bios
- [ ] Certifications
- [ ] Values/mission

### 2.9 Email Confirmation
- [ ] Booking confirmation email
- [ ] ICS calendar invite attachment
- [ ] Include: time, appointment type, address

---

## Phase 3: Client Portal

**Goal:** Clients can manage their appointments, documents, and profile.

### 3.1 Project Setup
- [ ] Create `apps/client-portal/` in monorepo
- [ ] Set up React + Vite + TypeScript + MUI
- [ ] Client authentication flow (separate from staff)
- [ ] Route protection (redirect to login if not authenticated)

### 3.2 Authentication
- [ ] Login page (`/client/login`)
- [ ] Register page (`/client/register`) — for clients who booked but don't have account yet
- [ ] Password reset flow
- [ ] JWT token management
- [ ] Session timeout

### 3.3 Client Dashboard (`/client`)
- [ ] Welcome message with client name
- [ ] Upcoming appointments (next 3)
- [ ] Pending documents (if any)
- [ ] Recent reports
- [ ] Quick actions (book new appointment, view documents)

### 3.4 Appointments (`/client/appointments`)
- [ ] List all appointments (past and future)
- [ ] Appointment details (date, time, service, practitioner)
- [ ] Cancel appointment (with confirmation)
- [ ] Reschedule (if allowed)
- [ ] Add to calendar (ICS download)

### 3.5 Documents (`/client/documents`)
- [ ] List all documents (GDPR, medical history, questionnaires)
- [ ] Document status (signed, pending, expired)
- [ ] Download PDF
- [ ] Upload required documents
- [ ] Complete questionnaires online
- [ ] Document expiry warnings

### 3.6 Reports (`/client/reports`)
- [ ] List all diagnostic reports
- [ ] View report details
- [ ] Download PDF report
- [ ] Share report (generate link)

### 3.7 Profile (`/client/profile`)
- [ ] View/edit personal information
- [ ] Change password
- [ ] Manage insurance information
- [ ] Sport-specific data
- [ ] Communication preferences

### 3.8 Wearables (`/client/wearables`)
- [ ] Connect device (enter device ID)
- [ ] View synced health data
- [ ] Disconnect device
- [ ] Data privacy consent

---

## Phase 4: Staff Portal Improvements

**Goal:** Polish the existing staff portal for production use.

### 4.1 Sidebar Reorganization
- [ ] Group menu items logically:
  - **Dashboard:** Přehled
- [ ] **Patients:** Pacienti, Registrace klienta
- [ ] **Clinical:** Kalendář, Diagnostika, Měření, Poranění, Návrat do hry, PPE Prohlídka, Otřes mozku
- [ ] **Analytics:** Reporty, AI Riziko, Tréninkové zatížení, Wellness
- [ ] **Operations:** Fakturace, Ceník, Dokumenty, Sklad
- [ ] **Staff:** Zaměstnanci, Týmy, Dostupnost
- [ ] **System:** Administrace, Nastavení, Číselník, Monitoring
- [ ] Icons for each group
- [ ] Collapsible sections

### 4.2 Universal Search
- [ ] Search in EVERY section (Ctrl+K shortcut)
- [ ] Search by ANY field: ID, email, phone, name, insurance, diagnosis
- [ ] Smart suggestions:
  - [ ] Type "f" → shows "football", "floorball", "fyzioterapie"
  - [ ] Type "kol" → shows "koleno", "kolkovní"
- [ ] Debounced input (300ms)
- [ ] Keyboard navigation (arrow keys, Enter to select)
- [ ] Recent searches
- [ ] Search results grouped by type (patients, appointments, invoices, etc.)

### 4.3 Settings Panel Expansion
- [ ] **Visual Settings:**
  - [ ] Theme (light/dark)
  - [ ] Primary color picker
  - [ ] Sidebar position (left/right)
  - [ ] Font size
- [ ] **Email Settings:**
  - [ ] Enable/disable appointment confirmations
  - [ ] Enable/disable follow-up reminders
  - [ ] Enable/disable report notifications
  - [ ] Custom email templates
- [ ] **Calendar Settings:**
  - [ ] Default appointment duration
  - [ ] Working hours
  - [ ] Buffer time between appointments
  - [ ] Appointment types
- [ ] **Notification Settings:**
  - [ ] Browser notifications
  - [ ] Email notifications
  - [ ] Sound alerts
- [ ] **System Settings (Admin only):**
  - [ ] User management
  - [ ] Role permissions
  - [ ] Backup settings
  - [ ] Audit log

### 4.4 Notification System
- [ ] In-app notification bell (top bar)
- [ ] Notification dropdown
- [ ] Mark as read/unread
- [ ] Notification types:
  - [ ] New appointment booked
  - [ ] Document uploaded
  - [ ] Report ready
  - [ ] System alerts
- [ ] Real-time updates via SignalR

### 4.5 Dark/Light Mode Polish
- [ ] All components respect theme
- [ ] Charts adapt to dark mode
- [ ] Tables adapt to dark mode
- [ ] Transitions smooth
- [ ] System preference detection

### 4.6 Performance Tracking
- [ ] Staff dashboard showing:
  - [ ] Clients served today/this week/this month
  - [ ] Average time per client
  - [ ] Start and end times of workday
  - [ ] Activity log
- [ ] Export to CSV/Excel
- [ ] Bonus calculation display
- [ ] Workers CANNOT see company revenue

---

## Phase 5: Communication & Automation

**Goal:** Automated emails, calendar invites, and follow-ups.

### 5.1 Email Integration
- [ ] Set up email provider (Gmail SMTP or SendGrid)
- [ ] Email templates:
  - [ ] Appointment confirmation
  - [ ] Appointment reminder (24h before)
  - [ ] Follow-up invitation
  - [ ] Report ready
  - [ ] Document required
- [ ] Admin can enable/disable each template
- [ ] Email queue for reliability

### 5.2 ICS Calendar Invites
- [ ] Generate ICS files for appointments
- [ ] Include: date, time, duration, service type, practitioner, address
- [ ] Compatible with Apple Calendar, Google Calendar, Outlook
- [ ] Attach to confirmation emails

### 5.3 PDF Report Generation
- [ ] Professional branded PDF template
- [ ] Include: patient info, diagnostic results, charts, recommendations
- [ ] Generate after each diagnostic session
- [ ] Auto-send to client via email
- [ ] Store in patient documents

### 5.4 Automated Follow-ups
- [ ] Admin sets follow-up intervals (3, 7, 8 months, etc.)
- [ ] System checks last appointment date
- [ ] Auto-send invitation email when interval reached
- [ ] Track: sent, opened, booked
- [ ] Admin dashboard for follow-up statistics

### 5.5 Notification System
- [ ] Real-time notifications via SignalR
- [ ] Browser push notifications
- [ ] Notification preferences per user
- [ ] Notification history

---

## Phase 6: Security & Access Control

**Goal:** Production-grade security.

### 6.1 Three Permission Tiers
- [ ] **Admin:** Full control, edits system settings, grants permissions
- [ ] **Manager/Boss:** Grants permissions, oversees operations
- [ ] **Worker:** Limited access based on role
- [ ] Role-based access control (RBAC) on every endpoint
- [ ] Frontend route guards based on role
- [ ] UI elements hidden/disabled based on permissions

### 6.2 Data Security
- [ ] SHA-256 hashing for sensitive data
- [ ] Password hashing (bcrypt)
- [ ] JWT tokens with short expiry (15 min)
- [ ] Refresh token rotation
- [ ] Rate limiting on login (5 attempts per minute)
- [ ] Account lockout after failed attempts

### 6.3 Audit & Compliance
- [ ] Audit log for all data changes
- [ ] GDPR compliance:
  - [ ] Data export
  - [ ] Data deletion
  - [ ] Consent tracking
- [ ] Session management
- [ ] IP logging

---

## Phase 7: Language & Accessibility

**Goal:** Multi-language support and WCAG 2.2 compliance.

### 7.1 Multi-language
- [ ] Czech (default)
- [ ] Slovak
- [ ] English
- [ ] i18n library (react-i18next)
- [ ] Language switcher in header
- [ ] All UI text translated
- [ ] Date/number formatting per locale

### 7.2 Accessibility (WCAG 2.2)
- [ ] Skip links
- [ ] ARIA live regions
- [ ] Keyboard navigation (all interactive elements)
- [ ] Screen reader support
- [ ] Color contrast (4.5:1 minimum)
- [ ] Focus indicators
- [ ] Alt text for images
- [ ] Form labels and error messages

---

## Phase 8: Testing & Quality

**Goal:** Production-ready quality.

### 8.1 Unit Tests
- [ ] Backend: All controllers
- [ ] Backend: All domain logic
- [ ] Frontend: All API functions
- [ ] Frontend: All utility functions

### 8.2 Integration Tests
- [ ] Full booking flow (public site → client portal)
- [ ] Full staff workflow (login → patient → diagnostics → report)
- [ ] Invoice creation and submission
- [ ] Document upload and signing

### 8.3 E2E Tests
- [ ] Playwright tests for critical paths
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsive testing

### 8.4 Performance
- [ ] Lighthouse score > 90
- [ ] Bundle size optimization
- [ ] Lazy loading for all routes
- [ ] Image optimization

---

## Phase 9: Deployment

**Goal:** Production deployment.

### 9.1 Infrastructure
- [ ] Docker containers for all apps
- [ ] Docker Compose for local development
- [ ] Production Docker Compose
- [ ] Nginx reverse proxy configuration

### 9.2 Domain & SSL
- [ ] Configure sportmedical-diagnostics.cz
- [ ] SSL certificates (Let's Encrypt)
- [ ] DNS configuration
- [ ] Redirect HTTP to HTTPS

### 9.3 CI/CD
- [ ] GitHub Actions pipeline
- [ ] Automated testing on PR
- [ ] Automated deployment on merge to main
- [ ] Rollback capability

### 9.4 Monitoring
- [ ] Application health checks
- [ ] Error tracking (Sentry or similar)
- [ ] Performance monitoring
- [ ] Uptime monitoring

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Bug Fixes | 1-2 days | None |
| Phase 2: Public Website | 3-5 days | Phase 1 |
| Phase 3: Client Portal | 5-7 days | Phase 2 |
| Phase 4: Staff Improvements | 3-5 days | Phase 1 |
| Phase 5: Communication | 3-5 days | Phase 3 |
| Phase 6: Security | 2-3 days | Phase 4 |
| Phase 7: Language/A11y | 2-3 days | Phase 4 |
| Phase 8: Testing | 3-5 days | All phases |
| Phase 9: Deployment | 1-2 days | Phase 8 |

**Total estimated: 23-37 days**

---

## Technology Stack (Confirmed)

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, MUI, Zustand, Framer Motion |
| Backend | .NET 10, C# 14, PostgreSQL, EF Core |
| Real-time | SignalR |
| Email | Gmail SMTP or SendGrid (TBD) |
| PDF | jsPDF or Puppeteer |
| Calendar | ICS generation library |
| i18n | react-i18next |
| Testing | Vitest, Playwright |
| Deployment | Docker, Nginx |

---

**This is the complete plan. Do you approve? Should I adjust anything?**
