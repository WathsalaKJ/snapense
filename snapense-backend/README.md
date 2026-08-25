# Snapense API

Flask + SQLAlchemy backend for the Snapense expense tracker: receipt OCR,
rule-based categorisation, and spending anomaly detection.

## 1. Start Postgres

Nothing is listening on port 5432 on this machine and Docker is not installed.
Install Docker Desktop, then:

```bash
docker run --name snapense-db \
  -e POSTGRES_USER=snapense_user \
  -e POSTGRES_PASSWORD=snapense_pass \
  -e POSTGRES_DB=snapense_db \
  -p 5432:5432 \
  -v snapense_pgdata:/var/lib/postgresql/data \
  -d postgres:16
```

PowerShell one-liner:

```powershell
docker run --name snapense-db -e POSTGRES_USER=snapense_user -e POSTGRES_PASSWORD=snapense_pass -e POSTGRES_DB=snapense_db -p 5432:5432 -v snapense_pgdata:/var/lib/postgresql/data -d postgres:16
```

Later restarts: `docker start snapense-db`.

## 2. Set up the app

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env      # then edit the secrets
```

## 3. Create the schema

The initial migration is already committed under `migrations/versions/`, so:

```powershell
$env:FLASK_APP = "app.py"
flask db upgrade
flask seed-categories
```

To regenerate the migration from scratch instead, delete
`migrations/versions/*.py` and run `flask db migrate -m "initial schema"`.

## 4. Run

```powershell
flask run          # http://localhost:5000
```

Health check: `GET /api/health`.

## Tests

```powershell
pytest
```

The suite runs against in-memory SQLite, so it needs no Postgres container.

## curl quickstart

```bash
BASE=http://localhost:5000/api

# Register -> returns access_token + refresh_token
curl -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"correct-horse-battery","full_name":"Ada Lovelace"}'

# Login
TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"correct-horse-battery"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Transactions, with optional filters
curl "$BASE/transactions" -H "Authorization: Bearer $TOKEN"
curl "$BASE/transactions?category=Groceries" -H "Authorization: Bearer $TOKEN"
curl "$BASE/transactions?start_date=2026-08-01&end_date=2026-08-31" -H "Authorization: Bearer $TOKEN"

# Single transaction
curl "$BASE/transactions/1" -H "Authorization: Bearer $TOKEN"

# Dashboard: month total, category split, 6-month trend, anomalies
curl "$BASE/dashboard/summary" -H "Authorization: Bearer $TOKEN"

# Upload a receipt image -> creates the transaction and its line items
curl -X POST "$BASE/receipts/upload" -H "Authorization: Bearer $TOKEN" \
  -F "receipt=@/path/to/receipt.jpg"

# Insights (cached; POST /generate refreshes them)
curl -X POST "$BASE/insights/generate" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"start_date":"2026-08-01","end_date":"2026-08-31"}'
curl "$BASE/insights" -H "Authorization: Bearer $TOKEN"
```

## Receipt OCR (vision LLM)

Receipts are read by a vision LLM rather than a local OCR binary. The provider
and model are env-only, so swapping them needs no code change:

```
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
GEMINI_API_KEY=your-key-here
```

Get a free key at https://aistudio.google.com/apikey - sign in with a Google
account and click "Create API key". No credit card is required.

The model is asked for one JSON object and nothing else, but its reply is still
treated as untrusted: markdown fences and stray prose are stripped, every field
is re-coerced to the right type, unusable line items are dropped, and a
`suggested_category` that matches no real row falls back to keyword matching and
then to "Other" - so a hallucinated category can never become a dangling foreign
key. If nothing usable comes back, the upload returns 502 and no partial
transaction or orphaned image is left behind.

Adding another provider means writing one adapter and registering it in
`_PROVIDERS` in `services/ocr_service.py`.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account, returns JWT pair |
| POST | `/api/auth/login` | Log in, returns JWT pair |
| POST | `/api/auth/refresh` | New access token from a refresh token |
| GET/PATCH | `/api/auth/me` | Read / update the profile |
| GET/POST | `/api/transactions` | List (filter, paginate) / create |
| POST | `/api/receipts/upload` | Upload a receipt image -> transaction + line items |
| GET | `/api/receipts/<path>` | Serve an owned receipt image |
| GET/PATCH/DELETE | `/api/transactions/<id>` | Single transaction |
| GET | `/api/transactions/categories` | All categories |
| GET | `/api/dashboard/summary` | Month total, category split, 6-month trend, anomalies |
| GET | `/api/dashboard/by-category` | Category breakdown with shares |
| GET | `/api/dashboard/trend` | Daily or monthly spend series |
| GET | `/api/dashboard/top-merchants` | Highest-spend merchants |
| GET | `/api/dashboard/anomalies` | Flagged transactions |
| GET | `/api/insights` | Stored insights |
| POST | `/api/insights/generate` | Recompute insights for a period |
| POST | `/api/insights/rescan-anomalies` | Re-run detection over all history |
| DELETE | `/api/insights/<id>` | Delete an insight |

All routes except `/api/health`, `/api/auth/register`, and `/api/auth/login`
require `Authorization: Bearer <access_token>`.

