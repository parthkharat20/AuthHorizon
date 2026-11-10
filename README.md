# AuthHorizon

> **Split-Shipment Intelligence** — AI-powered supplier delay parsing meets PayPal's native authorization-and-capture lifecycle for legally compliant, buyer-consented partial fulfillment.

[![PayPal AI Hackathon 2026](https://img.shields.io/badge/PayPal-AI%20Hackathon%202026-003087?style=for-the-badge&logo=paypal&logoColor=white)](https://paypalaihackathon.devpost.com/)
[![AG Grid](https://img.shields.io/badge/AG%20Grid-Studio-0070e0?style=for-the-badge)](https://ag-grid.com/)

---

## The Problem

When a multi-item e-commerce order has some items in stock and others delayed by suppliers:

1. **Charge everything upfront?** → Violates FTC 16 CFR Part 435 (can't charge before shipping) and EU shipping directives
2. **Cancel the whole order?** → Loses revenue and frustrates buyers
3. **Wait for everything?** → Delays shipped items, destroys customer experience

**23% of multi-item orders contain at least one backordered item.** There is no system that connects unstructured supplier delay notices to legally compliant buyer choices and deterministic payment execution.

## The Solution

AuthHorizon builds the missing operational and legal compliance bridge:

```
Messy Supplier Email → AI Parser (Claude) → Deterministic Validator → Buyer Consent Portal → PayPal Split-Capture Execution → Auditable Ledger
```

### How It Works

1. **Authorize, Don't Capture** — Order created with PayPal `intent: "AUTHORIZE"` ($90 held, $0 charged)
2. **Ship What's Ready** — Partial capture ($60) for in-stock items, `final_capture: false` keeps auth open
3. **AI Reads the Mess** — Claude parses messy/multilingual supplier delay notices (German, Danish, English), extracting SKU, ship date, reason with confidence scores
4. **Buyer Chooses** — Clean consent portal: Wait (keep hold), Swap (alternative item), or Cancel (release hold)
5. **Deterministic Execution** — Code moves every cent. AI never touches money. SHA-256 consent hashing for audit trail.

### The Non-Negotiable Safety Gate

> **AI NEVER moves, calculates, or authorizes money.** AI parses unstructured text and drafts buyer-facing messages. Deterministic Python code computes amounts, calls PayPal APIs, and executes transactions with idempotency headers.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Supplier Email (DE/DA/EN)                                  │
│       ↓                                                     │
│  AI Parser (Claude 3.5 Sonnet) — extracts SKU, date, reason│
│       ↓                                                     │
│  Deterministic Validator — confidence check, item matching  │
│       ↓                                                     │
│  Buyer Consent Portal — Wait / Swap / Cancel                │
│       ↓                                                     │
│  PayPal REST v2 — authorize → partial capture → resolve     │
│       ↓                                                     │
│  AG Grid Merchant Dashboard — Split Hold Bar + Audit Ledger │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy, Pydantic v2 |
| **AI** | Claude 3.5 Sonnet (Anthropic) — notice parsing only |
| **Payments** | PayPal REST v2 (`intent: AUTHORIZE`, partial captures) |
| **Frontend** | React 18, Vite, Tailwind CSS, AG Grid Community |
| **Database** | SQLite (audit ledger) |

## Key Features

- **Split Hold Bar** — Hero visual: $90 bar dynamically splits into $60 Green (Captured) / $30 Amber (Held) with smooth CSS animations
- **Multilingual AI Parsing** — Handles German, Danish, and English supplier emails with per-field confidence scoring
- **Cryptographic Consent** — SHA-256 hash binding displayed text + choice + timestamp for immutable audit trail
- **Idempotent Transactions** — Every PayPal capture includes `PayPal-Request-Id` header
- **Webhook Verification** — Captures verified via `POST /v1/notifications/verify-webhook-signature`
- **AG Grid Dashboard** — Full merchant command center with order grid, audit log, and Hold Bar visualization

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- PayPal Sandbox account ([developer.paypal.com](https://developer.paypal.com))
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

### Setup

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/authhorizon.git
cd authhorizon

# Backend
cp .env.example .env
# Edit .env with your PayPal Sandbox + Anthropic credentials
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` for the Merchant Dashboard.

### Demo Flow

1. Click **"Create Demo Order"** ($90 total: 3 items × $30)
2. Open the PayPal approval link → log in as sandbox buyer → approve
3. Click **"Authorize"** → Hold Bar shows $90 solid
4. Click **"Ship In-Stock Items"** → Hold Bar splits: $60 Green / $30 Amber
5. Select a supplier notice fixture (German/Danish/English) → **"Parse Notice"**
6. Navigate to Buyer Consent Portal → choose Wait, Swap, or Cancel
7. Check the Audit Ledger — every transaction verified

## PayPal APIs Used

| Endpoint | Purpose |
|----------|---------|
| `POST /v2/checkout/orders` | Create order with `intent: "AUTHORIZE"` |
| `POST /v2/checkout/orders/{id}/authorize` | Lock authorization |
| `POST /v2/payments/authorizations/{id}/capture` | Partial capture (`final_capture: false` then `true`) |
| `POST /v2/payments/authorizations/{id}/void` | Release remaining hold (Cancel path) |
| `POST /v1/notifications/verify-webhook-signature` | Verify webhook authenticity |

## Regulatory Compliance

- **FTC 16 CFR Part 435** — Cannot charge for unshipped goods. AuthHorizon captures only when items ship.
- **EU Consumer Rights Directive** — Requires merchant notification and buyer consent for delays.
- **PayPal Seller Protection** — Documented authorization-and-capture flow with audit trail reduces dispute liability.

## License

MIT

---

Built for the [PayPal AI Hackathon 2026](https://paypalaihackathon.devpost.com/) 🚀

