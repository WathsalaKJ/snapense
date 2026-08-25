# Snapense

Mobile expense tracker with OCR receipt scanning and spending anomaly detection.

| Folder | What it is |
| --- | --- |
| `snapense-backend/` | Flask + SQLAlchemy REST API (auth, transactions, receipts, dashboard, insights) |
| `snapense-app/` | Expo / React Native app (TypeScript) |

---

## TL;DR — this machine is already set up

Both projects have their dependencies installed and `snapense-backend/dev.sqlite3`
is seeded with six months of demo data. To run:

**Terminal 1 — API**

```powershell
cd snapense-backend
$env:FLASK_APP="app.py"
$env:DATABASE_URL="sqlite:///c:/Users/a12u/Desktop/snapense/snapense/snapense-backend/dev.sqlite3"
$env:JWT_SECRET_KEY="dev-only-secret-long-enough-for-sha256-hmac-abcdefgh"
$env:LLM_PROVIDER="stub"
.\.venv\Scripts\python.exe -m flask run --host 0.0.0.0 --port 5000
```

**Terminal 2 — app**

```powershell
cd snapense-app
npx expo start
```

Scan the QR code with Expo Go. Log in as **`phone@example.com`** / **`correct-horse-battery`**.

`--host 0.0.0.0` is not optional — the default binds `127.0.0.1`, which your phone cannot reach.

---

## Prerequisites

| Tool | Version here | Notes |
| --- | --- | --- |
| Python | 3.14 | `psycopg` and `Pillow` need recent versions for 3.14 wheels |
| Node.js | 24.x | |
| Expo Go | latest | On the phone, from the App Store / Play Store |
| Docker Desktop | **not installed** | Only needed for the Postgres path below |

The phone and this computer must be on the **same network**.

---

## 1. Backend

### Install

```powershell
cd snapense-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

### Configure secrets

Open `.env` and replace both placeholder secrets. Generate each with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Set `SECRET_KEY` and `JWT_SECRET_KEY` to two different values. **The current `.env`
still has short placeholders** — pytest warns about this on every run, because a
13-byte key is below the 32-byte minimum for HMAC-SHA256.

`.env` is gitignored. Never commit it.

### Create the database

Two options.

**Option A — SQLite (no Docker, works right now).** Fine for development and
what everything so far has been tested against.

```powershell
$env:FLASK_APP="app.py"
$env:DATABASE_URL="sqlite:///c:/Users/a12u/Desktop/snapense/snapense/snapense-backend/dev.sqlite3"
flask db upgrade          # only on a fresh file; dev.sqlite3 already has its tables
flask seed-categories
```

**Option B — Postgres (the intended target).** Install Docker Desktop, then:

```powershell
docker run --name snapense-db -e POSTGRES_USER=snapense_user -e POSTGRES_PASSWORD=snapense_pass -e POSTGRES_DB=snapense_db -p 5432:5432 -v snapense_pgdata:/var/lib/postgresql/data -d postgres:16
```

Then, with no `DATABASE_URL` set (so `.env`'s Postgres settings apply):

```powershell
$env:FLASK_APP="app.py"
flask db upgrade
flask seed-categories
```

Restart the container later with `docker start snapense-db`.

> The initial migration in `migrations/versions/` was authored and verified
> offline against SQLite. It uses only portable SQLAlchemy types, but it has
> **never been applied to a real Postgres instance**. Check `\dt` output the
> first time you run it.

### Receipt OCR

Receipts are read by a vision LLM. Configure in `.env`:

```
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
GEMINI_API_KEY=your-key-here
```

Get a free key at <https://aistudio.google.com/apikey> — sign in with a Google
account, click **Create API key**. No credit card required.

`LLM_PROVIDER=stub` (the current setting) returns a **fixed canned receipt** and
ignores your photo entirely. It exists so the capture flow can be tested without
a key. Switch to `gemini` for real extraction.

### Run and test

```powershell
flask run --host 0.0.0.0 --port 5000
pytest                     # 40 tests, uses in-memory SQLite, needs no server
```

Health check: `GET http://localhost:5000/api/health`

---

## 2. Mobile app

```powershell
cd snapense-app
npm install
npx expo start
```

### Point it at your machine

The app reads its API URL from `app.json` → `expo.extra.apiBaseUrl`, currently:

```
http://192.168.6.240:5000/api
```

That is this machine's Wi-Fi address. **It changes when you switch networks or
when DHCP renews the lease.** Find the current one with:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }
```

Then update `app.json`, or override without editing it:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="http://<your-ip>:5000/api"
```

`localhost` will never work from a phone — it resolves to the phone itself.

### Firewall

The active network profile is **Public**, where Windows blocks inbound
connections by default, and nothing currently allows port 5000. In an
**Administrator** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "Snapense dev API" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow -Profile Public
```

Before opening the app, confirm from the phone's browser:
`http://192.168.6.240:5000/api/health` → `{"service":"snapense-api","status":"ok"}`

If that fails, the app will too — fix it here first.

---

## 3. Smoke test on the phone

1. **Login** — `phone@example.com` / `correct-horse-battery`
2. **Capture tab** (opens first) — allow camera, hit the shutter
3. **Scanning** — "Reading your receipt…"; with `LLM_PROVIDER=stub` this returns the same canned receipt every time
4. **Review** — edit merchant/date/prices, tap a category chip to open the picker, **Confirm & Save**
5. **Transactions** — 28 seeded rows; try the category and date chips; swipe a row left for Edit/Delete
6. **Dashboard** — tap donut segments, scroll to the 6-month trend, the rose anomaly cards, and insights
7. **Detail** — transaction 28 has a real photo; transaction 1 has a dangling path and exercises the fallback receipt render

---

## Known gaps

- **Postgres has never been provisioned.** Everything is verified on SQLite only.
- **OCR is stubbed.** Add a Gemini key for real extraction.
- **JWT/secret keys are placeholders** and too short.
- **`ocr_confidence` is never populated** by the Gemini path, so the review
  screen's confidence dots stay hidden. Adding per-field confidence to the
  prompt would light them up.
- **No Budgets panel.** The design has one; there is no budget model in the
  backend, so it was left out rather than hardcoded.
- **Nothing is committed to git yet** — the repo has zero commits.

---

## Project layout

```
snapense-backend/
  app.py config.py models.py
  routes/    auth_routes  transaction_routes  receipt_routes  dashboard_routes  insight_routes
  services/  ocr_service  categorization_service  anomaly_service
  utils/     file_storage
  migrations/  tests/

snapense-app/
  App.tsx
  src/api/         client (JWT + 401 refresh)  endpoints  types  tokenStore  config
  src/context/     AuthContext (expo-secure-store)  ThemeContext
  src/navigation/  RootNavigator  TabBar (raised Capture)
  src/screens/     auth/{Login,Register}  Capture  Scanning  ReceiptReview
                   TransactionsList  TransactionDetail  Dashboard  Profile  Onboarding
  src/theme/       colors.ts  index.ts (colour tokens, spacing, type scale)
  src/components/  charts  icons  CategoryPicker
```
