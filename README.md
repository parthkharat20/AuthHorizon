# AuthHorizon

> **Split-Shipment Intelligence & Consumer Consent Engine** — Production-grade payment orchestration connecting multilingual supplier delay notices with PayPal REST API v2 authorization-and-capture lifecycles and cryptographic consumer consent logs.

[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PayPal](https://img.shields.io/badge/PayPal-REST%20v2-003087?style=flat&logo=paypal&logoColor=white)](https://developer.paypal.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![AG Grid](https://img.shields.io/badge/AG%20Grid-33.2-0070e0?style=flat)](https://www.ag-grid.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Overview

When a multi-item e-commerce order contains items with staggered availability or unexpected supplier backorders, merchants face a difficult trade-off:

1. **Charge upfront for unshipped items:** Exposes the business to chargebacks, customer disputes, and regulatory scrutiny under consumer protection standards (e.g., FTC 16 CFR Part 435 delay-option requirements).
2. **Cancel the entire order:** Sacrifices immediate revenue and damages customer loyalty.
3. **Hold all items until complete:** Delays delivery of in-stock items, degrading the consumer experience.

**AuthHorizon** provides the automated operational bridge:
* Authorizes the full order total upfront (`intent: "AUTHORIZE"`).
* Partials out and captures payment only for items that physically ship (`final_capture: false`).
* Automatically ingests unstructured, multilingual supplier delay notifications (German, Danish, English) using LLM extraction bounded by a deterministic financial safety gate.
* Generates an interactive self-service Consumer Consent Portal where the buyer chooses to **Wait**, **Swap** for an in-stock alternative, or **Cancel** with immediate release of held funds.
* Maintains a tamper-evident, SHA-256 chained cryptographic audit trail for compliance and dispute prevention.

---

## Architectural Principles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AuthHorizon System Architecture                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [Supplier Email (DE/DA/EN)]                                               │
│              │                                                              │
│              ▼                                                              │
│   [AI Intelligence Layer]  ──> Gemini Flash / Groq (Structured Extract Only)│
│              │                                                              │
│              ▼                                                              │
│   [Deterministic Safety Gate]  ──> Rejects currency/prices; Grounding check  │
│              │                                                              │
│              ▼                                                              │
│   [Consumer Consent Portal]   ──> Buyer chooses: WAIT | SWAP | CANCEL       │
│              │                                                              │
│              ▼                                                              │
│   [PayPal REST v2 Gateway]    ──> Authorize ──> Split Capture ──> Void/Final│
│              │                                                              │
│              ▼                                                              │
│   [Post-Action Reconciler]    ──> Live GET balance checks; Ghost-guard      │
│              │                                                              │
│              ▼                                                              │
│   [Cryptographic Audit Log]   ──> SHA-256 chained tamper-evident ledger     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Financial Safety Gate
* **AI Never Moves Money:** The LLM is strictly an untrusted text parser and localized message drafter. It never calculates amounts, never outputs prices, and never authorizes transactions.
* **Deterministic Guardrails:**
  - Code strictly validates that only `new_ship_date` may contain digits.
  - Reason fields reject digits, URLs, and currency words across supported locales.
  - Model confidence scores are treated as advisory; auto-approval requires verifiable grounding against source text.
  - All ledger amounts, capture values, and PayPal payload amounts are computed solely by deterministic Python code using database line-item amounts.

---

## State Machine

```
[Buyer Places $90 Order (3 items @ $30)]
               │
               ▼
[POST /v2/checkout/orders: intent=AUTHORIZE]  ──> Status: CREATED
               │
               ▼
[Buyer Approves via PayPal Sandbox/Checkout]
               │
               ▼
[POST /v2/checkout/orders/{id}/authorize]     ──> Status: AUTHORIZED ($90 Held, $0 Captured)
               │
               ▼
[Fulfill In-Stock Items (Items A & B = $60)]
[POST /v2/payments/authorizations/{auth_id}/capture]
 (amount: $60.00, final_capture: false)       ──> Status: PARTIALLY_CAPTURED ($60 Captured, $30 Held)
               │
               ▼
[Supplier Sends Delay Notice for Item C]
               │
               ▼
[AI Notice Parser + Safety Gate]              ──> Item C marked DELAYED; Consent Notice Generated
               │
               ▼
[Buyer Opens Consent Portal (/consent/{id})]
               │
  ┌────────────┼─────────────┐
  ▼            ▼             ▼
[WAIT]       [SWAP]       [CANCEL]
  │            │             │
  │            │             └─► [POST /v2/payments/authorizations/{parent_auth_id}/void]
  │            │                 Status: VOIDED ($60 Captured, $0 Held; $30 Hold Released Immediately)
  │            │
  │            └─► [Capture Replacement Price <= $30 with final_capture: true]
  │                Status: COMPLETED ($60 + $Swap Captured, $0 Held)
  │
  └─► [Hold Maintained until Item C arrives]
      └─► [POST /v2/payments/authorizations/{auth_id}/capture]
          (amount: $30.00, final_capture: true)
          Status: COMPLETED ($90 Captured, $0 Held)
```

---

## Technology Stack

| Component | Technology | Version | Description |
|:---|:---|:---|:---|
| **Backend Framework** | FastAPI | `0.115+` | High-performance asynchronous REST API |
| **Language Runtime** | Python | `3.13` | Core business logic & financial safety gates |
| **ORM & Database** | SQLAlchemy | `2.0+` | SQLite persistence with Write-Ahead Logging (WAL) |
| **Payments Gateway** | PayPal REST API v2 | Sandbox / Live | Orders v2, Authorizations, Captures, Webhooks |
| **AI Parsing** | Google Gemini / Groq | Flash / Llama 3.3 | Multilingual supplier notice extraction |
| **Frontend Framework** | React | `18.3` | Dual-surface UI (Merchant & Consumer) |
| **Build System** | Vite | `6.4` | Production bundling and SPA routing |
| **Styling** | Tailwind CSS | `4.0` | Responsive layout, dark mode, split-hold visualizer |
| **Data Ledger** | AG Grid Community | `33.2` | Interactive transaction ledger & audit inspection |

---

## Quick Start

### 1. Prerequisites
- Python `3.12+`
- Node.js `18+`
- A [PayPal Developer](https://developer.paypal.com/) account with sandbox credentials
- Google Gemini API Key (or Groq API key)

### 2. Installation

```bash
# Clone repository
git clone https://github.com/parthkharat20/AuthHorizon.git
cd AuthHorizon

# Configure environment
cp .env.example .env
# Edit .env and supply your PayPal Client ID, Secret, and Gemini API key

# Set up Python virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Build frontend production assets
cd frontend
npm install
npm run build
cd ..
```

### 3. Run Application

```bash
# Start unified application server (FastAPI serves both API and React SPA)
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Access the application in your browser:
* **Merchant Command Center:** [http://localhost:8000](http://localhost:8000)
* **API Documentation (Swagger UI):** [http://localhost:8000/docs](http://localhost:8000/docs)
* **System Healthcheck:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## Test Suite

```bash
# Run unit and integration tests
pytest backend/tests/ -v
```

---

## Regulatory & Legal Background (Not Legal Advice)

* **FTC Mail, Internet, or Telephone Order Merchandise Rule (16 CFR Part 435):** Requires sellers who cannot ship within stated timeframes (or 30 days) to offer consumers a clear choice to consent to the delay or cancel with a prompt refund. AuthHorizon helps automate the required notice and capture only what physically ships; it does not claim to certify legal compliance.
* **Dispute Mitigation:** By maintaining verifiable, SHA-256 hashed evidence of consumer consent prior to executing final settlement or release, merchants retain clear audit trails for chargeback defense and seller protection.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
