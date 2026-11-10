# AuthHorizon — PayPal AI Hackathon 2026
**STATUS:** LOCKED. Final. Do not propose alternative problem statements.  
**Submission Deadline:** November 12, 2026 @ 12:00 PM PT (Nov 13, 1:30 AM IST).  
**Self-Imposed Target:** November 12, 2026 @ 8:00 PM IST.

---

## 1. Executive Summary & Problem Statement
When a multi-item e-commerce order is placed and one item is backordered or delayed by a supplier, merchants face a bad dilemma:
1. Wait for everything and delay fulfillment of in-stock items (ruins customer experience).
2. Cancel the whole order (loses revenue).
3. Charge the entire amount upfront before shipping (violates FTC 16 CFR Part 435 mail/internet order rules and Danish/EU merchant laws).

While PayPal natively supports `intent: "AUTHORIZE"` and multiple partial captures for split shipments, **no system connects unstructured supplier delay notices to legally compliant buyer choices and deterministic payment execution with an auditable ledger.**

**AuthHorizon builds that missing layer.**

---

## 2. Core Architecture & Strict Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTHORIZON ARCHITECTURE                           │
│                                                                             │
│   [Messy Supplier Notice] (Email / PDF / Multilingual)                      │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │ AI PARSER (Claude 3.5 Sonnet)                               │           │
│   │ • Extracts: SKU, new estimated ship date, delay reason      │           │
│   │ • Computes confidence scores: HIGH / MED / LOW              │           │
│   │ • STRICT BOUNDARY: Never outputs prices, never calls APIs   │           │
│   └─────────────────────────────────────────────────────────────┘           │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │ DETERMINISTIC VALIDATOR (Python)                            │           │
│   │ • Validates SKU exists in order catalog                     │           │
│   │ • Checks date is within 29-day PayPal authorization window  │           │
│   │ • Enforces Human Review Queue if confidence < HIGH          │           │
│   └─────────────────────────────────────────────────────────────┘           │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │ BUYER CONSENT PORTAL (React + Tailwind)                     │           │
│   │ Three immutable options:                                    │           │
│   │ 1. WAIT: Keep hold active until new ship date               │           │
│   │ 2. SWAP: Select in-stock replacement (capped at <= $30)     │           │
│   │ 3. CANCEL: Release $30 hold immediately (void / auto-close) │           │
│   └─────────────────────────────────────────────────────────────┘           │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │ DETERMINISTIC MONEY ENGINE & PAYPAL SANDBOX                 │           │
│   │ • POST /v2/checkout/orders (intent=AUTHORIZE, $90.00)       │           │
│   │ • POST /v2/checkout/orders/{id}/authorize                   │           │
│   │ • In-Stock Capture: $60.00 (final_capture: false)           │           │
│   │ • Delayed Resolution: $30.00 (final_capture: true) or VOID  │           │
│   │ • Webhook Verification: verify-webhook-signature            │           │
│   └─────────────────────────────────────────────────────────────┘           │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │ AG STUDIO AUDIT LEDGER (ag-studio-react + createAiHarness)  │           │
│   │ • Live Hold Bar: $90 solid -> Splits to $60 Green / $30 Amber│          │
│   │ • Immutable Buyer Consent Log with cryptographically bound  │           │
│   │   timestamps and PayPal transaction IDs                     │           │
│   │ • Studio Agent Framework: NL queries across active holds    │           │
│   └─────────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. PayPal REST API Flow (Exact Endpoints & States)

1. **Order Creation:**
   `POST /v2/checkout/orders`
   `{ "intent": "AUTHORIZE", "purchase_units": [{ "amount": { "value": "90.00" }, "items": [Item A&B ($60), Item C ($30)] }] }`
   `Header: PayPal-Request-Id: <uuid>`

2. **Buyer Approval:**
   Buyer approves in PayPal Sandbox Modal.

3. **Order Authorization:**
   `POST /v2/checkout/orders/{id}/authorize`
   Returns `authorization_id`, status `CREATED`.

4. **In-Stock Fulfillment (Split Capture):**
   `POST /v2/payments/authorizations/{auth_id}/capture`
   `{ "amount": { "value": "60.00", "currency_code": "USD" }, "final_capture": false }`
   `Header: PayPal-Request-Id: <uuid>`
   Authorization transitions to `PARTIALLY_CAPTURED`.

5. **Delayed Item Resolution:**
   - **WAIT:** Capture $30.00 upon fulfillment (`final_capture: true`).
   - **SWAP:** Capture swapped item value (capped at <= $30.00, `final_capture: true`).
   - **CANCEL:** Void authorization `POST /v2/payments/authorizations/{auth_id}/void` (or auto-release remainder).

6. **Webhook Signature Verification:**
   `POST /v1/notifications/verify-webhook-signature` on `PAYMENT.CAPTURE.COMPLETED`.

---

## 4. AG Studio ($5,000 Sponsor Target)
- Package: `ag-studio-react`, `@ag-grid-community/core`.
- Modules: `AgStudioAiModule`, `createAiHarness`.
- Hero Visual: Split hold bar that dynamically transforms from a single $90 bar into a split $60 (Captured) / $30 (Held) bar upon verified webhook event.
- Studio Agent Framework: Natural Language query answering: *"Which authorizations are older than 20 days and require re-consent or fulfillment action?"*

