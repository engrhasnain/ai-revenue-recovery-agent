# AI Revenue Recovery Agent — Implementation Flow

## What This System Does

Businesses lose money every day from unpaid invoices. This system uses AI to automatically watch all outstanding invoices, decide who to contact and how, write personalised messages in the right language, and predict how much money will come back over the next 90 days.

---

## The Full Flow in Simple Steps

### Step 1 — Customers & Invoices Come In
- You add clients (name, email, country, phone/WhatsApp)
- You create invoices tied to each client (amount, due date, currency)
- The system watches every invoice and automatically marks it **overdue** the moment the due date passes

### Step 2 — AI Classifies Risk
- Every client gets a risk score: **Low / Medium / High**
- Risk is based on how many invoices are overdue, how long they've been overdue, and how much is owed
- You can click "Refresh Risk" anytime to re-run the AI classification on any client

### Step 3 — Smart Next Action (AI Recommendation)
- When you click **Remind** on an invoice, the AI reads the full history of that invoice
- It looks at: how many reminders have been sent, how many days overdue, what channel was used last, whether the client has responded before
- It then recommends: **which channel to use** (Email / WhatsApp / SMS) and **what type of message** (First Notice / Second Notice / Final Notice / Payment Plan / Escalation)
- This recommendation pre-fills the form automatically — you can override it if you want

### Step 4 — AI Writes the Message
- Once you hit **Generate & Send**, the AI writes a personalised message
- It detects the client's country and writes in the right language:
  - 🇩🇪 Germany / Austria / Switzerland → German
  - 🇫🇷 France / Belgium → French
  - 🇯🇵 Japan → Japanese
  - 🇪🇸 Spain / Mexico / Latin America → Spanish
  - 🇦🇪 UAE / Saudi Arabia / Gulf → Arabic
  - Everyone else → English
- The message tone matches the urgency: friendly for first notices, firm for final notices, formal for escalations
- The reminder is logged, timestamped, and tracked

### Step 5 — AI Cash Flow Prediction
- The system reads every overdue and partially-paid invoice
- It applies risk-weighted recovery rates (High risk = 25% likely to pay, Low risk = 88% likely)
- It combines days-overdue with risk level to predict:
  - How much you'll collect in the **next 30 days**
  - How much in the **next 60 days**
  - How much in the **next 90 days**
- This updates every time you refresh

### Step 6 — Weekly AI Intelligence Report
- Click **Weekly AI Report** on the dashboard
- The AI reads all invoices, reminder history, risk distribution, and collection rate
- It writes a full intelligence report with:
  - Key performance metrics table
  - Risk breakdown
  - Reminder effectiveness analysis
  - Recommended priority actions
  - Cash flow outlook
- The report is rendered as a formatted document inside the app

---

## What Happens in the Background (Auto)

| Trigger | What the system does |
|---|---|
| Page loads | Marks all invoices past their due date as **Overdue** |
| Reminder sent | Logs channel, message, timestamp — AI-generated flag set |
| Risk refresh clicked | Re-evaluates client based on current invoice state |
| Cash flow card loads | Applies recovery model across all active invoices |
| Weekly report clicked | AI reads full DB stats and generates a markdown report |

---

## Data Flow Diagram (Simple)

```
Client added → Invoice created → Due date passes → Marked Overdue
                                                        ↓
                                              AI Risk Classification
                                                        ↓
                                           Click Remind → AI reads history
                                                        ↓
                                        AI picks: Channel + Message Type
                                                        ↓
                                        AI writes message (in right language)
                                                        ↓
                                             Reminder logged & sent
                                                        ↓
                                        Dashboard updates: Cash Flow + Report
```

---

## Demo Talking Points

1. **"The AI never sends the same message twice"** — each reminder is generated fresh based on the invoice history and client profile

2. **"It knows the client's language"** — show a German or Japanese client getting a reminder in their language automatically

3. **"It tells you what to do next"** — click Remind on an escalated invoice, the AI says "Escalate to legal" or "Try payment plan"

4. **"It predicts your cash flow"** — the 30/60/90 day forecast uses risk-weighted recovery rates, not guesses

5. **"It learns from response history"** — if a client responds, log it. The AI uses that signal in future recommendations

6. **"It generates board-ready reports"** — click Weekly AI Report, show the formatted intelligence document

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python) + async SQLAlchemy |
| Database | SQLite via aiosqlite |
| AI Engine | Anthropic Claude API (demo mode works without API key) |
| Frontend | Next.js 15 + React 19 + TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Package manager | uv (Python) + npm (Node) |

---

## Running the Project

```bash
# Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000

# Seed demo data (first time only)
uv run python seed.py

# Frontend
cd frontend
npm install
npm run dev
```

Visit: http://localhost:3000
