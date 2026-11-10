# PROMPT: Architecture & System Review for "AuthHorizon" (PayPal AI Hackathon 2026)

## 1. Role & Review Objective
You are a Principal Payments Architect, Distributed Systems Engineer, and Hackathon Judge. 
Review the technical implementation, architecture, financial safety boundaries, and PayPal REST v2 mechanics of **AuthHorizon**, an entry for the **PayPal AI Hackathon 2026** (Devpost).

Your objective:
1. Conduct a rigorous architectural critique of the end-to-end flow.
2. Identify latent failure modes, edge cases, or race conditions in the PayPal authorization/capture lifecycle.
3. Suggest high-impact optimizations, refinements, or demo enhancements that will maximize the score across the hackathon’s 5 judging criteria: **Technological Implementation, Design, Potential Impact, Innovation, and Presentation**.

---

## 2. Problem Statement & Regulatory Context
Background (not legal advice): the FTC Mail, Internet or Telephone Order Rule (16 CFR 435) requires a seller who cannot ship on time to send a delay-option notice: consent to the delay, or cancel with a prompt refund. It does NOT ban pre-shipment charges. EU Consumer Rights Directive Art. 18 details are unverified; background only. AuthHorizon helps send the notice and capture only what ships; it does not guarantee compliance. Dispute tools elsewhere fight disputes after they happen; AuthHorizon prevents them.

**The AuthHorizon Solution:** A split-shipment fulfillment and consumer consent engine powered by PayPal REST API v2 and LLM notice intelligence.
- Multi-item orders are authorized up front (`intent: "AUTHORIZE"`).
- In-stock items are partially captured (`final_capture: false`).
- Unstructured, multilingual supplier delay notices (German, Danish, English) are ingested via AI.
- Buyers make consent choices (Wait, Swap, or Cancel) on a self-service portal.
- Deterministic Python code moves money via PayPal; cryptographic SHA-256 logs provide a tamper-evident audit trail.

---

## 3. Non-Negotiable Financial Safety Boundary (Hard Rule)
* **AI Never Moves Money:** The LLM is strictly treated as an untrusted parser and template drafter. The LLM **NEVER** calculates, outputs, or authorizes financial amounts.
* **Deterministic Guardrails:**
- Gate (T2, being built): only new_ship_date may contain digits; reason has no digits or URLs; NFKC-normalize first; per-language currency and number words rejected; model confidence is advisory only (an injected notice can claim HIGH).
- Auto-approval needs grounding: the item identifier and date literal must appear in the source notice and match exactly one order item and one parsed date. Otherwise, review queue.

---

## 4. Current Context, Status & Review Constraints
STATUS: T0 passed (Section 6). Do not re-litigate it. Tag every claim [doc], [test] or [assumed].
CONSTRAINTS: about 55 hours left, code freeze 2 PM IST Nov 12, solo dev plus a Gemini coding agent, free-tier LLMs, no new products. Each suggestion must fit in 3 hours or less.
CROWDED LANES (do not suggest): agent spend guardrails or mandates, escrow with AI verification, dispute-response bots, shopping agents, analytics dashboards, invoicing bots.
WEAK SPOTS TO ATTACK: reauth is mock-tested only; the Wait path near the 29-day limit; webhooks not yet verified on a public URL; consent-link authentication.

---

## 5. End-to-End Economic Lifecycle & State Machine

