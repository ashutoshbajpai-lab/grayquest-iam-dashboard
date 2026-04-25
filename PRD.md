# GrayQuest IAM Analytics Dashboard — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-04-26  
**Author:** Senior Staff Engineer (Claude Sonnet 4.6)  
**Status:** Draft — Pending Stakeholder Review  
**Audience:** Engineers, Product Managers, Security, Operations

---

## Reasoning Record

### Pass 1 — Discovery Summary

The codebase is a Next.js 16.2.4 / React 19.2.4 / TypeScript 5 / Tailwind CSS 4 internal analytics dashboard. It consumes pre-computed snapshots of GrayQuest's IAM activity data (platform_id=6) and presents it across five sections. Auth is a single bcrypt-protected credential stored in env vars. Two AI models are used: Google Gemini 2.0 Flash (cloud) and qwen2.5:0.5b via local Ollama. Data flows: CSV import pipeline → 7 Supabase raw tables → compute engine → 13 dx_* JSON snapshots → dashboard pages.

### Pass 2 — Contradictions Found

| ID | Location | Contradiction | Severity |
|----|----------|--------------|----------|
| C1 | config.ts HEALTH constants | Comment says "0–10 scale"; thresholds are 6 and 4; compute.ts produces 0–100 values; avg health ≈ 76.5; alert `< 6` never fires | CRITICAL |
| C2 | compute.ts end | Builds 4 of 13 datasets then `// ... Save to Supabase (Omitted for brevity)` — save logic missing or truncated | HIGH |
| C3 | middleware.ts | Protects /dashboard/* only; /api/alerts, /api/chat, /api/metrics/* are fully unauthenticated | HIGH |
| C4 | OLLAMA_URL | localhost:11434 is unreachable on Vercel production; UI badge "⚡ qwen2.5" is misleading in prod | MEDIUM |
| C5 | constants.ts | `TODAY = "2026-03-31"` hardcoded; stale after data refresh until manual edit + redeploy | MEDIUM |
| C6 | dx_users.json | Field named `auth_success_rate`; code references `login_success_rate` → renders as `undefined%` | MEDIUM |
| C7 | recompute/route.ts | `if (secret)` guard means no secret = no auth required to trigger full recompute | MEDIUM |
| C8 | login/page.tsx | Footer shows `platform_id=7`; actual platform is 6 | LOW |
| C9 | AlertsPanel.tsx | Dismissals stored in useState only; reset on every page refresh | LOW |
| C10 | package.json | `csv-parse` dependency present; zero usage in TypeScript source | LOW |
| C11 | All page loaders | `force-dynamic` + full dataset load on every request; no server-side filter pushdown | MEDIUM |
| C12 | useRealtimeSnapshot.ts | Defined but imported by zero production components | LOW |
| C13 | metricsStore.ts | `result: string | number` type; localStorage always serializes to string; numeric ops silently fail | LOW |

### Pass 3 — Resolutions

**R1 (C1):** Set `HEALTH.ACTIVE=60, HEALTH.AT_RISK=40` to match 0–100 compute output. Mark this as a blocking bug fix in Phase 1 backlog.  
**R2 (C2):** Treat compute.ts as likely complete in the actual file (context window truncation). Verify by running `/api/recompute` and checking Supabase. Document that the 13 JSON files are the authoritative read path.  
**R3 (C3):** Add token verification middleware to /api/* routes. Short-term acceptable for internal-only deployment with Vercel's preview auth.  
**R4 (C4):** Update sidebar copy to "qwen2.5 (local) · Gemini (cloud)". Auto-detect Ollama availability and suppress badge if unreachable.  
**R5 (C5):** Derive reference date dynamically from max date in `dx_dau_series.json`. Document as manual maintenance step until automated.  
**R6 (C6):** Normalize field name to `login_success_rate` throughout pipeline and JSON.  
**R7 (C7):** Make `RECOMPUTE_SECRET` mandatory (throw on startup if missing).  
**R8 (C13):** Change `CustomMetric.result` to `string` only.

---

## 1. Executive Summary

GrayQuest IAM Analytics Dashboard is an internal web application that transforms raw Identity & Access Management activity logs into actionable intelligence for the GrayQuest platform operations team. It gives a single authorised operator a real-time view of which users are active, healthy, and engaged across GrayQuest's 27 IAM services, and surfaces anomalies via threshold-based alerting before they escalate into support tickets or compliance incidents.

**Business problem solved:** Before this dashboard, understanding user adoption, service reliability, and engagement patterns required direct database queries or ad-hoc Python scripts run by an engineer. The typical lag from "something seems wrong" to "we have a number" was measured in hours. This dashboard reduces that to seconds.

**Measurable success metrics:**

| Metric | Target | How Measured |
|--------|--------|-------------|
| Time-to-insight for ad-hoc data questions | < 30 seconds | Chat → first response latency |
| Alert detection lag (threshold breach → visible alert) | < 5 minutes | Time between data refresh and alert firing |
| Dashboard first-load time (p95) | < 2 seconds | Vercel function logs |
| Custom metric computation (builtin path) | < 500 ms | /api/metrics/compute response time |
| Data freshness | < 24 hours behind actual events | Time delta between max event timestamp and deployment |
| Uptime | 99.5% monthly | Vercel SLA |

**Stakeholder sign-off required:**
- Product: Ashutosh Bajpai (primary owner)
- Engineering: Backend team lead (data pipeline contract)
- Security: Review of API authentication gap (C3)
- DevOps/Infra: Supabase and Vercel environment management

---

## 2. Problem Statement & Motivation

GrayQuest's IAM platform manages access for 281 users across 11+ active services. These users span roles including Group Manager, Block Master Dashboard, Institute Admin, and Backend Engineer. Each day, ~57 users log in and generate thousands of events across services like Student Fee Headers (2,497 events/30d), Payment Link Communication (2,619 events/30d), and Master Dashboard (622 events/30d).

**Without this dashboard, the following problems are undetected until they become critical:**

1. **User disengagement goes unnoticed.** 78 of 281 users are dormant (no activity in 30 days). Without the health score system, there is no early-warning signal that a previously active role is dropping off — the first signal would be a support call.

2. **Service failures are invisible without aggregation.** Admission Leads has an 85.7% success rate — the lowest of any service. Without a ranked reliability view, this would be found only by ad-hoc queries or user complaints.

3. **Platform quality cannot be benchmarked.** The platform's 99.1% overall success rate is strong, but without industry comparison, there is no way to prioritise improvement investment. The Gemini benchmark integration addresses this.

4. **Custom analysis requires engineering time.** Questions like "What is the DAU/MAU ratio?" or "Which role has the worst average session health?" previously required someone to write a query. The Metrics Builder reduces this to a text prompt.

5. **Cross-functional reporting is manual.** Monthly IAM health reports were generated by pulling numbers from multiple sources. The Health and People sections automate this.

**Signal from the code:** The alert engine currently evaluates 10 threshold rules. The `HEALTH.AVG_ALERT` alert (`avg_health_score < 6`) never fires due to the scale mismatch bug (C1). This means the most important people-level health alert is silently broken — a concrete example of a problem that requires this PRD to surface and prioritise.

---

## 3. Goals & Non-Goals

### Goals

| ID | Goal |
|----|------|
| G1 | Provide a single-pane view of GrayQuest IAM user activity, health, and engagement |
| G2 | Surface threshold-based alerts for people, service, and health metrics without manual monitoring |
| G3 | Enable ad-hoc metric computation via natural language or formula syntax |
| G4 | Allow AI-assisted Q&A grounded in actual platform data |
| G5 | Support industry benchmark comparisons for key metrics via Gemini |
| G6 | Allow metrics to be pinned to dashboard sections for persistent visibility |
| G7 | Provide per-user and per-service drill-down for root-cause investigation |
| G8 | Support dark mode and responsive layout down to tablet viewport |
| G9 | Maintain data freshness within 24 hours of actual events via webhook-triggered recompute |

### Non-Goals

| ID | Non-Goal | Reason |
|----|----------|--------|
| NG1 | Multi-user authentication / RBAC | Single internal operator; complexity not justified |
| NG2 | Real-time event streaming (sub-minute latency) | Pre-computed snapshot model is sufficient; streaming requires infrastructure investment |
| NG3 | Write-back actions (creating users, modifying permissions) | Read-only analytics tool; writes belong in the IAM system itself |
| NG4 | Mobile-first / native mobile app | Internal tool used at desks; tablet-responsive is sufficient |
| NG5 | Multi-platform / multi-tenant support | Currently scoped to platform_id=6; generalisation is Phase 3 |
| NG6 | Historical trend comparison beyond 30 days in current UI | Data windows are precomputed; custom deep-history requires pipeline work |
| NG7 | Public API | All endpoints are internal; no external consumer planned |
| NG8 | Automated remediation (e.g., auto-deactivating dormant users) | This dashboard observes; it does not act |
| NG9 | Compliance audit log export | Out of scope for MVP; tracked as Phase 2 item |

---

## 4. User Personas & Journeys

### Persona 1: Ashutosh (IAM Operations Admin)

**Role:** The sole operator and owner of this dashboard. Primary viewer of all five sections.  
**Technical level:** High. Writes queries, understands the data model, knows what "cross-module rate" means.  
**Motivation:** Monitor platform health proactively; answer ad-hoc questions from product/business stakeholders without writing a database query.  
**Key tasks:** Daily health check, investigating user drop-off, tracking service reliability, building custom metrics for reports.  
**Frustrations:** Waiting for engineers to run queries; not knowing about problems until users report them; having to context-switch to Supabase UI for lookups.

**Daily journey:**
1. Opens dashboard at `https://gq-dashboard.vercel.app` → middleware validates JWT cookie → redirects to `/dashboard/people`
2. Scans five KPI cards: Active Users (57), Avg Health (76.5), New Activations (18), Session Rate, Total Sessions
3. Spots the "DAU vs 30d Avg" trend chart — notices a dip on 2026-03-28
4. Clicks on the TopBar bell icon → AlertsPanel opens → sees "111 users with health score below 4" (note: this is the broken threshold — sees nothing meaningful due to C1)
5. Navigates to Services → scans reliability bar chart → notes Admission Leads at 85.7%
6. Clicks Admission Leads card → ServiceDrawer opens → sees 14 events, 2 users, peak at hour 14
7. Opens Chat → types "Which users are having failures in Admission Leads?" → gets structured answer from builtin engine
8. Saves the result as a custom metric via the "Save to Metrics Builder" button
9. Navigates to Metrics Builder → pins the metric to the Services section
10. Returns to Services page → sees pinned metric at top of page

**Weekly journey:**
1. Pulls up Health section → checks 30-day success rate series → confirms no degradation
2. Checks cohort retention heatmap on People page → compares W1/W4 retention across cohorts
3. Runs benchmark query in Chat: "Is our 99.1% success rate good by industry standards?"
4. Builds a custom "Institute Admin Engagement" metric → saves and pins to People

---

## 5. Feature Specifications

### F1: Authentication (Login / Session / Logout)

**Description:** Single-user authentication via email + bcrypt password, JWT cookie session.

**User story:** As the IAM admin, I want to securely access the dashboard from any browser so that platform data is not accessible to unauthenticated parties.

**Acceptance criteria:**
1. Visiting `/` while unauthenticated redirects to `/login`
2. Visiting `/dashboard/*` while unauthenticated redirects to `/login`
3. Correct credentials issue an httpOnly JWT cookie with 8-hour expiry
4. Incorrect credentials show a visible error message without revealing which field is wrong
5. Visiting `/` while authenticated redirects to `/dashboard/people`
6. Clicking "Sign out" calls `POST /api/auth/logout`, deletes the cookie, and redirects to `/login`
7. An expired token is detected by middleware, cookie is deleted, and user is redirected to `/login`
8. The login form disables the submit button and shows a spinner during the fetch

**Priority:** P0  
**Dependencies:** JWT_SECRET env var, DASHBOARD_USER_EMAIL, DASHBOARD_USER_PASSWORD_HASH

---

### F2: People Section

**Description:** Overview of all IAM users with KPI cards, activity trend, role distribution, cohort retention, user table with search/filter, and per-user drill-down drawer.

**User story:** As the IAM admin, I want to see at a glance how many users are active and healthy so that I can detect disengagement trends before they become support incidents.

**Acceptance criteria:**
1. Page loads with five KPI cards: Active Users (filtered period), Avg Health Score, New Activations, Session Rate, Total Sessions
2. Trend values on KPI cards reflect percentage change vs the previous equivalent period
3. Activity trend chart switches between DAU / Sessions / Events views
4. Date preset filter (Today / 7d / 30d / Custom) updates KPIs and chart without page reload
5. Role multi-select filter scopes user table and KPIs to selected roles only
6. User table search matches against name and email, case-insensitive
7. User table initially shows 10 rows; "Show More" adds 20 more per click
8. Clicking a user row opens UserDrawer showing: health gauge, recent activity timeline, service breakdown, auth success rate
9. Cohort retention heatmap renders month cohorts on Y-axis and W1/W2/W4/M2/M3 columns on X-axis
10. Engagement depth line chart shows avg events/session by role
11. Pinned custom metrics (from Metrics Builder) appear above KPI cards
12. Clearing all filters restores default 30d view
13. Empty state message is displayed when no users match active filters

**Priority:** P0  
**Dependencies:** F1, dx_users, dx_overview, dx_dau_series, dx_role_distribution, dx_cohort_retention, dx_session_stats

---

### F3: Services Section

**Description:** Service catalog, event volume, success rates, traffic heatmap, events feed, and per-service drill-down.

**User story:** As the IAM admin, I want to know which services have reliability problems so that I can investigate failures before they affect users.

**Acceptance criteria:**
1. KPI cards show: Active Services, Total Event Volume (30d), Weighted Success Rate, Top Service by events, Total Report Exports
2. Service catalog groups services by category (Core, Transactions, Reports, etc.)
3. Each service card shows event count and a success rate colour badge (green ≥90%, amber ≥80%, red <80%)
4. Clicking a service opens ServiceDrawer: KPIs, top event types, top users, success rate trend, report metrics
5. Traffic heatmap shows hourly event density; clicking a row selects that service's drawer
6. Events feed shows the 50 most recent global events sorted by timestamp
7. Sort toggle (Events / Success % / Users) re-orders the service list
8. Service name multi-select filter scopes the view to selected services
9. Custom date window (1d / 7d / 30d) changes the aggregation period
10. Pinned metrics appear above KPIs

**Priority:** P0  
**Dependencies:** F1, dx_service_usage, dx_event_heatmap, dx_user_events, dx_service_drill, dx_services_windows

---

### F4: Platform Health Section

**Description:** System-wide reliability metrics, login funnel, session quality analysis, failure breakdown, and per-service failure drill-down.

**User story:** As the IAM admin, I want to understand session quality and authentication reliability so that I can spot patterns in login failures or session abandonment.

**Acceptance criteria:**
1. Four KPI cards: Overall Success %, Failed Events, Avg Session Duration, Cross-Module Rate
2. Success rate trend line chart covers the last 30 days with daily granularity
3. Login funnel shows four steps (Attempt / Auth Pass / Session Start / Action Taken) with conversion percentages between steps
4. Session duration distribution is a histogram with configurable buckets
5. Performance by role table shows avg duration and event count per role
6. Service failure heat list is sorted by failure % and clicking a row opens FailureDrawer
7. FailureDrawer shows recent failed events: user email, event type, timestamp, status comment
8. Custom date range selection triggers real-time client-side recalculation of all KPIs and charts
9. Critical failing events bar chart shows the top 10 event types by failure count
10. Pinned metrics appear above KPIs

**Priority:** P0  
**Dependencies:** F1, dx_health_overview, dx_session_stats, dx_overview, dx_user_events, dx_health_windows

---

### F5: Metrics Builder

**Description:** Left-panel formula builder with preview/save; right-panel saved metrics grid with pin-to-section capability.

**User story:** As the IAM admin, I want to define and save custom business metrics so that I can surface context-specific KPIs on any dashboard section without repeating the computation.

**Acceptance criteria:**
1. Formula textarea accepts both plain-English queries and mathematical expressions
2. 13 template buttons pre-fill the formula and name fields
3. "Preview" button calls `/api/metrics/compute` and shows the result with a source badge (⚡ instant / ✦ Gemini / ⚡ qwen2.5 / error)
4. "Save Metric" requires a non-empty name field; shows inline error if blank
5. Saved metrics persist across page navigations and browser restarts (localStorage)
6. Each saved metric card shows: name, formula text, result value, delete (×) button, and pin toggles for People / Services / Health
7. Pinning a metric to a section causes it to appear in that section's PinnedMetrics component
8. Unpinning removes it from that section without deleting the metric
9. Deleting a metric removes it from all sections and from localStorage
10. Result badge displays the source of computation: instant (builtin), Gemini, qwen2.5, or error
11. Empty state is shown when no metrics are saved

**Priority:** P1  
**Dependencies:** F1, /api/metrics/compute, metricsStore, F2/F3/F4 (for pin display)

---

### F6: AI Chat

**Description:** Full-page conversational interface grounded in real platform data, with navigation intents, out-of-scope guard, deterministic data answers, and AI-powered benchmark comparisons.

**User story:** As the IAM admin, I want to ask natural language questions about my data and get structured answers with source transparency so that I can investigate quickly without writing queries.

**Acceptance criteria:**
1. Sending a message produces a response in ≤ 30 seconds
2. Navigation intents ("take me to Health") trigger automatic page navigation after 700ms
3. Out-of-scope questions (recipes, weather, crypto, etc.) return a scope-guard message without calling any AI
4. Role-specific queries ("show me all Backend Engineer users") return a pre-formatted list without calling any AI (source: builtin)
5. Top-N user queries, low-health queries, login rate, dormant count are all answered deterministically (source: builtin)
6. Benchmark questions ("is our 99% success rate good?") are routed to Gemini; response includes industry range, GrayQuest actual, assessment, and recommendation
7. When Gemini is unavailable, benchmark questions fall back gracefully with available GrayQuest data and a note about Gemini unavailability
8. Data questions ("who has the highest session count?") are answered by qwen2.5:0.5b (local) or Gemini (fallback)
9. Responses containing a numeric result show a "Save to Metrics Builder" button
10. Source badges display on every AI response: ✦ Gemini (purple) or ⚡ qwen2.5 (green)
11. "Clear chat" resets to the welcome message only
12. Up to 12 exchanges are retained as context for follow-up questions
13. Suggested questions sidebar (11 questions) is clickable
14. Floating chat widget appears on all dashboard pages except /dashboard/chat itself and /login

**Priority:** P1  
**Dependencies:** F1, /api/chat, GEMINI_API_KEY, OLLAMA_MODEL/OLLAMA_URL (optional), dx_users, dx_service_usage, dx_overview

---

### F7: Alert System

**Description:** On-demand threshold evaluation returning alerts for people, health, and service metrics, displayed in a dismissible panel from the TopBar.

**User story:** As the IAM admin, I want proactive alerts when platform metrics breach thresholds so that I can investigate without having to check every section manually.

**Acceptance criteria:**
1. Bell icon in TopBar shows a count badge when alerts exist
2. Clicking the bell opens AlertsPanel
3. Alerts are fetched from `/api/alerts` on panel open
4. Ten threshold rules are evaluated (see Section 7 for full list)
5. Each alert shows: message, section colour label (People/Services/Health), and timestamp
6. Dismissing an alert removes it from the visible list for the current session
7. "Dismiss all" clears all visible alerts
8. Empty state "All clear" is shown when no active alerts
9. **Known limitation (C1):** Health-score-based alerts (a2, a4) are currently non-functional due to threshold scale mismatch. Resolution tracked in backlog.

**Priority:** P1  
**Dependencies:** F1 (UI only — API is unprotected per C3), /api/alerts, dx_overview, dx_health_overview, dx_service_usage, dx_users

---

### F8: Filter Bar

**Description:** Persistent horizontal filter bar with date presets, role multi-select, and service multi-select that applies client-side to the current section.

**User story:** As the IAM admin, I want to slice data by date range and role without navigating away so that I can investigate a specific cohort in context.

**Acceptance criteria:**
1. Date presets: Today / 7d / 30d are one-click
2. Custom date range shows two date inputs validated (from ≤ to) before applying
3. Role dropdown only visible on People section; Service dropdown only on Services section
4. Active filter count badge shows on "Clear filters" button when filters are non-default
5. "Clear filters" resets to 30d preset with no role/service selections
6. Filter state persists across tab navigation within the same session (Zustand store)

**Priority:** P1  
**Dependencies:** filterStore, F2, F3, F4

---

### F9: Dark / Light Mode

**Description:** Theme toggle in TopBar switching between light (default) and dark mode. Persists to localStorage.

**Acceptance criteria:**
1. Toggle switches theme immediately without page reload
2. Theme persists across browser sessions via localStorage
3. Pre-hydration script (`/public/theme.js`) prevents flash of wrong theme on load
4. All chart colours switch to dark-mode palette via `useChartColors` hook
5. All glass cards, backgrounds, and text colours follow the Tailwind CSS 4 `dark:` variant

**Priority:** P2  
**Dependencies:** filterStore.isDark, useChartColors, tailwind.config.ts

---

### F10: Data Refresh Webhook

**Description:** Authenticated POST endpoint that triggers full recomputation of all 13 dashboard datasets from Supabase raw tables.

**User story:** As the data pipeline operator, I want an authenticated webhook I can call after a CSV import so that the dashboard reflects the latest IAM activity data.

**Acceptance criteria:**
1. `POST /api/recompute` with valid Bearer token returns `{ ok: true, ts: ISO-timestamp }`
2. Invalid or missing token returns 401
3. Missing `RECOMPUTE_SECRET` env var causes startup warning (not silent bypass) — **Resolution R7**
4. `GET /api/recompute` delegates to POST (supports simple curl testing)
5. Computation reads all 7 raw Supabase tables, filters by platform_id, and produces 13 dx_* datasets
6. Function timeout is 60 seconds (Vercel maxDuration configured)
7. On computation error, returns 500 with error message logged to console

**Priority:** P0  
**Dependencies:** RECOMPUTE_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

---

## 6. Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL DATA PIPELINE                           │
│  [CSV Files] → [Python Import Script] → [Supabase: raw_iam_* tables]   │
│                         ↓ POST /api/recompute (webhook)                 │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS APPLICATION (Vercel)                        │
│                                                                         │
│  ┌────────────────┐   ┌────────────────────────────────────────────┐   │
│  │  middleware.ts │   │            API Routes (/api/*)              │   │
│  │ (auth guard)   │   │                                            │   │
│  │ /dashboard/*   │   │  /auth/login  → bcrypt compare → JWT set  │   │
│  │ / (redirect)   │   │  /auth/logout → cookie delete             │   │
│  └────────────────┘   │  /alerts      → threshold eval → Alert[]  │   │
│                        │  /chat        → 5-tier AI chain            │   │
│  ┌────────────────┐   │  /metrics/compute → builtin+AI eval       │   │
│  │  Pages (SSR)   │   │  /metrics/{health|people|services}        │   │
│  │  /people       │   │  /recompute   → computeAllMetrics()       │   │
│  │  /services     │   │  /debug       → env info                  │   │
│  │  /health       │   └────────────────────────────────────────────┘   │
│  │  /metrics      │                    │                               │
│  │  /chat         │                    ▼                               │
│  └────────────────┘   ┌────────────────────────────────────────────┐   │
│         │              │            lib/data.ts                     │   │
│         ▼              │  loadSnapshot(id) →                        │   │
│  ┌────────────────┐   │    1. src/data/real/dx_{id}.json (primary) │   │
│  │ Client State   │   │    2. Supabase dx_snapshots (fallback)      │   │
│  │ filterStore    │   └────────────────────────────────────────────┘   │
│  │ metricsStore   │                    │                               │
│  │ (localStorage) │                    ▼                               │
│  └────────────────┘   ┌────────────────────────────────────────────┐   │
│                        │         lib/compute.ts                      │   │
│                        │  computeAllMetrics():                       │   │
│                        │  raw_iam_users + raw_iam_activities         │   │
│                        │  + raw_audit_logs (+ 4 other tables)        │   │
│                        │  → 13 dx_* datasets → dx_snapshots upsert  │   │
│                        └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
         │                          │                        │
         ▼                          ▼                        ▼
┌────────────────┐    ┌──────────────────────┐  ┌──────────────────────┐
│    Supabase    │    │  Google Gemini API   │  │   Ollama (local)     │
│ raw_iam_*      │    │  gemini-2.0-flash    │  │  qwen2.5:0.5b        │
│ raw_audit_logs │    │  benchmarks +        │  │  data Q&A            │
│ dx_snapshots   │    │  formula compute     │  │  dev only            │
│ (realtime)     │    └──────────────────────┘  └──────────────────────┘
└────────────────┘
```

**Key architectural decisions:**

1. **Snapshot-first, realtime-fallback data loading:** Every page loads from local JSON files (`src/data/real/`), falling back to Supabase only if the file doesn't exist. This gives sub-millisecond data reads in production (filesystem is co-located with the Next.js server) and eliminates Supabase latency from the critical render path.

   > **Reasoning:** The dashboard is read-heavy and data changes at most daily. Serving pre-built JSON from the same Node.js process is faster and cheaper than a database round-trip on every page request.

2. **Deterministic-first AI answer chain:** Chat routes attempt builtin pattern matching before invoking any AI. This gives instant, accurate answers for the most common queries without model latency or cost.

3. **Client-side filter state:** Filters are applied in-memory in the browser. No server-side filter pushdown exists. This was an intentional trade-off for simplicity given the small dataset size (281 users, 27 services).

   > **Resolution (C11):** Acceptable at current scale. At >5,000 users, server-side filtering will be required.

4. **Single-user JWT auth:** Single bcrypt credential in env vars. Simple but inflexible. No multi-user support, no role-based access, no audit log of who accessed what.

5. **localStorage for custom metrics:** Metrics Builder state is client-only. Acceptable for single-user internal tool. Cross-device sync requires server persistence (Phase 2).

---

## 7. Database Schema

### Supabase Raw Tables (Source of Truth)

#### raw_iam_users

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | text | NO | — | PK | User's internal IAM identifier |
| email | text | YES | NULL | — | User email address (PII) |
| parent_id | text | YES | NULL | FK → raw_iam_users.id | Parent/admin user if applicable |
| is_active | text | YES | NULL | '0' or '1' | Whether account is active |
| created_on | text | YES | NULL | ISO timestamp string | Account creation date |
| updated_on | text | YES | NULL | ISO timestamp string | Last account modification |
| deleted_on | text | YES | NULL | ISO timestamp string | Soft-delete timestamp; NULL if active |

> **Assumption:** Timestamps are stored as text strings, not native TIMESTAMP columns, based on the `parseTs()` null-safety wrapper in compute.ts.

#### raw_iam_activities

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | text | NO | — | PK | Activity record identifier |
| user_id | text | NO | — | FK → raw_iam_users.id | User who performed the activity |
| platform_id | text | NO | — | Indexed | Platform filter key (="6" for GrayQuest) |
| type | text | YES | NULL | — | Activity type: 'LOGIN', 'INVALID LOGIN', etc. |
| created_on | text | YES | NULL | ISO timestamp string | Activity timestamp |

#### raw_iam_user_groups

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | text | NO | — | PK | Membership record identifier |
| user_id | text | NO | — | FK → raw_iam_users.id | The user |
| group_id | text | NO | — | FK → raw_iam_groups.id | The group / role |
| created_on | text | YES | NULL | ISO timestamp string | When user was added to group |
| updated_on | text | YES | NULL | ISO timestamp string | Last modification |
| deleted_on | text | YES | NULL | ISO timestamp string | NULL if active; soft-delete |

#### raw_iam_groups

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | text | NO | — | PK | Group identifier |
| code | text | YES | NULL | — | Short code for the group |
| name | text | NO | — | — | Display name (e.g., "Group manager") |
| description | text | YES | NULL | — | Human-readable description |
| is_active | text | YES | NULL | '0' or '1' | Whether group is active |
| created_on | text | YES | NULL | ISO timestamp string | Group creation date |

#### raw_iam_services

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | text | NO | — | PK | Service identifier |
| code | text | YES | NULL | — | Short service code |
| slug | text | YES | NULL | — | URL slug |
| name | text | NO | — | — | Display name (e.g., "Student Fee Headers") |
| is_active | text | YES | NULL | '0' or '1' | Whether service is active |
| created_on | text | YES | NULL | ISO timestamp string | Service creation date |

#### raw_iam_events

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | text | NO | — | PK | Event type identifier |
| code | text | YES | NULL | — | Short event code |
| label | text | NO | — | — | Human-readable event name |
| slug | text | YES | NULL | — | URL slug |
| is_active | text | YES | NULL | '0' or '1' | Whether event type is active |

#### raw_audit_logs

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | text | NO | — | PK | Audit log entry identifier |
| code | text | YES | NULL | — | Log entry code |
| user_id | text | NO | — | FK → raw_iam_users.id | User who triggered the action |
| platform_id | text | NO | — | Indexed | Platform filter key |
| service_id | text | YES | NULL | FK → raw_iam_services.id | Service where action occurred |
| event_id | text | YES | NULL | FK → raw_iam_events.id | Type of event |
| type | text | YES | NULL | — | Action type: 'REPORT', 'REPORT-ALL-GILE', etc. |
| data | jsonb | YES | NULL | — | Arbitrary action payload |
| comment | text | YES | NULL | — | Human-readable status note |
| status | text | YES | NULL | — | 'SUCCESS', 'FAILED', 'PENDING' |
| created_on | text | YES | NULL | ISO timestamp string | Event timestamp (Indexed) |

---

### Supabase Derived Table

#### dx_snapshots

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | text | NO | — | PK | Snapshot identifier (e.g., 'overview', 'users') |
| data | jsonb | NO | — | — | Full computed dataset as JSON |
| updated_at | timestamptz | YES | now() | — | Last upsert timestamp |

**Valid id values:** overview, dau_series, users, role_distribution, service_usage, cohort_retention, session_stats, health_overview, event_heatmap, event_heatmap_drill, service_drill, services_windows, health_windows, user_events

---

### In-Memory / Computed Entities

#### Session (computed in-process, never persisted)

| Field | Type | Description |
|-------|------|-------------|
| session_id | number | Auto-increment within compute run |
| user_id | string | FK → raw_iam_users.id |
| start | Date | Timestamp of first activity in session |
| end | Date | Timestamp of last activity in session |
| hour | number | Hour of day (0–23) when session started |
| date | string | ISO date string of session start |
| week | string | ISO week string (YYYY-Www) |
| month | string | ISO month string (YYYY-MM) |
| login_type | string | Type from the opening activity record |
| duration_sec | number | end.getTime() - start.getTime() / 1000 |

**Session detection rule:** A new session begins when either a new user_id is encountered (after sorting by user_id + timestamp) or more than 3600 seconds have elapsed since the previous activity for the same user.

---

### Client-Only Entities (localStorage / Zustand)

#### CustomMetric (metricsStore, key: gq-custom-metrics)

| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID v4, generated at creation |
| name | string | User-provided display name |
| description | string | Optional description |
| formula | string | Raw formula or plain-English query |
| result | string | Computed result (always serialised to string — see R8) |
| pinnedTo | Section[] | Array of sections where metric is pinned |
| createdAt | string | ISO timestamp of creation |

#### FilterState (filterStore, Zustand in-memory)

| Field | Type | Description |
|-------|------|-------------|
| isDark | boolean | Current theme; synced to localStorage |
| sidebarOpen | boolean | Mobile sidebar visibility |
| dateRange | DateRange | { preset, from, to } |
| roles | string[] | Selected role filter values |
| services | string[] | Selected service filter values |
| statuses | StatusType[] | Selected status filters |
| hourRange | [number, number] | Hour-of-day filter range |
| search | string | Free-text search query |

---

### ER Relationship Summary

```
raw_iam_users (1) ──< (many) raw_iam_activities      [user logs in/acts]
raw_iam_users (1) ──< (many) raw_iam_user_groups     [user is in group]
raw_iam_groups (1) ──< (many) raw_iam_user_groups    [group has many members]
raw_iam_users (1) ──< (many) raw_audit_logs          [user performs actions]
raw_iam_services (1) ──< (many) raw_audit_logs       [actions on a service]
raw_iam_events (1) ──< (many) raw_audit_logs         [actions of an event type]
raw_audit_logs (many) ──> (1) raw_iam_services       [each log belongs to service]
raw_audit_logs (many) ──> (1) raw_iam_events         [each log is of an event type]
raw_iam_activities + raw_audit_logs → compute.ts → dx_snapshots (1 row per dataset id)
dx_snapshots (1 per id) → lib/data.ts → Page components
CustomMetric (many) → pinnedTo → Section (many-to-many via array)
```

---

## 8. API Contracts

| Method | Path | Auth | Request Body | Response Schema | Status Codes | Rate Limit | Scope |
|--------|------|------|-------------|-----------------|--------------|-----------|-------|
| POST | /api/auth/login | None | `{ email: string, password: string }` | `{ success: true }` + Set-Cookie header | 200, 400, 401, 500 | None | Public |
| POST | /api/auth/logout | Cookie (soft) | None | `{ success: true }` | 200 | None | Public |
| GET | /api/alerts | **None (C3)** | — | `{ alerts: Alert[] }` | 200 | None | Internal |
| POST | /api/chat | **None (C3)** | `{ messages: {role,content}[], currentSection?: string }` | `{ content: string, source: 'builtin'\|'gemini'\|'ollama'\|'navigation'\|'scope_guard'\|'error', metricSuggestion?: MetricSuggestion, navigationTarget?: string }` | 200, 400 | 30s timeout | Internal |
| POST | /api/metrics/compute | **None (C3)** | `{ name: string, description: string, formula: string }` | `{ result: string, source: 'builtin'\|'gemini'\|'ollama'\|'error' }` | 200, 400 | 30s timeout | Internal |
| GET | /api/metrics/health | **None (C3)** | — | `{ health: HealthOverview, sessions: SessionStats, overview: Overview, events: Events, healthWindows: object }` | 200 | None | Internal |
| GET | /api/metrics/people | **None (C3)** | — | `{ overview, dau, users, roles, cohort, sessions, events }` | 200 | None | Internal |
| GET | /api/metrics/services | **None (C3)** | — | `{ services, heatmap, events, drill, heatmapDrill, servicesWindows }` | 200 | None | Internal |
| POST | /api/recompute | Bearer RECOMPUTE_SECRET | None | `{ ok: true, ts: string }` | 200, 401, 500 | 60s timeout | Admin |
| GET | /api/recompute | Bearer RECOMPUTE_SECRET | — | Same as POST | 200, 401, 500 | 60s timeout | Admin |
| GET | /api/debug | **None** | — | `{ PLATFORM_ID: string, NODE_ENV: string }` | 200 | None | Internal |

**MetricSuggestion schema:**
```typescript
{ name: string, value: string, formula: string, description: string }
```

**Alert schema:**
```typescript
{ id: string, message: string, metric: string, section: Section, timestamp: string, dismissed: boolean }
```

> **Assumption:** No explicit rate limiting is configured. Vercel function timeout (30s/60s) is the only execution limit.

> **Security note (C3):** All /api/* routes except /api/auth/* and /api/recompute are unauthenticated. They serve platform user emails, health scores, service data. While the Vercel deployment is not publicly indexed, this represents a security gap. Recommendation: add cookie auth check to all data-serving routes.

---

## 9. Component & Module Inventory

### Backend Modules

| Module | File | Does | Consumes | Emits | Breaks if removed |
|--------|------|------|----------|-------|-------------------|
| Auth | lib/auth.ts | JWT sign/verify, cookie parsing | jose, JWT_SECRET | JWT string or payload | All auth collapses |
| Data Loader | lib/data.ts | Snapshot loading with fallback chain | fs, Supabase, dx_*.json | Typed dataset objects | All pages return empty data |
| Compute Engine | lib/compute.ts | Full ETL: raw tables → 13 datasets | Supabase raw tables | dx_snapshots rows | /api/recompute broken |
| Config | lib/config.ts | Centralised constants and thresholds | process.env | Exported constants | Magic numbers scattered; thresholds drift |
| Constants | lib/constants.ts | Routes, filter options, date helpers, role/service lists | config.ts | ROUTES, ROLE_OPTIONS, SERVICE_NAMES, DATE_PRESETS | Dropdowns, navigation, AI keyword matching all break |
| Supabase Client | lib/supabase.ts | Supabase JS client init | env vars | sbClient | Realtime and fallback load break |
| Chat Suggestions | lib/chatSuggestions.ts | Context-aware suggested questions by section | — | string[] | Sidebar suggestions show nothing |

### Frontend Components

| Component | File | Does | Consumes | Emits | Breaks if removed |
|-----------|------|------|----------|-------|-------------------|
| Sidebar | layout/Sidebar.tsx | Navigation, user profile, logout | NAV_TABS, filterStore, usePathname | Logout fetch | Navigation impossible |
| TopBar | layout/TopBar.tsx | Page title, theme toggle, alerts bell | filterStore, AlertsPanel | — | No alerts access, no theme toggle |
| FilterBar | layout/FilterBar.tsx | Date/role/service filters | filterStore, DATE_PRESETS | filterStore mutations | Filters broken |
| FloatingChatBar | layout/FloatingChatBar.tsx | Mini chat widget on all pages | /api/chat, metricsStore | — | No chat outside /dashboard/chat |
| KPICard | ui/KPICard.tsx | Metric tile with trend badge | KPICardProps | — | All KPI tiles gone |
| AlertsPanel | ui/AlertsPanel.tsx | Alert list with dismiss | /api/alerts | onCountChange | No alerts display |
| PinnedMetrics | ui/PinnedMetrics.tsx | Pinned metric tiles above KPIs | metricsStore | — | Pinned metrics invisible |
| MultiSelectDropdown | ui/MultiSelectDropdown.tsx | Checkbox dropdown for role/service | options array | onChange | Filter dropdowns broken |
| SectionPlaceholder | ui/SectionPlaceholder.tsx | Empty state message | message prop | — | Blank space instead of message |
| DrillDownDrawer | layout/DrillDownDrawer.tsx | Generic side drawer shell | children, onClose | — | UserDrawer, ServiceDrawer, FailureDrawer broken |
| UserTable | people/UserTable.tsx | Paginated user rows | IamUser[], filterStore | onUserSelect | User list gone |
| UserDrawer | people/UserDrawer.tsx | User detail: profile, activity, services | IamUser | — | No user drill-down |
| ServiceCard | services/ServiceCard.tsx | Service tile in catalog grid | Service | onClick | Services catalog broken |
| ServiceDrawer | services/ServiceDrawer.tsx | Service detail: events, users, reports | Service, drill data | — | No service drill-down |
| FailureDrawer | health/FailureDrawer.tsx | Failed event detail list | healthWindows, service | — | No failure investigation |
| LineChart | charts/LineChart.tsx | Area chart with gradient fill | data, lines config | — | All trend charts blank |
| BarChart | charts/BarChart.tsx | Vertical/horizontal bar chart | data, config | — | All bar charts blank |
| DonutChart | charts/DonutChart.tsx | Pie/donut chart | data | — | Role distribution chart blank |
| HeatmapChart | charts/HeatmapChart.tsx | Matrix heatmap | matrix data | onRowClick | Traffic heatmap, cohort retention blank |
| FunnelChart | charts/FunnelChart.tsx | Step-by-step funnel | steps data | — | Login funnel chart blank |

### Stores

| Store | File | Persists | Cleared by | Breaks if removed |
|-------|------|----------|-----------|-------------------|
| filterStore | store/filterStore.ts | isDark (localStorage) | clearAll() | All filters, theme, sidebar state gone |
| metricsStore | store/metricsStore.ts | Full store (localStorage, key: gq-custom-metrics) | removeMetric() / page | All saved metrics gone |

### Hooks

| Hook | File | Does | Breaks if removed |
|------|------|------|-------------------|
| useChartColors | hooks/useChartColors.ts | Dark/light palette for Recharts | All charts use wrong colours |
| useRealtimeSnapshot | hooks/useRealtimeSnapshot.ts | Supabase realtime listener | Currently unused in pages; no impact |

---

## 10. Roles & Permissions Matrix

> **Note:** This dashboard has a single authenticated user (the IAM Admin). There is no multi-user RBAC system. The matrix below describes what the single user can and cannot do per module. The "role" column reflects GrayQuest IAM roles visible in the data (not dashboard access roles).

### Dashboard Access Matrix

| Section | View | Filter | Drill-Down | Export | Write |
|---------|------|--------|-----------|--------|-------|
| People | ✅ | ✅ (date, role, search) | ✅ (UserDrawer) | ❌ | ❌ |
| Services | ✅ | ✅ (date, service) | ✅ (ServiceDrawer) | ❌ | ❌ |
| Health | ✅ | ✅ (date, custom range) | ✅ (FailureDrawer) | ❌ | ❌ |
| Metrics Builder | ✅ | N/A | N/A | ❌ | ✅ (create/save/delete/pin) |
| Chat | ✅ | N/A | N/A | ❌ | ✅ (save metric from response) |
| Alerts | ✅ | N/A | N/A | ❌ | ✅ (dismiss, client-only) |

### GrayQuest IAM Roles Visible in Data (not dashboard access roles)

| IAM Role | Users (approx.) | Description |
|----------|----------------|-------------|
| Block Master Dashboard | Majority | Primary bulk role for dashboard-access users |
| Group manager | Mid-tier | Group-level managers |
| Group Admissions Manager | ~handful | Manages admissions at group level |
| Institute Admin | 3 | Per-institution administrators |
| Super Admin | 1 | Platform-wide administrator |
| Backend Engineer | 1 | Engineering access |
| FMS Dashboard Limited | Small | Financial management system limited access |
| Block master-view only | Small | Read-only block master access |
| Institute Dashboard main replacement | Small | Replacement for older institute dashboard |
| Product | Small | Product team access |
| System Associates | Small | System-level associated accounts |

---

## 11. Edge Cases & Failure Modes

| Trigger | Scenario | Expected Behaviour | Fallback |
|---------|----------|--------------------|----------|
| Empty dx_users.json | No user data available | User table shows empty state; KPI cards show 0 | `loadSnapshot` returns `{ users: [] }` default |
| Zero active services | All services below threshold | Services page shows 0 in KPI card; catalog is empty with `no_services` message | Empty array default |
| Massive user volume (>50,000 users) | Full user list load into memory | Client-side filtering becomes slow; 10-row pagination helps but initial load is unbounded | Future: server-side pagination API |
| Supabase connection timeout | Network unreachable during snapshot load | Falls through to local JSON files; if JSON also missing, returns empty default object | Filesystem fallback is primary read path |
| Gemini quota exhaustion | `limit: 0` error from Google API | Returns 429 or quota error; `callGemini` returns null; fallback to Ollama (data) or structured message (benchmark) | Chat shows "⚡ qwen2.5" or Gemini-unavailable note |
| Ollama not running | Connection refused to localhost:11434 | `callOllama` returns null; falls back to Gemini; if Gemini also unavailable, returns error message with setup instructions | Error message with actionable steps |
| Both AI services down | Gemini quota + Ollama offline | Builtin deterministic answers still work for all matched patterns; AI-only questions return error with setup guidance | Builtin engine is unaffected |
| JWT expired mid-session | 8-hour token expires while user is on page | Next navigation triggers middleware; stale cookie detected, deleted, redirect to /login | Token expiry check in middleware |
| Invalid JWT_SECRET in env | Missing or wrong secret | `verifyToken` throws; middleware redirects to login for all /dashboard/ requests | Fails safely (locked out, not open) |
| RECOMPUTE_SECRET not set | Empty env var | Current: check skipped, anyone can trigger recompute. R7 fix: return 401 if secret env var missing | Must be fixed per R7 |
| Partial compute failure | computeAllMetrics() throws mid-run | Returns 500 with error message; Supabase may have partial updates; old JSON files still served | Old snapshot data continues to be served |
| Concurrent recompute calls | Two webhooks fire simultaneously | No mutex; both run full ETL concurrently; Supabase upserts are idempotent by id | Race condition risk on dx_snapshots write; low severity |
| localStorage full (custom metrics) | Browser storage quota exceeded | Zustand persist silently fails on write; new metrics don't save; existing metrics unaffected | User sees no error — silent failure |
| Alert dismissal lost on refresh | User dismisses alert, refreshes page | Alert reappears (C9: in-memory only). Expected behaviour per current design. | Intentional limitation; cosmetic only |
| User with no role assignment | `userRoleMap.get(uid)` returns undefined | Defaults to `['Unknown']` in compute.ts; displayed as role "Unknown" in table | Graceful fallback |
| NaN health score | Invalid compute input (division by zero) | `minmax` function handles: if max === min, returns 0.5 for all; `Math.round` produces valid number | Returns 50.0 score |
| Custom date range: from > to | Invalid filter input | FilterBar validates before applying; shows no change | Client-side validation |
| Chat input >8000 tokens | Very long conversation history | Only last 12 exchanges sent to AI; older messages truncated from context | Context window management |
| Service name with special characters | Regex matching in AI routes | SERVICE_NAMES sorted longest-first; exact match used; special chars don't affect exact matching | Correct matching |
| Schema migration mid-release | New dx_snapshot field added while old JSON files served | Old JSON continues to be served with missing field; TypeScript optional chaining prevents crashes | Graceful degradation |
| NEXT_PUBLIC_* var not set | Missing PLATFORM_ID, COMPANY_NAME | Config falls back: PLATFORM_ID defaults to '6', COMPANY_NAME to 'GrayQuest' | Hardcoded defaults |

---

## 12. Security & Compliance

### Authentication Mechanism

- **Protocol:** JWT (HS256) in httpOnly cookie (`gq-dashboard-token`)
- **Token contents:** `{ email: string, iat: number, exp: number }`
- **Expiry:** 8 hours (`AUTH_TOKEN_EXPIRY = '8h'`)
- **Cookie flags:** `httpOnly: true`, `secure: true` (production), `sameSite: 'lax'`
- **Verification library:** `jose` v6 (WebCrypto-based, FIPS-friendly)

### Token Lifecycle

1. User POSTs credentials → server verifies email + bcrypt hash → `signToken(email)` → JWT issued
2. Cookie set; browser stores httpOnly (inaccessible to JavaScript)
3. Every request to `/dashboard/*` → middleware calls `verifyToken()` → valid: allow; invalid/expired: delete cookie + redirect to /login
4. User clicks logout → `DELETE /api/auth/logout` → cookie cleared server-side → redirect
5. No refresh token mechanism. Expired session requires re-login.

### RBAC Enforcement

**None.** Single-user system. The only gate is: authenticated or not.

### Audit Logging

**None in the dashboard.** The underlying IAM system writes `raw_audit_logs`, but the dashboard does not log its own access events (who viewed which section, when). This is a gap for SOC2 compliance.

### PII Fields and Handling

| Field | Location | Classification | Exposure |
|-------|----------|---------------|----------|
| email | raw_iam_users, dx_users.json | PII | Displayed in UserTable, UserDrawer, chat responses |
| name (derived from email) | dx_users.json | Semi-PII | Displayed in all user tables and chart labels |
| DASHBOARD_USER_EMAIL | .env.local | PII | Never returned to client; server-only |
| DASHBOARD_USER_PASSWORD_HASH | .env.local | Sensitive | Never returned; bcrypt hash only |
| user activity patterns | dx_users.json (sessions, events) | Behavioural | Displayed in dashboard; not transmitted to third parties |

**PII in AI requests:** When building AI prompts, user email-derived names and role/session data are included in Gemini API calls. This means behavioural data about named individuals is sent to Google's generative AI service. Under GDPR, this could constitute personal data processing by a third party and requires a DPA with Google.

### Data Retention

No explicit retention policy enforced by this application. Raw Supabase tables accumulate indefinitely. The 30-day window is a display window only — older data remains in `raw_audit_logs`.

> **Assumption:** Data retention policy is governed externally (Supabase project settings and GrayQuest's own data policies). This application does not delete data.

### Relevant Compliance Considerations

| Standard | Applicability | Gap |
|----------|--------------|-----|
| GDPR | Potentially applicable if any EU users appear in raw_iam_users | PII in Gemini prompts; no consent mechanism; no right-to-erasure in dashboard |
| SOC2 Type II | Aspirational for GrayQuest | No dashboard access audit log; no MFA; no session activity logging |
| India DPDP Act 2023 | Applicable (Indian company, Indian users) | No data fiduciary disclosure; no user consent tracking |
| OWASP Top 10 | Engineering reference | See attack vector analysis below |

### Attack Vector Analysis

| Vector | Risk | Mitigation |
|--------|------|-----------|
| **IDOR (Broken Object Level Auth)** | Medium — API routes expose all platform data to any caller (C3) | Add cookie auth to all /api/* data routes |
| **XSS** | Low — No `dangerouslySetInnerHTML`; React escapes all interpolated values; chat messages rendered via split/map | Monitor for future changes adding raw HTML insertion |
| **CSRF** | Low — Cookie is SameSite=Lax; state-changing actions require POST; no GET-based mutations | No additional CSRF token needed at current trust level |
| **JWT secret exposure** | High if env var leaks | JWT_SECRET must be in Vercel environment variables only; never in committed code |
| **SSRF via Gemini/Ollama URLs** | Low — Gemini URL is hardcoded (`generativelanguage.googleapis.com`); Ollama URL from env var | Validate OLLAMA_URL on startup; reject non-localhost values in production |
| **Secret injection via formula** | Low — Metric formula is passed to AI as text prompt, not eval()'d | Prompts include data context only; no code execution |
| **Timing attack on login** | Low — bcrypt is intentionally slow | Both email and password checked before returning; no early exit on email mismatch |
| **Recompute DoS** | Medium — Anyone can POST /api/recompute if RECOMPUTE_SECRET not set (C7) | Fix per R7: require secret |
| **Snapshot data tampering** | Low — JSON files are read-only at runtime; only recompute webhook writes | Recompute is authenticated; no direct file write endpoint |

---

## 13. Performance & SLA Targets

### Latency Targets per Endpoint

| Endpoint | p50 | p95 | p99 | Notes |
|----------|-----|-----|-----|-------|
| GET /dashboard/people | 200ms | 600ms | 1200ms | SSR + JSON file read; no DB call on hot path |
| GET /dashboard/services | 200ms | 600ms | 1200ms | Same pattern |
| GET /dashboard/health | 200ms | 600ms | 1200ms | Same pattern |
| GET /dashboard/metrics | 50ms | 150ms | 300ms | Client-only render, no SSR data fetch |
| GET /dashboard/chat | 50ms | 150ms | 300ms | Client-only render |
| POST /api/auth/login | 200ms | 500ms | 1000ms | bcrypt compare is intentionally slow (~100ms) |
| GET /api/alerts | 300ms | 800ms | 1500ms | Reads 3 snapshots; evaluates 10 rules |
| POST /api/chat (builtin) | 50ms | 200ms | 500ms | Deterministic pattern matching; no AI |
| POST /api/chat (Gemini) | 2s | 6s | 15s | Cloud AI; network-dependent |
| POST /api/chat (Ollama) | 1s | 5s | 15s | Local inference; model-size-dependent |
| POST /api/metrics/compute (builtin) | 50ms | 200ms | 400ms | Pattern matching + 4 snapshot reads |
| POST /api/metrics/compute (AI) | 3s | 15s | 28s | Near Vercel's 30s limit for Ollama |
| POST /api/recompute | 15s | 40s | 58s | Full ETL; within 60s Vercel limit |

### Dashboard First-Load Target

- Cold start (no cache): < 2 seconds to LCP
- Warm (Vercel function warm): < 800ms to LCP
- Largest contentful element: KPI cards row

### Concurrent User Capacity

Single-user application by design. No concurrency requirements beyond one active session. Vercel's Fluid Compute handles multiple parallel API requests (e.g., chat + alerts loading simultaneously) without issue.

### Data Freshness SLA

| Data type | Maximum age | Trigger |
|-----------|------------|---------|
| Snapshot datasets (dx_*) | 24 hours | External CSV import + POST /api/recompute |
| Alert thresholds evaluation | On-demand (every AlertsPanel open) | GET /api/alerts |
| Custom metrics results | At compute time | User action in Metrics Builder |
| Chat answers | At query time | Every chat message |

### Graceful Degradation Under Load

| Component | Degrades gracefully | Hard-fails |
|-----------|--------------------|-|
| JSON file read | ✅ Falls back to Supabase | Only if both JSON and Supabase fail |
| Gemini API | ✅ Falls back to Ollama or builtin | — |
| Ollama | ✅ Falls back to Gemini or error message | — |
| Supabase connection | ✅ Falls back to JSON files | If JSON files also missing |
| Custom metrics (localStorage) | ✅ Defaults to empty array | — |
| Filter store (Zustand) | ✅ Defaults to 30d, no filters | — |

---

## 14. Infrastructure & Deployment Architecture

### Deployment Topology

```
Developer machine (local dev)
├── next dev --webpack (port 3000)
├── Ollama (port 11434) — qwen2.5:0.5b
└── .env.local — all secrets

Vercel (production)
├── Next.js App Router (Node.js runtime, Fluid Compute)
│   ├── SSR pages: /dashboard/*
│   ├── API routes: /api/*
│   └── Static: /public/* (theme.js, etc.)
├── Environment variables: Vercel dashboard
├── Function timeouts:
│   ├── /api/chat: 30s
│   ├── /api/metrics/compute: 30s
│   └── /api/recompute: 60s
└── Region: iad1 (assumed US East; not specified in vercel.json)

Supabase (managed PostgreSQL + Realtime)
├── raw_iam_users
├── raw_iam_activities
├── raw_iam_user_groups
├── raw_iam_groups
├── raw_iam_services
├── raw_iam_events
├── raw_audit_logs
└── dx_snapshots

Google Cloud (Gemini API)
└── generativelanguage.googleapis.com — gemini-2.0-flash

External CSV import pipeline (not in this repo)
└── Writes to Supabase raw_* tables → triggers POST /api/recompute
```

### CI/CD Pipeline

> **Assumption:** No CI configuration file (`.github/workflows/`, `vercel.json` pipelines) was found in the repository. The following describes the implied workflow based on Vercel's default behaviour.

| Stage | Trigger | Action |
|-------|---------|--------|
| Preview deploy | Push to non-main branch | Vercel builds and deploys preview URL; TypeScript checked by `next build` |
| Production deploy | Push/merge to main | Vercel deploys to production domain |
| Type check | Build time | `tsc --noEmit` runs as part of `next build` |
| Lint | Manual (`npm run lint`) | ESLint with next config |
| Tests | None currently | No test suite exists |

### Scaling Strategy

**Current:** Single Vercel function instance per request. Fluid Compute allows instance reuse across concurrent requests, reducing cold starts.

**Limits:**
- 30s / 60s function timeouts are the hard ceiling for long AI operations
- Memory: Node.js default (Vercel Fluid Compute)
- Concurrency: Effectively unlimited for read paths (JSON file reads)
- Write concurrency: `/api/recompute` has no mutex; concurrent invocations can conflict on Supabase upsert

### Disaster Recovery

| Scenario | RTO | RPO | Recovery action |
|----------|-----|-----|-----------------|
| Vercel deployment failure | < 5 min (instant rollback) | 0 (no data loss) | Vercel dashboard → rollback to previous deployment |
| Supabase outage | Until Supabase restores | 0 (JSON files are local snapshot) | Dashboard continues serving stale JSON files |
| JSON files corrupted | Minutes (redeploy) | Up to 24h (last successful recompute) | POST /api/recompute to regenerate |
| Gemini API outage | 0 (immediate fallback) | N/A | Builtin + Ollama continue working |
| Ollama crash on dev | 0 (immediate fallback) | N/A | Gemini fallback activates |
| JWT_SECRET rotated | All active sessions invalidated | 0 | Users re-login; no data loss |

---

## 15. Testing Strategy

> **Current state:** Zero automated tests exist in this repository. This section defines the target testing strategy.

### Unit Tests (Target: 70% coverage of lib/)

| Module | What to test | Framework |
|--------|-------------|-----------|
| lib/auth.ts | signToken produces valid JWT; verifyToken rejects expired/tampered tokens; getTokenFromCookieHeader edge cases | Vitest |
| lib/compute.ts | Session detection algorithm (gap at exactly 3600s, new user resets, single-activity sessions); health score normalisation (all-same-value edge case); pct() with zero denominator | Vitest |
| lib/config.ts | HEALTH thresholds are consistent with compute output scale (regression test for C1) | Vitest |
| api/alerts/route.ts | Correct alerts generated for each threshold; no false positives on good data | Vitest + mock data |
| api/metrics/compute/route.ts | Each builtin evaluateBuiltin() pattern returns correct string; role/service extraction from formula | Vitest |
| api/chat/route.ts | Navigation detection: correct routes for all patterns; no false positives on data queries; classifyQuestion(); buildStructuredAnswer() output format | Vitest |

### Integration Tests (Target: all API routes)

| Route | Test case | Framework |
|-------|-----------|-----------|
| POST /api/auth/login | Correct credentials → 200 + cookie; wrong password → 401; wrong email → 401; missing fields → 400 | Supertest / Playwright API |
| GET /api/alerts | Responds 200 with Alert[] shape; at-risk alerts fire correctly when threshold is met | Supertest |
| POST /api/chat | Navigation intent → navigationTarget set; out-of-scope → scope_guard; role query → builtin source | Supertest |
| POST /api/recompute | Valid secret → 200; no secret → 401; missing Supabase creds → 500 | Supertest |

### End-to-End Tests (Target: happy paths for all 5 sections)

| Journey | Steps | Framework |
|---------|-------|-----------|
| Login → People | Load /login, submit correct credentials, assert redirect to /dashboard/people, assert KPI cards visible | Playwright |
| People → User Drawer | Click first user in table, assert drawer opens with health score and activity timeline | Playwright |
| Chat → Save Metric | Submit "top 5 users by sessions", assert response with list, click "Save to Metrics Builder", assert metric appears in store | Playwright |
| Metrics Builder → Pin | Enter formula, preview, save, pin to People, navigate to People, assert pinned metric visible | Playwright |
| Alert Dismiss | Open alerts panel, dismiss one alert, assert it's removed from list | Playwright |

### Contract Tests

The `/api/metrics/compute` response shape must remain stable as the builtin pattern list grows. Add schema validation test against the `{ result: string, source: string }` contract.

### Load Tests (Future)

At current scale (single user), load testing is not required. When onboarded to multi-user: target 50 concurrent users, measure p95 of all SSR pages.

### CI Gate Thresholds

| Check | Pass criteria |
|-------|--------------|
| TypeScript | Zero errors (`tsc --noEmit`) |
| ESLint | Zero errors |
| Unit tests | All pass; coverage ≥ 70% on lib/ |
| E2E (smoke) | Login + People load pass |

---

## 16. Impact on Other Teams

### Data Pipeline Team (CSV Import)

**Data they get:** A clear webhook contract (`POST /api/recompute` with Bearer token) and the full schema of 7 raw tables their pipeline must populate.  
**Decisions enabled:** Can verify data landed correctly by calling `/api/metrics/people` and comparing user counts.  
**Workflow replaced:** Previously checked Supabase directly to verify import success.  
**If dashboard goes offline:** Pipeline can still write to Supabase; no impact on import itself. But pipeline operators lose the verification UI.

### Product / Business Stakeholders

**Data they get:** Reported metrics from the IAM admin (who queries this dashboard) — DAU/MAU ratios, health scores, service reliability.  
**Decisions enabled:** Feature prioritisation based on adoption data ("Block Master Dashboard users have 3.6 avg events/session — they need more engaging features").  
**Workflow replaced:** Ad-hoc queries by engineers, monthly manual reports.  
**If dashboard goes offline:** Return to manual query workflow; no automated metric delivery.

### Customer Success / Support

**Data they get:** User health scores and dormant user lists surfaced by the IAM admin.  
**Decisions enabled:** Proactive outreach to dormant users (78 dormant of 281 total = 28% dormancy rate).  
**Workflow replaced:** Reactive "which users are inactive?" queries.  
**If dashboard goes offline:** No self-service access; must request data from engineering.

### Security Team

**Data they get:** Login success rates, failed event counts, unusual session patterns.  
**Decisions enabled:** Whether login failure rate warrants investigation (currently 99.1% success — strong signal).  
**Workflow replaced:** None currently; this is net-new capability.  
**If dashboard goes offline:** Lose the first visibility layer into auth anomalies.

---

## 17. Future Scope & Roadmap

### MVP (Current — Phase 1)
All five sections operational with real data. Single-user auth. AI chat with deterministic + AI fallback. Metrics Builder with localStorage persistence. Alert system. Dark/light mode.

**Phase 1 Bug Backlog (blocking quality):**
- Fix health threshold scale (C1): ACTIVE=60, AT_RISK=40
- Fix login_success_rate field name (C6)
- Add RECOMPUTE_SECRET mandatory check (C7)
- Fix login page platform_id display (C8)

---

### Phase 2 — Persistence, Polish, and Auth Hardening (3–6 months)

| Feature | Description | Technical prerequisite | Complexity | Business value |
|---------|-------------|----------------------|-----------|----------------|
| Server-side metrics persistence | Custom metrics saved to Supabase, synced across devices | User table in Supabase, auth scope per user | Medium | High (multi-device access, no data loss on browser clear) |
| API route authentication | Add cookie verification to /api/alerts, /api/chat, /api/metrics/* | Shared token-verify middleware function | Low | High (closes C3 security gap) |
| Persistent alert dismissal | Save dismissed alert IDs to Supabase or localStorage | localStorage key for dismissed IDs | Low | Medium |
| Automated date reference update | Derive getRefDate() from max date in dx_dau_series.json | Read JSON in constants module | Low | Medium (eliminates manual maintenance step) |
| Dynamic health thresholds | Allow threshold configuration via admin UI or env vars | Config endpoint + UI component | Medium | Medium |
| CSV export of user table | Export filtered user list as CSV | Node.js stream, csv-stringify | Low | Medium |
| Alert persistence (snooze / rules) | Customisable alert thresholds with snooze | Alert config in Supabase | High | Medium |

**Counter-argument against Phase 2:** Adding Supabase rows for metrics and alerts introduces server state that must be migrated when schema changes. For a single-user internal tool, the operational overhead may not justify the convenience.

---

### Phase 3 — Multi-User, Multi-Platform, and Automation (6–12 months)

| Feature | Description | Technical prerequisite | Complexity | Business value |
|---------|-------------|----------------------|-----------|----------------|
| Multi-user RBAC | Different users see different data or sections | Replace env-var auth with Supabase Auth; add roles table | High | High (scale beyond single operator) |
| Multi-platform support | Switch between platform_id values | PLATFORM_ID as a URL or session param; all queries parameterised | High | High (GrayQuest operates multiple platforms) |
| Automated data refresh | Polling or Supabase webhook triggers recompute | Supabase Database Webhooks to /api/recompute | Low | High (eliminates manual pipeline step) |
| Email/Slack alerts | Push threshold alerts to Slack or email | Webhook integration (SendGrid, Slack Incoming Webhooks) | Medium | High (no need to open dashboard to detect incidents) |
| Scheduled metric reports | Weekly PDF/email digest | Vercel Cron + PDF generation (puppeteer/react-pdf) | High | Medium |
| Audit log export | Export compliance-ready access logs | New Supabase table; report download endpoint | Medium | Medium (DPDP Act compliance) |

**Counter-argument against Phase 3:** Multi-platform parameterisation requires refactoring every data query, every AI prompt, and every builtin evaluator. The PLATFORM_ID=6 assumption is baked into 30+ places. This is a high-risk refactor that could introduce platform data leakage bugs.

---

### Long-Term Vision

A self-service data intelligence layer across all of GrayQuest's operational platforms. Multiple platform operators each have their own scoped view. Natural language querying reaches parity with SQL for the most common 80% of questions. The AI chat becomes a primary interface for non-technical stakeholders to get answers about platform health without involving engineering.

**What could invalidate this roadmap:**
- If GrayQuest adopts a commercial BI tool (Metabase, Looker) → this dashboard becomes redundant above Phase 1
- If the IAM platform migrates to a new database structure → all raw table schemas need rewriting
- If Gemini API pricing increases significantly → AI features become cost-prohibitive
- If Ollama model quality improves enough → Gemini dependency can be eliminated

---

## 18. Open Questions & Decision Log

| # | Question | Options | Recommended Answer | What would change it |
|---|----------|---------|-------------------|---------------------|
| OQ1 | Should health score thresholds be 0–10 or 0–100? | A: Fix config to 60/40 (match compute). B: Fix compute to output 0–10. | **A** — compute output is 0–100; JSON data confirms it; changing compute would break all stored values | If compute.ts is intentionally producing 0–10 and the JSON data is wrong, choose B |
| OQ2 | Is compute.ts complete in production? | A: Context window truncation, file is complete. B: File is genuinely incomplete. | **A** — 13 JSON files in src/data/real/ exist and are populated, implying compute ran successfully at some point | If /api/recompute fails with missing save calls, choose B and implement the upsert logic |
| OQ3 | Should /api/* routes be auth-protected? | A: Add cookie check to all data routes. B: Accept current exposure for internal tool. | **A** — even internal tools should auth API routes | If Vercel deployment is behind Vercel's preview auth (password-protected deployments), B is acceptable short-term |
| OQ4 | Should custom metrics persist server-side? | A: Keep localStorage only. B: Add Supabase persistence. | **A for now** — single-user, acceptable limitation documented | If second user onboards, choose B immediately |
| OQ5 | What is the intended data refresh cadence? | A: Daily. B: Real-time. C: On-demand only. | **A: Daily** — CSV import pipeline runs on some cadence; exact schedule unknown | If confirmed real-time streaming is desired, choose B and replace snapshot model with live queries |
| OQ6 | Should the compute engine be TypeScript (current) or Python? | A: TypeScript (current). B: Python (csv-parse + pandas more natural for ETL). | **A** — keeps the stack homogeneous; Python adds a separate runtime dependency | If the actual import pipeline is Python and compute logic is duplicated, consolidate in Python |
| OQ7 | Is the login page's `platform_id=7` intentional? | A: Typo, should be 6. B: Intentional (platform_id=7 is a separate deployment). | **A** — all code uses 6; PLATFORM_ID env var is 6; 7 is a cosmetic error | If platform_id=7 is another GrayQuest environment, update the display conditionally |
| OQ8 | Should Ollama be supported in production Vercel? | A: No — local dev only; Gemini handles production. B: Run Ollama as a separate service. | **A** — Vercel functions can't reach localhost; running Ollama separately adds infra complexity | If cost of Gemini API becomes significant, B (containerised Ollama sidecar) becomes attractive |

---

## 19. Glossary

| Term | Definition |
|------|-----------|
| IAM | Identity and Access Management — the system controlling which users can access which GrayQuest services |
| Platform ID | A numeric identifier distinguishing different GrayQuest platform deployments. This dashboard is scoped to platform_id=6 |
| DAU | Daily Active Users — users who performed at least one login on a given day |
| MAU | Monthly Active Users — users who performed at least one login in the last 30 days |
| Health Score | A composite 0–100 score per user computed from: login frequency, action count, module diversity, and report usage — each normalised to 0–1 via min-max, averaged, then multiplied by 100 |
| Session | A sequence of user activity events with no gap exceeding 3,600 seconds (1 hour). Detected by the compute engine from raw_iam_activities |
| Snapshot | A precomputed JSON document representing a complete aggregation of one dataset (e.g., "users", "overview"). Stored in Supabase dx_snapshots and mirrored to src/data/real/dx_*.json |
| dx_* | Prefix for all derived/computed datasets (e.g., dx_overview, dx_users). "dx" = derived/data exchange |
| raw_* | Prefix for all source/raw Supabase tables (e.g., raw_iam_users, raw_audit_logs) |
| Recompute | The process of reading all raw_* tables and regenerating all 13 dx_* datasets. Triggered by POST /api/recompute |
| Builtin Evaluator | The deterministic pattern-matching engine in /api/metrics/compute that answers ~70 known formula patterns without AI |
| Structured Answer | A code-generated response in /api/chat that bypasses all AI models and formats data directly from the snapshot |
| Gemini | Google's generative AI model (gemini-2.0-flash) used for benchmark comparisons and complex formula computation |
| Ollama | Open-source local LLM runtime. Runs qwen2.5:0.5b on the developer's machine for data Q&A. Not available in Vercel production |
| qwen2.5:0.5b | A 0.5-billion-parameter quantised language model from Alibaba Cloud, run locally via Ollama. Optimised for speed; limited reasoning capability |
| Cross-Module Rate | Percentage of sessions where the user accessed 3 or more distinct services. Measures engagement breadth |
| Completion Rate | Percentage of sessions where the user performed at least one action after logging in. Sessions with only a login (and no service action) are "shallow" |
| Shallow Session | A session where the user logged in but took no actions. Shallow session % = 100% - completion rate |
| Dormant User | A user who has not logged in for more than 30 days |
| At Risk (user status) | A user with health score < 40 (after R1 fix; currently < 4 due to C1) |
| Active (user status) | A user with health score ≥ 60 (after R1 fix; currently ≥ 6 due to C1) |
| Cohort Retention | Percentage of users first seen in month M who returned in subsequent periods (W1=week 1, W2=week 2, W4=week 4, M2=month 2, M3=month 3) |
| PinnedMetric | A custom metric that the user has attached to a specific dashboard section via the Metrics Builder |
| Alert | A threshold-triggered notification visible in the TopBar bell icon, indicating a metric has breached a configured limit |
| JWT | JSON Web Token. A signed, compact auth token. Used here as HS256 signed cookie with 8-hour expiry |
| bcrypt | Password hashing algorithm. The dashboard user's password is stored as a bcrypt hash in the DASHBOARD_USER_PASSWORD_HASH env var |
| Section | One of: 'people' | 'services' | 'health' | 'metrics' | 'chat'. Used as a type throughout the codebase |
| StatusType | Event outcome classification: 'SUCCESS' | 'FAILED' | 'FAILURE' | 'PENDING' |
| FilterStore | Zustand in-memory store holding all UI filter state: dateRange, roles, services, search, etc. |
| MetricsStore | Zustand persisted store (localStorage) holding the user's saved custom metrics |
| PLATFORM_ID | Environment variable (default: '6') that filters all raw data queries to a specific GrayQuest platform instance |
| RECOMPUTE_SECRET | Secret Bearer token required to call POST /api/recompute. Prevents unauthorised recompute triggers |
| Force-dynamic | Next.js directive (`export const dynamic = 'force-dynamic'`) that disables static/ISR caching and forces server-side rendering on every request |
| Trend | Percentage change in a metric vs the previous equivalent period (e.g., +13.1% means 13.1% more active users than the prior 7d) |
| Report Export Rate | Percentage of generated reports that were subsequently exported/downloaded |
| Peak Hour | The hour of day (0–23) with the highest event count for a given service |
