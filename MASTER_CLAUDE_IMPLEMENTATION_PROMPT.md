# MASTER CLAUDE IMPLEMENTATION PROMPT: AUTHORIZON (PayPal AI Hackathon 2026)

Copy and paste the entire prompt below into Claude Opus 4.6 (Thinking) or Claude Sonnet:

***

```markdown
# MISSION BRIEF: AUTHORIZON — PRODUCTION-GRADE IMPLEMENTATION BLUEPRINT & CODE
## PayPal AI Hackathon 2026 — Senior Staff Fintech Architect & Lead Implementer

### 1. CONTEXT, RULES & OUTCOME TARGETS
- **Event:** PayPal AI Hackathon 2026 (Devpost: https://paypalaihackathon.devpost.com/)
- **Target Outcome:** 1st Place Grand Prize ($12,000) OR Best Use of PayPal + AI ($5,000) + 1st Place AG Grid / AG Studio Sponsor Prize ($5,000).
- **Rule Constraints:** Max one Sponsor Prize plus one Main Track Prize per team. Real PayPal Sandbox transactions must execute live on screen in the 3-minute video. Public open-source GitHub repository.
- **Problem Statement (LOCKED):** AuthHorizon builds the missing operational and legal compliance bridge between unformatted supplier delay notices, customer consent (Wait, Swap, Cancel), and PayPal's native authorization-and-capture split-shipment lifecycle (`intent: "AUTHORIZE"` -> partial capture for in-stock goods -> held balance resolution).

---

### 2. ARCHITECTURAL LATITUDE & OPTIMIZATION AUTHORITY ("FREE HAND")
You are given **full architectural latitude to refactor, upgrade, and optimize** any part of the implementation proposed by previous agents to ensure this project achieves top-tier, world-class hackathon quality:
- **Feel free to improve:** The database schemas, state machine transitions, error recovery mechanisms, webhook handling, frontend UI layout, AG Studio widgets, and prompt engineering templates wherever you spot an opportunity for greater elegance, robustness, or visual punch.
- **Elevation Mandate:** We are competing at an international level against top developers worldwide. Do not write a toy prototype. Write clean, production-grade, distributed-systems-aware code (idempotency headers, strict validation, cryptographic consent hashing, resilient webhook reconciliation, and polished UI).
- **The Only Two Non-Negotiables:**
  1. **Core Concept Preserved:** Do not pivot the problem statement away from AuthHorizon (multi-item order, split-shipment capture, AI notice parser, buyer consent, deterministic payment execution).
  2. **Non-Negotiable Financial Safety Gate:** AI NEVER moves, calculates, or authorizes money. AI parses messy/multilingual notices and drafts customer-facing explanations. Deterministic code moves every single cent.

---

### 3. THE EVALUATION DIMENSIONS (TARGETING 20/20 IN ALL FIVE)
1. **Technological Implementation (20%):** Idempotent PayPal capture calls (`PayPal-Request-Id`), robust webhook signature verification (`verify-webhook-signature`), resilient state transitions, Pydantic type safety, and clean SQLite ledger persistence.
2. **Design & UX (20%):** Dual-surface interface:
   - **Merchant Command Center:** AG Studio (`ag-studio-react`) displaying a dynamic **Hold Bar** that visibly splits from a single $90 bar into $60 Green (Captured) and $30 Amber (Held) upon verified webhook callbacks.
   - **Buyer Consent Portal:** Frictionless, mobile-responsive consent card offering three clear choices (Wait, Swap to equal/lesser item, Cancel).
3. **Potential Impact (20%):** Solves real FTC 16 CFR Part 435 shipping delay requirements and EU/Danish partial capture compliance where merchants cannot charge before shipping.
4. **Innovation (20%):** Bridges the messy real-world gap between unstructured B2B supply chain communication and deterministic, auditable consumer payments.
5. **Presentation (20%):** A second-by-second 3-minute video screenplay designed for immediate, visceral visual impact.

---

### 4. REQUIRED OUTPUTS (PROVIDE IN COMPLETE, EXECUTABLE DETAIL)

#### MODULE A: The Live Sandbox Gate Spike (`scripts/test_auth_gate.py`)
- Walk through the exact step-by-step verification protocol for:
  - **S1:** Order creation ($90, `intent: "AUTHORIZE"`, 2 line items: $60 in-stock, $30 delayed).
  - **S2:** Partial capture ($60, `final_capture: false`) with unique `PayPal-Request-Id`.
  - **S4:** Idempotency verification and second capture ($30, `final_capture: true`).
  - **S5:** Testing `POST /v2/payments/authorizations/{id}/void` on a `PARTIALLY_CAPTURED` authorization vs fallback auto-release.
- Document exact expected response structures, HTTP status codes, and failure-handling branches.

#### MODULE B: Complete Data Model & SQLite Schema
Define the complete SQLAlchemy models and Pydantic schemas for:
- `Order` (`paypal_order_id`, `auth_id`, `total_amount`, `currency`, `status`, `created_at`)
- `LineItem` (`id`, `order_id`, `sku`, `name`, `amount`, `status`: `IN_STOCK` | `DELAYED` | `SWAPPED` | `CANCELLED`)
- `DelayNotice` (`id`, `order_id`, `raw_text`, `language`, `extracted_sku`, `new_ship_date`, `reason`, `confidence_score`, `status`: `PENDING_REVIEW` | `APPROVED`)
- `BuyerConsent` (`id`, `order_id`, `choice`: `WAIT` | `SWAP` | `CANCEL`, `swapped_sku`, `timestamp`, `consent_hash`)
- `CaptureAudit` (`id`, `order_id`, `paypal_capture_id`, `amount`, `final_capture`, `request_id`, `webhook_verified`)

#### MODULE C: AI Cognitive Boundary & Validation Engine
- The exact prompt engineering template for Claude 3.5 Sonnet to ingest messy/multilingual supplier emails (provide 3 realistic test fixtures: German, Danish, English).
- The strict Pydantic parsing schema requiring confidence levels (`HIGH`, `MED`, `LOW`) per extracted field.
- The deterministic Python validation gate that rejects any prompt output containing currency symbols or amounts, and routes any non-HIGH confidence to a merchant review queue.

#### MODULE D: Backend API Routes (FastAPI)
Provide the full, production-ready code for:
- `POST /api/orders/create` (generates sandbox order with `AUTHORIZE` intent)
- `POST /api/orders/{id}/authorize` (locks authorization)
- `POST /api/orders/{id}/ship-partial` (executes $60 capture, `final_capture: false`)
- `POST /api/supplier/parse-notice` (runs AI extraction + deterministic validation)
- `POST /api/consent/submit` (processes buyer choice: Wait, Swap, or Cancel)
- `POST /api/webhooks/paypal` (verifies signature via `/v1/notifications/verify-webhook-signature` and updates AG Studio ledger)

#### MODULE E: Frontend & AG Studio ($5,000 Sponsor Prize Play)
- The React + Vite setup importing `ag-studio-react`, `@ag-grid-community/core`, and `AgStudioAiModule`.
- The exact code for the **Split Hold Bar** component that transforms visually when the webhook confirms the $60 partial capture.
- The `createAiHarness` configuration wiring the AG Studio Agent Framework to allow natural-language merchant queries across live orders (e.g. *"Show all orders with held funds older than 15 days"*).
- The Buyer Consent Card UI component with clear visual breakdown of what has been charged vs held.

#### MODULE F: 3-Minute Video Demo Screenplay
Provide a second-by-second timestamped table (0:00 to 2:50):
- The Cold Open Hook (0:00–0:25)
- The Live Sandbox Order & Split-Capture Trigger (0:25–1:00)
- The AI Notice Parser & Buyer Consent Action (1:00–1:45)
- The AG Studio Visual Climax & Audit Ledger (1:45–2:20)
- The Closing Engineering Defense (2:20–2:50)

Be direct, complete, and write production-grade code that can be immediately saved and executed.
```

***

