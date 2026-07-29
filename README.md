# AI Revenue Recovery Agent

Full-stack AI system for automated invoice follow-up, payment risk classification, and revenue recovery.

## Stack
- **Backend:** Python FastAPI · uv · SQLAlchemy · Anthropic Claude
- **Frontend:** Next.js 15 · TypeScript · Tailwind CSS · Recharts

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env          # add your ANTHROPIC_API_KEY
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run python seed.py         # optional: load demo data
```

### Frontend
```bash
cd frontend
npm install
npm run dev                    # runs on http://localhost:3000
```

## Project Structure
```
AI-Revenue-Recovery-Agent/
├── backend/
│   ├── src/app/
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── routers/        # FastAPI route handlers
│   │   ├── services/       # AI, notification, recovery logic
│   │   ├── database.py
│   │   ├── config.py
│   │   └── main.py
│   └── seed.py
└── frontend/
    └── src/
        ├── app/            # Next.js pages (dashboard, invoices, customers, reminders)
        ├── components/     # Reusable UI components
        ├── lib/            # API client + utilities
        └── types/          # TypeScript types
```

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/analytics/dashboard` | Dashboard summary + metrics |
| GET | `/api/v1/analytics/overdue-aging` | Aging bucket report |
| GET/POST | `/api/v1/customers` | List / create customers |
| PATCH | `/api/v1/customers/{id}` | Update customer |
| POST | `/api/v1/customers/{id}/refresh-risk` | AI re-classify risk |
| GET/POST | `/api/v1/invoices` | List / create invoices |
| POST | `/api/v1/invoices/{id}/mark-paid` | Mark invoice paid |
| POST | `/api/v1/reminders/generate-and-send` | AI generate + dispatch reminder |
| POST | `/api/v1/reminders/{id}/log-response` | Log + AI-analyze customer reply |
| POST | `/api/v1/reminders/escalate/{invoice_id}` | Escalate invoice |
