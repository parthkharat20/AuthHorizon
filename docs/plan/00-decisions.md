# 00-DECISIONS.MD — FROZEN ARCHITECTURAL DECISIONS & REPO STRUCTURE
## AuthHorizon — PayPal AI Hackathon 2026
**Frozen on:** 2026-11-09 @ 18:55 IST  
**Status:** FROZEN. No changes without explicit approval.

---

## 1. Frozen Decisions Log

| Decision ID | Area | Decision | Justification | Tag |
|---|---|---|---|---|
| **DEC-01** | Problem Scope | B2B supplier delay notice parsing -> Buyer consent (Wait/Swap/Cancel) -> PayPal split-capture execution | Fills an open niche in e-commerce fulfillment and consumer delay notifications; generic auth/hold escrow is crowded [doc]. | [doc] |
| **DEC-02** | Financial Safety Gate | AI never calculates, touches, or moves money. AI extracts unstructured text and outputs structured fields with confidence. Code fills amounts and dates. | Eliminates prompt-injection financial exploits and hallucinated balance movements. | [rule] |
| **DEC-03** | Void & Cancel Lifecycle | Cancel path executes `POST /v2/payments/authorizations/{parent_auth_id}/void` on uncaptured balance. If Spike 2 sandbox fails, execute Fallback 1 ($0.01 final capture) then Fallback 2 ($30 final capture + instant refund). | Voiding uncaptured balance after `final_capture=false` is documented by PayPal [doc]. Spike 2 serves as empirical proof. | [doc]/[test] |
| **DEC-04** | Reauthorization Rule | If an authorization is reauthorized, the new authorization ID is linked as child, and void actions must target the original parent authorization. | Avoids `AUTHORIZATION_CANNOT_BE_VOIDED` edge cases. | [doc] |
| **DEC-05** | Reconciler Pattern | Never trust PayPal HTTP 200/201 responses alone. After every mutating payment call, immediately invoke `GET /v2/payments/authorizations/{id}` or `GET /v2/payments/captures/{id}` to verify actual ledger balance on PayPal before updating internal state. | Protects against documented PayPal community anomalies where capture returns success without moving balance. | [doc]/[test] |
| **DEC-06** | LLM Provider Strategy | Provider-agnostic OpenAI-compatible interface supporting Google AI Studio (Gemini 2.5/3.x Flash) and Groq (Llama 3.3 70B / Qwen 2.5). Primary chosen via 20-notice eval set (English, German, Danish + adversarial). | Zero paid API keys required. Ensures resilience against free-tier rate limits. | [doc] |
| **DEC-07** | Tamper-Evident Consent | SHA-256 hash chain over canonical JSON payload (`displayed_text`, `choice`, `timestamp`, `prev_hash`). Termed strictly "tamper-evident", never "legally admissible". | Provides cryptographic non-repudiation while avoiding dishonest legal claims. | [rule] |
| **DEC-08** | Frontend & UI Scope | React 18 + Vite + Tailwind CSS + AG Grid Community. Custom animated Split Hold Bar ($90 solid -> $60 green / $30 amber). AG Studio is optional/stretch only. | Guarantees delivery within 45h without risking enterprise license blockers. | [doc] |
| **DEC-09** | Deployment & Webhooks | Local dev via ngrok tunnel. Production deployment on Render Web Service ($50 credits). | Meets public HTTPS webhook verification requirements (`verify-webhook-signature`). | [doc] |

---

## 2. Pinned Repository Tree & File Inventory

