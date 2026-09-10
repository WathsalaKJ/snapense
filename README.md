# Snapense

[![Backend tests](https://github.com/WathsalaKJ/snapense/actions/workflows/backend-tests.yml/badge.svg)](https://github.com/WathsalaKJ/snapense/actions/workflows/backend-tests.yml)

Snap a photo of a receipt and get a categorized, budget-tracked expense record — no manual entry.

A personal project (not a course requirement) built to go end-to-end: a photo is parsed into a structured transaction by a vision LLM, categorized spending rolls up into a dashboard and per-category budgets, and a text LLM turns the numbers into a plain-English spending insight on request.

## Features

- **Receipt capture with AI OCR** — photograph a receipt; Gemini's vision model extracts merchant, date, total, tax, and line items, each with a suggested category
- **Manual transaction entry** for expenses without a receipt
- **Transaction management** — list with filters, detail view, edit, delete
- **Spending dashboard** — totals, category breakdown, 6-month trend, top merchants
- **Anomaly detection** — flags transactions that are a statistical outlier (z-score) against a user's own category history
- **AI-generated insights** — an on-demand, Gemini-written summary of spending patterns, regenerable from the dashboard
- **Per-category monthly budgets** — set/edit/delete a limit per category, track spend against it, and view budget-vs-actual history over past months
- **Auth** — registration, login, JWT access/refresh, profile editing
- **Responsive web build** — the same Expo app ships a desktop-web layout (sidebar nav, data grids) alongside the mobile one

## Tech stack

**Backend** — Flask 3.1, SQLAlchemy 2 + Flask-Migrate (Alembic), Flask-JWT-Extended, PostgreSQL (via `psycopg` 3), Gemini (`google-genai`) for OCR and insight generation, boto3 for S3-compatible object storage, Pillow, gunicorn, pytest

**Frontend** — Expo SDK 57, React Native 0.86, React 19, TypeScript, React Navigation, react-native-svg (charts), react-native-reanimated, Axios

## Architecture

```text
Expo app (iOS / Android / Web)
        │  HTTPS + JWT
        ▼
Flask API  ── Render
        │
        ├──▶ Postgres  ── Supabase (via connection pooler)
        ├──▶ Object storage ── Supabase Storage (S3-compatible, receipt photos)
        └──▶ Gemini ── receipt OCR + spending insights
```

The mobile/web client is one Expo codebase; the web build is a static export deployed separately. The API and Postgres/storage backends are otherwise shared between platforms.

## Live demo

**[snapense-delta.vercel.app](https://snapense-delta.vercel.app)**

The backend runs on Render's free tier, which spins down after inactivity — the first request after a while can take 20-30 seconds to wake up. Subsequent requests are fast.

## Running locally

```bash
git clone https://github.com/WathsalaKJ/snapense.git
cd snapense

# Backend
cd snapense-backend
python -m venv .venv && .\.venv\Scripts\Activate.ps1   # or source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env        # fill in SECRET_KEY, JWT_SECRET_KEY, and a DB/LLM config
flask db upgrade
flask seed-categories
flask run --host 0.0.0.0 --port 5000

# Frontend (separate terminal)
cd snapense-app
npm install
npx expo start
```

See `.env.example` for the full list of configuration options (database, Supabase Storage, Gemini key, etc.).

## Testing

101 backend tests (`pytest`), covering auth, transactions, budgets, receipt OCR, and insight generation — the Gemini calls are mocked at the service boundary, so the suite runs without a real API key or network access. It runs against an in-memory SQLite database and executes automatically in CI on every push and pull request via the badge above.

## Notable technical challenges

- **Supabase's direct Postgres connection resolves to an IPv6-only address, which Render's outbound network can't reach.** Switched the API's `DATABASE_URL` to Supabase's connection pooler endpoint instead, which is IPv4-reachable.
- **React Native Web's `Alert.alert` is a silent no-op in the browser.** Delete confirmations worked on mobile but did nothing on web with no error; replaced them with a themed in-app `ConfirmDialog` component that works on both.
- **Expo Go's iOS client enforces lockstep SDK versions**, so a stale local SDK stops the app from opening at all on a freshly-updated phone. Required a full upgrade from Expo SDK 54 to 57 (React Native 0.81 → 0.86) rather than a partial dependency bump.
- **`react-native-svg`-based charts crashed on the web build** despite working fine on mobile; required auditing chart components for web-incompatible native APIs and adding platform-specific fallbacks.
