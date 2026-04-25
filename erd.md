# GrayQuest IAM Dashboard — Entity Relationship Diagram

> Paste into https://mermaid.live to render.  
> Every entity maps 1:1 to a table defined in PRD Section 7.  
> Every attribute listed in Section 7 appears below.  
> Every foreign key relationship appears as a labelled line.

```mermaid
erDiagram

    %% ─────────────────────────────────────────────
    %% DOMAIN: Raw IAM Source Tables (Supabase)
    %% ─────────────────────────────────────────────

    RAW_IAM_USERS {
        text id PK
        text email
        text parent_id FK
        text is_active
        text created_on
        text updated_on
        text deleted_on
    }

    RAW_IAM_ACTIVITIES {
        text id PK
        text user_id FK
        text platform_id
        text type
        text created_on
    }

    RAW_IAM_USER_GROUPS {
        text id PK
        text user_id FK
        text group_id FK
        text created_on
        text updated_on
        text deleted_on
    }

    RAW_IAM_GROUPS {
        text id PK
        text code
        text name
        text description
        text is_active
        text created_on
    }

    RAW_IAM_SERVICES {
        text id PK
        text code
        text slug
        text name
        text is_active
        text created_on
    }

    RAW_IAM_EVENTS {
        text id PK
        text code
        text label
        text slug
        text is_active
    }

    RAW_AUDIT_LOGS {
        text id PK
        text code
        text user_id FK
        text platform_id
        text service_id FK
        text event_id FK
        text type
        jsonb data
        text comment
        text status
        text created_on
    }

    %% ─────────────────────────────────────────────
    %% DOMAIN: Derived Snapshot Table (Supabase)
    %% ─────────────────────────────────────────────

    DX_SNAPSHOTS {
        text id PK
        jsonb data
        timestamptz updated_at
    }

    %% ─────────────────────────────────────────────
    %% DOMAIN: Computed In-Process Entity
    %% ─────────────────────────────────────────────

    SESSION {
        number session_id PK
        string user_id FK
        datetime start
        datetime end
        number hour
        string date
        string week
        string month
        string login_type
        number duration_sec
    }

    %% ─────────────────────────────────────────────
    %% DOMAIN: Client-Only Entities (localStorage)
    %% ─────────────────────────────────────────────

    CUSTOM_METRIC {
        string id PK
        string name
        string description
        string formula
        string result
        string[] pinnedTo
        string createdAt
    }

    FILTER_STATE {
        boolean isDark
        boolean sidebarOpen
        string preset
        string from
        string to
        string[] roles
        string[] services
        string[] statuses
        number hourRangeMin
        number hourRangeMax
        string search
    }

    %% ─────────────────────────────────────────────
    %% RELATIONSHIPS — Raw IAM domain
    %% ─────────────────────────────────────────────

    RAW_IAM_USERS ||--o{ RAW_IAM_ACTIVITIES : "performs"
    RAW_IAM_USERS ||--o{ RAW_IAM_USER_GROUPS : "belongs to"
    RAW_IAM_GROUPS ||--o{ RAW_IAM_USER_GROUPS : "has members"
    RAW_IAM_USERS ||--o{ RAW_AUDIT_LOGS : "generates"
    RAW_IAM_SERVICES ||--o{ RAW_AUDIT_LOGS : "receives action on"
    RAW_IAM_EVENTS ||--o{ RAW_AUDIT_LOGS : "typed as"
    RAW_IAM_USERS }o--o| RAW_IAM_USERS : "has parent"

    %% ─────────────────────────────────────────────
    %% RELATIONSHIPS — Compute pipeline
    %% ─────────────────────────────────────────────

    RAW_IAM_ACTIVITIES ||--o{ SESSION : "grouped into"
    RAW_IAM_USERS ||--o{ SESSION : "owns"
    DX_SNAPSHOTS }o--|| RAW_IAM_USERS : "aggregates from"
    DX_SNAPSHOTS }o--|| RAW_AUDIT_LOGS : "aggregates from"
    DX_SNAPSHOTS }o--|| RAW_IAM_ACTIVITIES : "aggregates from"

    %% ─────────────────────────────────────────────
    %% RELATIONSHIPS — Client-side
    %% ─────────────────────────────────────────────

    CUSTOM_METRIC }o--o{ FILTER_STATE : "pinned to section in"
```

