# GrayQuest IAM Dashboard — Railway Deployment Guide

## Overview

This guide walks through deploying the Next.js 16 dashboard to **Railway** using the
GitHub integration. Railway auto-detects Next.js via Nixpacks — no Dockerfile required.

GitHub repo: `https://github.com/ashutoshbajpai-lab/grayquest-iam-dashboard`

---

## Architecture on Railway

```
Railway Project: grayquest-iam
└── Service: dashboard (Next.js)
    ├── Build:  npm ci && npm run build   (Nixpacks, Node 20)
    ├── Start:  npm run start             (Next.js production server)
    ├── Port:   3000 (auto-detected)
    └── Health: GET /api/health
```

The app is a single Next.js service. Supabase (external) provides the database;
no Railway-managed Postgres is needed.

---

## Step-by-Step Deployment

### 1. Create Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo**
3. Authorise Railway to access `ashutoshbajpai-lab/grayquest-iam-dashboard`
4. Select the repo → Railway detects Next.js automatically

### 2. Set environment variables

In Railway: **Project → Service → Variables**, add every variable below.
Use **Raw editor** to paste them all at once (template in next section).

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_PLATFORM_ID` | ✅ | `6` — filters all Supabase queries |
| `DASHBOARD_USER_EMAIL` | ✅ | Login email, e.g. `admin@grayquest.com` |
| `DASHBOARD_USER_PASSWORD_HASH` | ✅ | bcrypt hash of the login password |
| `NEXT_PUBLIC_DASHBOARD_USER_NAME` | ✅ | Display name shown in UI |
| `NEXT_PUBLIC_DASHBOARD_USER_ROLE` | ✅ | e.g. `IAM Analyst` |
| `NEXT_PUBLIC_DASHBOARD_USER_EMAIL` | ✅ | Same as DASHBOARD_USER_EMAIL |
| `JWT_SECRET` | ✅ | 32+ char random string for signing JWTs |
| `GEMINI_API_KEY` | ✅ | Google AI Studio key for Gemini 2.0 Flash |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service-role key (server-only) |
| `RECOMPUTE_SECRET` | ✅ | Random secret for the `/api/recompute` webhook |
| `NEXT_PUBLIC_DATASET_END_DATE` | ✅ | `2026-03-31` (or current data window end) |
| `GEMINI_TIMEOUT_MS` | optional | Default `25000` — Gemini request timeout |
| `OLLAMA_URL` | optional | Omit on Railway (Ollama is local-dev only) |
| `OLLAMA_MODEL` | optional | Omit on Railway |

> **Note on OLLAMA:** Railway does NOT run Ollama. The chat route will skip the
> Ollama tier gracefully — Gemini handles all AI requests in production.

#### Generate secrets quickly

```bash
# JWT_SECRET
openssl rand -base64 32

# RECOMPUTE_SECRET
openssl rand -hex 24

# DASHBOARD_USER_PASSWORD_HASH (replace YOUR_PASSWORD)
node -e "const b=require('bcryptjs'); b.hash('YOUR_PASSWORD',12).then(console.log)"
```

### 3. Verify Railway config

`railway.json` (already committed) tells Railway:

```json
{
  "build":  { "builder": "NIXPACKS", "buildCommand": "npm ci && npm run build" },
  "deploy": {
    "startCommand":      "npm run start",
    "healthcheckPath":   "/api/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### 4. Trigger first deploy

Railway auto-deploys on every push to `main`. After adding all variables:
- Click **Deploy** in Railway dashboard, or
- `git push origin main` (Railway will trigger automatically)

Watch build logs — the `npm run build` step should complete in ~2 minutes.

### 5. Assign a domain

In Railway: **Service → Settings → Domains** → **Generate Domain**

Railway gives a free `*.up.railway.app` subdomain, e.g.:
`grayquest-iam-dashboard.up.railway.app`

For a custom domain: add your domain and copy the CNAME record to your DNS.

---

## Environment Variable Template (Raw Paste)

Copy-paste into Railway's raw variable editor — fill in values marked `<...>`:

```
NEXT_PUBLIC_PLATFORM_ID=6
DASHBOARD_USER_EMAIL=<your-email>
DASHBOARD_USER_PASSWORD_HASH=<bcrypt-hash>
NEXT_PUBLIC_DASHBOARD_USER_NAME=<display-name>
NEXT_PUBLIC_DASHBOARD_USER_ROLE=IAM Analyst
NEXT_PUBLIC_DASHBOARD_USER_EMAIL=<your-email>
JWT_SECRET=<32-char-random>
GEMINI_API_KEY=<key>
NEXT_PUBLIC_SUPABASE_URL=<https://xxx.supabase.co>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_ROLE_KEY=<key>
RECOMPUTE_SECRET=<random-hex>
NEXT_PUBLIC_DATASET_END_DATE=2026-03-31
GEMINI_TIMEOUT_MS=25000
```

---

## Continuous Deployment

Every push to `main` triggers an automatic redeploy.

### Trigger nightly data recompute (optional)

After deploying, set up a daily cron to refresh the precomputed JSON snapshots:

```bash
# In your terminal or a cron job on any machine:
curl -X POST https://<your-railway-domain>/api/recompute \
  -H "Authorization: Bearer $RECOMPUTE_SECRET"
```

Or use Railway's built-in cron service to hit this endpoint daily.

---

## Supabase CORS / RLS Checklist

Before going live confirm:

- [ ] Supabase project **URL allowlist** includes your Railway domain
  - Supabase Dashboard → Authentication → URL Configuration → Add `https://*.up.railway.app`
- [ ] Row-Level Security (RLS) policies are in place on all 7 raw tables
  - `raw_iam_users`, `raw_iam_activities`, `raw_iam_user_groups`, `raw_iam_groups`,
    `raw_iam_services`, `raw_iam_events`, `raw_audit_logs`
- [ ] Service-role key is kept server-side only (never in `NEXT_PUBLIC_*` variables)

---

## Health Check

The app exposes `GET /api/health` → `{ status: "ok", ts: <epoch> }`.
Railway uses this to verify the service is up. No auth required on this endpoint.

---

## Resource Sizing

| Plan | RAM | vCPU | Notes |
|---|---|---|---|
| Hobby ($5/mo) | 512 MB | 0.5 | Adequate for low traffic |
| Pro | 8 GB | 8 | Recommended for production |

Next.js build requires ~512 MB RAM. Set **Build Memory** to at least 1 GB if the
build OOMs on the Hobby plan.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails: `Cannot find module 'next'` | `npm ci` not run | Check `buildCommand` in railway.json |
| `401 Unauthorized` on all API routes | Missing `JWT_SECRET` or cookies not sent | Verify JWT_SECRET is set; check HTTPS-only cookie flag |
| Chat returns `Gemini quota exceeded` | Free-tier API limit | Upgrade Gemini plan or wait for quota reset |
| Health check fails | `/api/health` 500 | Check Railway logs; often a missing env var |
| Blank dashboard after login | Missing `NEXT_PUBLIC_SUPABASE_URL` | Add the variable and redeploy |
| `RECOMPUTE_SECRET is not configured` | Variable missing | Add `RECOMPUTE_SECRET` env var |

---

*Last updated: 2026-04-26 · GrayQuest platform_id=6*