```
[Buyer Places $90 Order (3 items @ $30)]
               │
               ▼
[POST /v2/checkout/orders: intent=AUTHORIZE]  ──> Status: CREATED
               │
               ▼
[Buyer Approves in PayPal Sandbox Modal]
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
[Supplier Sends Messy Delay Notice for Item C]
               │
               ▼
[Gemini AI Notice Parser + Safety Gate]      ──> Item C marked DELAYED; Buyer Consent Notice Generated
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

## 6. Empirical Proof: Live PayPal Sandbox Verification (T0 Gate PASSED)
All core mechanics were empirically executed and verified against live PayPal Sandbox endpoints using direct `GET` calls (not trusting HTTP 200/201 alone):

1. **Split-Capture Complete (Flow A):** [test]
   - Order Authorized: `$90.00` (`2132789866529943B`).
   - Capture 1 (`final_capture: false`): `$60.00` (`6JB39681DC958371Y`) $\to$ `COMPLETED` (Net: `$56.88`).
   - Capture 2 (`final_capture: true`): `$30.00` (`97390105YS302941V`) $\to$ `COMPLETED` (Net: `$28.27`).
   - GET Authorizations verifies parent status transitioned to `CAPTURED`.
2. **Partial Capture Void (Flow B):** [test]
   - Order Authorized: `$90.00` (`57R12845DM4340219`).
   - Capture 1 (`final_capture: false`): `$60.00` (`0F700432WT2548611`) $\to$ `COMPLETED`.
   - Void Call: `POST /v2/payments/authorizations/57R12845DM4340219/void` returned HTTP `204`.
   - GET Authorizations verifies parent status is `VOIDED`!
   - **Key Finding:** [doc] [test] Voiding the parent authorization *after* a partial capture is explicitly allowed by PayPal and immediately frees the remaining hold balance for the buyer.
3. **Double-Capture Guard:** [test] Attempting another capture after `final_capture: true` returned HTTP `422 UNPROCESSABLE_ENTITY` (`AUTHORIZATION_ALREADY_CAPTURED`).
4. **Idempotency Replay:** [test] Replaying the identical `PayPal-Request-Id` returned HTTP `200` with the exact same Capture ID and caused **zero duplicate charges**.
5. **Cross-Border Sandbox Learning:** [test] Indian Business Sandbox accounts (`Country: IN`) reject domestic INR and USD transactions from Indian Personal accounts (`UNSUPPORTED_PAYEE_CURRENCY` due to RBI regulations). The Sandbox Buyer account must be US-based (`Country: US`) to process cross-border USD payments properly.

---

## 7. Key Architecture Patterns Implemented

### Pattern 1: Post-Action Reconciler (`backend/reconciler.py`)
To prevent ghost captures or desynchronized state, every state-mutating gateway call is immediately followed by a read verification:
- After partial capture: queries `GET /v2/payments/authorizations/{id}` to verify that `status == "PARTIALLY_CAPTURED"` and remaining hold equals `total - captured`.
- After void: queries `GET /v2/payments/authorizations/{id}` to verify `status == "VOIDED"`.
- If a discrepancy is detected, the reconciler flags a `MISMATCH` event and halts automatic progression.

### Pattern 2: Cryptographic Tamper-Evident Consent Ledger (`backend/models.py`)
Each buyer consent record is hashed using SHA-256:
$$\text{hash} = \text{SHA256}(\text{order\_id} \parallel \text{choice} \parallel \text{displayed\_text} \parallel \text{timestamp\_utc} \parallel \text{prev\_hash})$$
The chain head is queryable via `/api/orders/{id}/evidence`, allowing third-party auditors or compliance officers to prove that the exact text shown to the consumer was consented to prior to moving money.

---

## 8. Immediate Implementation Roadmap
* **T0 (PASSED):** Empirical PayPal Sandbox verification spike.
* **T1 (IN PROGRESS):** Full end-to-end execution through the React UI on live sandbox.
* **T2:** Enhanced unicode character filtering (`unicodedata` categories `Nd`/`Sc` rejection) and per-language currency word filtering (`dollars`, `euro`, `kroner`, `yen`). Zero-gateway-call spy tests for prompt injections.
* **T3:** Multi-LLM provider fallback chain (Gemini Flash $\to$ Groq Llama 3.3 70B $\to$ deterministic cached fixture) with visible UI badges (`LIVE AI`, `CACHED`, `MOCK`).
* **T4:** Cross-border buyer localization (e.g., German supplier notice $\to$ English extraction $\to$ Japanese buyer consent message with code-injected `{ITEM}`, `{DATE}`, `{AMOUNT}` placeholders).
* **T5:** Canonical JSON export of cryptographic consent evidence + live PayPal GET reconciliation proofs.
* **T6:** Live event log and visual idempotency proof in the UI.
* **T7:** Automated evaluation suite on 20 multilingual/adversarial notices.
* **T8:** Render cloud deployment with webhook signature verification.
* **T9:** Open-source repository hygiene, MIT license, and accurate compliance claims framing ("supports compliance" rather than "guarantees compliance").

---

## 9. Specific Review Questions for the Reviewer
Remember constraints: **<3 hours per suggestion, solo dev + Gemini coding agent, no new products, no crowded lanes**.

1. **Weak Spot Attack — 29-Day Wait Path & Reauth:**
   - How should we address the 29-day authorization expiration window if the buyer consents to Wait? What is the simplest, most robust implementation to simulate or handle this cleanly in a hackathon demo?
2. **Weak Spot Attack — Consent-Link Authentication:**
   - Currently `/consent/:orderId` relies on the order ID. What is the most lightweight, 30-minute security enhancement (e.g. signed HMAC token in URL `?sig=...`) to prevent guessing order IDs?
3. **Weak Spot Attack — Webhook Sequencing:**
   - Since Render deployment (T8) will introduce live webhooks, what is the cleanest pattern to ensure out-of-order webhook delivery doesn't overwrite a verified synchronous Reconciler state?
4. **Hackathon Winning Edge & Demo Optimization:**
   - How can the UI/UX (Split-Hold Visualizer, AG Grid ledger, Buyer Portal) be tuned to make the 3-minute demo video instantly understandable and memorable to non-technical judges?
   - What high-leverage addition would best boost scores for **Innovation** and **Potential Impact** without blowing the budget?