---

## Relationship Legend

| Entity A | Relationship | Entity B | Cardinality | FK Column |
|----------|-------------|----------|------------|-----------|
| RAW_IAM_USERS | performs | RAW_IAM_ACTIVITIES | One user → many activities | RAW_IAM_ACTIVITIES.user_id → RAW_IAM_USERS.id |
| RAW_IAM_USERS | belongs to | RAW_IAM_USER_GROUPS | One user → many group memberships | RAW_IAM_USER_GROUPS.user_id → RAW_IAM_USERS.id |
| RAW_IAM_GROUPS | has members | RAW_IAM_USER_GROUPS | One group → many memberships | RAW_IAM_USER_GROUPS.group_id → RAW_IAM_GROUPS.id |
| RAW_IAM_USERS | generates | RAW_AUDIT_LOGS | One user → many audit log entries | RAW_AUDIT_LOGS.user_id → RAW_IAM_USERS.id |
| RAW_IAM_SERVICES | receives action on | RAW_AUDIT_LOGS | One service → many audit log entries | RAW_AUDIT_LOGS.service_id → RAW_IAM_SERVICES.id |
| RAW_IAM_EVENTS | typed as | RAW_AUDIT_LOGS | One event type → many audit log entries | RAW_AUDIT_LOGS.event_id → RAW_IAM_EVENTS.id |
| RAW_IAM_USERS | has parent | RAW_IAM_USERS | One user → optional parent user (self-ref) | RAW_IAM_USERS.parent_id → RAW_IAM_USERS.id |
| RAW_IAM_ACTIVITIES | grouped into | SESSION | Many activities → one session (computed) | SESSION.user_id → RAW_IAM_USERS.id |
| RAW_IAM_USERS | owns | SESSION | One user → many sessions | SESSION.user_id → RAW_IAM_USERS.id |
| DX_SNAPSHOTS | aggregates from | RAW_IAM_USERS | Many snapshots ← many raw users (ETL) | Logical only (compute pipeline) |
| DX_SNAPSHOTS | aggregates from | RAW_AUDIT_LOGS | Many snapshots ← many audit logs (ETL) | Logical only (compute pipeline) |
| DX_SNAPSHOTS | aggregates from | RAW_IAM_ACTIVITIES | Many snapshots ← many activities (ETL) | Logical only (compute pipeline) |
| CUSTOM_METRIC | pinned to section in | FILTER_STATE | Many metrics ↔ many sections (array field) | CUSTOM_METRIC.pinnedTo (string array of section names) |

---

## Notes on Diagram Design

1. **SESSION** is an in-process computed entity, not persisted to any database table. It is included because it is a first-class structural concept in the compute pipeline and drives session-related KPIs (cross-module rate, completion rate, duration).

2. **DX_SNAPSHOTS** is a single physical table with `id` as the discriminator. Each row holds a different dataset (e.g., id='overview', id='users'). The diagram shows it as a single entity; in practice it functions as 13 virtual typed views distinguished by the `id` string.

3. **CUSTOM_METRIC** and **FILTER_STATE** are client-only entities stored in the browser (localStorage / Zustand). They have no Supabase representation. Their relationship to FILTER_STATE is semantic: a metric's `pinnedTo` array contains Section values that match the sections managed by FILTER_STATE.

4. **platform_id** appears in both RAW_IAM_ACTIVITIES and RAW_AUDIT_LOGS as a text column used as a filter key. It is not a foreign key to a platforms table — no such table exists in the schema. All data for platform_id='6' is included; all other platform_id values are excluded during the compute join step.