```
Pay-Pal Hackathon/
├── .env.example                       # Environment variables template
├── .env                               # Local secrets (gitignored)
├── README.md                          # Public repo overview, architecture, demo video link
├── render.yaml                        # Render Blueprint for automated deployment
├── backend/
│   ├── requirements.txt               # Pinned Python dependencies
│   ├── main.py                        # FastAPI entrypoint & router mounts
│   ├── config.py                      # Pydantic Settings (env loader)
│   ├── models.py                      # SQLAlchemy ORM models & Pydantic validation schemas
│   ├── database.py                    # SQLite engine, sessionmaker, WAL mode setup
│   ├── reconciler.py                  # Independent balance & state verifier (GET before commit)
│   ├── gateway/
│   │   ├── base.py                    # Abstract Gateway Interface (Order, Auth, Capture, Void)
│   │   ├── paypal_gateway.py          # Real PayPal REST API v2 implementation
│   │   └── mock_gateway.py            # Deterministic Mock Gateway (simulates success & edge failures)
│   ├── ai/
│   │   ├── client.py                  # Provider-agnostic LLM client (AI Studio / Groq)
│   │   ├── prompts.py                 # System & extraction prompt templates
│   │   ├── validator.py               # Deterministic parsing gate (regex, symbols, confidence)
│   │   └── eval_suite.py              # 20-notice automated evaluation runner
│   ├── routes/
│   │   ├── orders.py                  # Order creation & authorization endpoints
│   │   ├── fulfillment.py             # Split capture & shipping triggers
│   │   ├── notices.py                 # Supplier notice parsing & review queue
│   │   ├── consent.py                 # Buyer consent submission & hash chaining
│   │   └── webhooks.py                # PayPal signature verification & event ingestion
│   └── tests/
│       ├── test_mock_flow.py          # Full end-to-end lifecycle on Mock Gateway
│       ├── test_reconciler.py         # Tests for balance discrepancy detection
│       ├── test_ai_validator.py       # Adversarial prompt-injection & currency symbol rejection tests
│       └── fixtures/
│           ├── notices_20.json        # 20 multilingual & adversarial notice fixtures
│           └── sample_webhooks.json   # PayPal webhook event mocks
├── frontend/
│   ├── package.json                   # Pinned Node dependencies
│   ├── vite.config.ts                 # Vite setup with /api proxy
│   ├── tsconfig.json                  # TypeScript configuration
│   ├── index.html                     # SPA entrypoint
│   └── src/
│       ├── main.tsx                   # React bootstrap
│       ├── App.tsx                    # React Router configuration
│       ├── index.css                  # Tailwind styles & keyframe animations
│       ├── types.ts                   # TypeScript interfaces matching backend models
│       ├── api.ts                     # Axios client with status polling fallback
│       ├── components/
│       │   ├── SplitHoldBar.tsx       # HERO VISUAL: Animated $90 -> $60 green / $30 amber bar
│       │   ├── OrdersGrid.tsx         # AG Grid Community interactive ledger
│       │   ├── NoticeParserCard.tsx   # Supplier notice input, confidence tags, review flag
│       │   ├── ConsentChoiceCard.tsx  # Buyer Wait/Swap/Cancel visual cards
│       │   ├── AuditTimeline.tsx      # Hash-chained tamper-evident ledger view
│       │   └── StatusBadge.tsx        # Color-coded status indicator
│       └── pages/
│           ├── MerchantDashboard.tsx  # Merchant Command Center
│           └── BuyerConsentPortal.tsx # Frictionless consumer mobile-ready portal
├── scripts/
│   ├── test_auth_gate.py              # Sandbox Verification Spike script (S1-S5)
│   ├── seed_demo_data.py              # Pre-loads demo order & notices for instant reset
│   └── run_eval.py                    # CLI runner for the 20-notice AI benchmark
└── docs/
    └── plan/
        ├── pass0-decision-memo.md     # Approved research findings & decision memo
        ├── 00-decisions.md            # Frozen decisions, tree, env, versions, commands
        ├── 01-contracts.md            # State machine, DB schemas, API specs, gateway mock
        ├── 02-ai-boundary.md          # Prompts, schemas, validation gate, 20-notice eval
        ├── 03-ui-spec.md              # Split Hold Bar mechanics, AG Grid, Consent Portal
        ├── 04-demo-script.md          # Second-by-second 2:50 demo video script
        ├── 05-execution-plan.md       # Task cards & dependency roadmap
        └── 06-agent-rules.md          # Rules for the Antigravity coding agent
```

---

## 3. Pinned Dependency Versions

### Backend (`backend/requirements.txt`)
```text
fastapi==0.115.0
uvicorn[standard]==0.31.0
pydantic==2.9.2
pydantic-settings==2.5.2
sqlalchemy==2.0.35
requests==2.32.3
cryptography==43.0.1
python-dotenv==1.0.1
python-multipart==0.0.12
pytest==8.3.3
httpx==0.27.2
```

### Frontend (`frontend/package.json`)
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "axios": "^1.7.7",
    "ag-grid-react": "^32.2.0",
    "ag-grid-community": "^32.2.0",
    "lucide-react": "^0.446.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.10",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2",
    "vite": "^5.4.8"
  }
}
```

---

## 4. Environment Variables Specification (`.env.example`)

```bash
# -------------------------------------------------------------
# PAYPAL SANDBOX CREDENTIALS (developer.paypal.com)
# -------------------------------------------------------------
PAYPAL_CLIENT_ID=your_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret_here
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
PAYPAL_WEBHOOK_ID=your_registered_webhook_id_here

# -------------------------------------------------------------
# FREE-TIER LLM KEYS (Provider-Agnostic Interface)
# -------------------------------------------------------------
# Primary: Google AI Studio (aistudio.google.com - Free, No CC)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Fallback: Groq (console.groq.com - Free, Permanent)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Active LLM Selection ("gemini" | "groq" | "mock")
ACTIVE_LLM_PROVIDER=gemini

# -------------------------------------------------------------
# APPLICATION CONFIGURATION
# -------------------------------------------------------------
PORT=8000
FRONTEND_URL=http://localhost:5173
DATABASE_URL=sqlite:///./authhorizon.db
USE_MOCK_PAYPAL=false
LOG_LEVEL=INFO
```

---

## 5. Verified Run & Test Commands

### 1. Initial Environment Bootstrap
```bash
# In project root:
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

cd frontend
npm install
cd ..
```

### 2. Run Test Suite (Mock Gateway & Validator)
```bash
# Run all unit tests with zero external API calls:
pytest backend/tests/ -v
```

### 3. Run AI 20-Notice Benchmark Eval
```bash
# Evaluates accuracy across German, Danish, English, and injection notices:
python scripts/run_eval.py --provider=gemini
```

### 4. Run Sandbox Spike G0 (Empirical Sandbox Proof)
```bash
# Requires real PayPal sandbox credentials in .env:
python scripts/test_auth_gate.py
```

### 5. Start Development Servers
```bash
# Terminal 1 (Backend):
source venv/bin/activate
uvicorn backend.main:app --reload --port 8000

# Terminal 2 (Frontend):
cd frontend
npm run dev

# Terminal 3 (Local Webhook Tunnel):
ngrok http 8000
```

