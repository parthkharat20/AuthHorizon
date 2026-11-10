# PASS 0: RESEARCH FINDINGS & DECISION MEMO (REVISED)
## AuthHorizon — PayPal AI Hackathon 2026
### Generated: 2026-11-09 ~18:50 IST

---

## (a) Official Rules, Judging, Prizes & Sponsor Details

**Source:** Devpost hackathon page, official rules & sponsor partner pages [doc]

### Core Rules & Gates
- **Submission Deadline:** November 12, 2026 @ 12:00 PM PT (Nov 13, 1:30 AM IST).
- **Core Requirement:** Meaningful integration of both **PayPal Developer Platform** (sandbox APIs/SDKs) and **AI** [doc].
- **Submission Deliverables** [doc]:
  1. Working application or functional prototype (static mockups disqualified).
  2. Public open-source repository (GitHub/GitLab/Bitbucket) with an open-source license.
  3. Public YouTube demonstration video strictly under 3 minutes.
  4. Project description and hosted URL or complete local run instructions.
- **Stage 1 Pass/Fail:** PayPal must be central to money movement, not a cosmetic button [doc].
- **AI Safety Gate (Our System Rule):** AI never calculates, outputs, or authorizes money. AI only parses unstructured notices into structured data and drafts template messages. Deterministic code fills every dollar amount and executes every PayPal call.

### Judging Criteria (20% each) [doc]
1. **Technological Implementation:** Technical depth, production quality, working implementation.
2. **Design:** Coherent, complete, polished user experience.
3. **Potential Impact:** Solves a credible, specific problem for real businesses/consumers.
4. **Innovation and Idea:** Originality in blending payments, commerce, and AI.
5. **Presentation:** Video demo clarity and description quality.

### Prize Structure & Stacking [doc]
* **Grand Prizes (Cash):** 1st: $12,000 | 2nd: $8,000 | 3rd: $5,000 [doc].
* **Special Category Awards ($5,000 each):** Most Creative, Most Impactful, Best Demo Delivery, Best Use of PayPal + AI, Best Use of Agentic Commerce [doc].
* **Partner / Sponsor Prizes:**
  * **AG Grid / AG Studio:** 1st: $5,000 cash | 2nd: $2,000 cash for Best Use of AG Grid / AG Studio [doc].
  * **Bryntum:** $1,000 cash each to 3 winners for Best Use of Bryntum web components (schedulers/grids) [doc].
  * **APIMatic:** ~$1,000 cash split across 3 winners for using the APIMatic Context Plugin to build PayPal integrations [doc].
  * **Render:** $50 in infrastructure/worker credits per participant (no cash prize) [doc].
  * **Channel3:** 20,000 free API credits with promo code `PAYPAL-HACKATHON-2026` for normalized product data (no cash prize) [doc].
* **Prize Stacking Rule:** Standard Devpost rule allows at most ONE sponsor prize plus either ONE Grand Prize or ONE Special Category award [assumed].

---

## (b) PayPal REST API Mechanics & The Corrected Void Finding

### The Corrected Void Behavior [doc]
* **Documented Behavior:** When an authorization is partially captured with `"final_capture": false`, PayPal documentation confirms that **calling `POST /v2/payments/authorizations/{authorization_id}/void` IS permitted on the parent authorization** [doc: developer.paypal.com/docs/api/payments/v2/#authorizations_void].
* **What Void Does After Partial Capture:**
  * The captured portion ($60.00) remains settled and untouched [doc].
  * The remaining uncaptured balance ($30.00) held on the buyer's payment instrument is immediately released [doc].
  * The authorization status transitions to `VOIDED`. No further captures can be made [doc].
* **The Error Origin:** The error `AUTHORIZATION_CANNOT_BE_VOIDED` occurs in edge cases when attempting to void a *reauthorization child* rather than the original parent authorization, or attempting to pass a partial amount to void (void is strictly all-or-nothing for the remaining balance) [doc].
* **Reauthorization State Rule:** After a reauthorization, voiding must target the parent authorization, and any new child auth ID must be tracked explicitly [doc].
* **Gate Protocol:** Spike S2 in Phase 1 directly verifies: Authorize $90 -> Capture $60 (`final_capture: false`) -> Void remaining $30. If the sandbox accepts it, direct void is our primary Cancel mechanism.
* **Fallback Hierarchy (Ranked by Buyer Experience if Sandbox Refuses):**
  1. *Fallback 1 (Best UX):* `POST /v2/payments/authorizations/{auth_id}/capture` with amount `$0.01` (or `$0.00` if allowed) and `final_capture: true`. This captures pennies and automatically releases the rest without leaving a multi-week hold.
  2. *Fallback 2 (Clean Balance, Higher Friction):* Capture remaining `$30.00` (`final_capture: true`) and immediately trigger `POST /v2/payments/captures/{capture_id}/refund` for `$30.00`. Guaranteed to settle at $0 net for the delayed item, but generates two ledger records and potential processing fee friction.

---

## (c) Collision Scan: Crowded Mechanics vs. Open Domain

**Reality Check:** The generic **authorize/hold/capture/void mechanic is crowded** on Devpost for this hackathon. Real submissions found:
1. **Jaminan** ([devpost.com/software/jaminan]): Scooter rental security deposit hold in Bali/Jakarta using PayPal `AUTHORIZE`, capturing rental fees and releasing deposits via vehicle damage walkaround photos verified by a vision model [doc].
2. **Trustrail Hold** ([devpost.com/software/trustrail-hold]): Uses PayPal Orders v2 `AUTHORIZE` to hold funds for AI research briefs, releasing/capturing upon automated semantic verification or voiding on failure [doc].
3. **Agent Spend Gate / SentinelPay / Warden / Velora** ([devpost.com/software/agent-spend-gate], [devpost.com/software/warden-a-paypal-firewall-for-ai-agents]): All implement policy guardrails, Ed25519 or SHA-256 tamper-evident ledgers, and conditional capture/void gates to prevent autonomous agent overspending [doc].

### Why AuthHorizon Stands Out (The Open Domain)
* **The Crowded Zone:** Generic AI escrow, agent spending firewalls, and rental deposits.
* **The Open Zone:** **B2B-to-Consumer split-shipment backorder resolution.** No project bridges unstructured multilingual supplier delay notices (invoices/emails) with legally mandated consumer consent choices (Wait, Swap, Cancel) and partial capture fulfillment.
* **Clear Positioning:** We do not claim to have invented partial captures. We provide the missing compliance and intelligence layer connecting broken supply chains to PayPal's native split-shipment lifecycle.

---

## (d) Free-Tier LLM Evaluation & Selection Strategy

**Constraint:** The developer has NO paid API keys. All LLM calls must run on verified free tiers with zero credit card mandates.

### Candidate Matrix
| Provider | Candidate Models | Free Limits | Structured JSON | Multilingual Strength (DE, DA, EN) |
|---|---|---|---|---|
| **Google AI Studio** | Gemini 2.5 Flash, Gemini 3.8 Flash | Dynamic per project (typically 10–15 RPM, 250k–1M TPM, 1,500 RPD) [doc] | Native `response_mime_type: "application/json"` + schema [doc] | High (massively multilingual training set) |
| **Groq** | Llama 3.3 70B Versatile, Qwen 2.5 32B, Mixtral 8x7B | 6k–30k TPM, permanent free tier [doc] | Native `response_format: { type: "json_schema", strict: true }` [doc] | Llama 3.3 / Qwen 2.5 show strong German/Danish performance |
| **Cerebras** | Llama 3.1 8B / 70B | Ultra-fast inference, free developer tier [doc] | JSON object mode | Moderate-to-high on European languages |
| **Mistral API** | Mistral Small / NeMo | Free tier with rate limits | Native JSON mode | Exceptional native European language proficiency |

### Provider-Agnostic Interface & The 20-Notice Eval Decider
* **Architecture:** We build a single OpenAI-compatible client adapter that takes `base_url`, `api_key`, and `model_name`.
* **Selection Policy:** We do NOT hardcode a single winner upfront. We deploy a test suite of **20 realistic notices** (English, German, Danish, plus adversarial injection). The model that scores highest on extraction accuracy and zero false approvals becomes the primary, with the second as automated fallback.

---

## (e) Stack Choice & Budget Adjustments

### Pinned Stack
* **Backend:** Python 3.12 + FastAPI + SQLAlchemy 2.0 + Pydantic v2.
* **Database:** SQLite (`authhorizon.db`) with Write-Ahead Logging (WAL) for local dev and demo.
* **Frontend:** React 18 + Vite + Tailwind CSS + AG Grid Community (free MIT license).
* **Hosting:** Render free tier ($50 credits available for workers) + local ngrok tunnel for webhook verification.
* **SDK Context:** APIMatic Context Plugin (`npx context-plugins install paypal`) for the coding agent.

### Budget Adjustment (Strict 45 Hours Total)
* **AG Studio Removed from Core Budget:** AG Studio is treated as an optional stretch feature. The core dashboard uses **AG Grid Community** paired with a custom CSS/SVG **Split Hold Bar** hero component. If extra time remains post-code-freeze, AG Studio will be layered on top; otherwise, all buffer goes to debugging and video recording.

| Activity | Allocated Effort |
|---|---|
| Phase 1: PayPal Sandbox Spikes (S1–S5) | 3h |
| Phase 2: Core Contracts, State Machine & SQLite Ledger | 5h |
| Phase 3: AI Cognitive Boundary & 20-Notice Eval Suite | 7h |
| Phase 4: Backend REST APIs, Gateway Mock & Webhook Signature Verifier | 10h |
| Phase 5: Frontend Dashboard, Split Hold Bar & Buyer Consent Portal | 10h |
| Phase 6: End-to-End Sandbox Dry Run & Reconciler Verification | 4h |
| Phase 7: Demo Video Recording, README & Devpost Packaging | 4h |
| Technical Buffer (Debugging, network retries) | 2h |
| **Total Effort Budget** | **45h** |

---

## DECISION MEMO CONCLUSION: PROCEED TO PASS A

The baseline idea is locked with the corrected void mechanics, honest competitive positioning, provider-agnostic free LLM evaluation, and a lean 45-hour execution budget.

Proceeding immediately to **Pass A (`00-decisions.md` and `01-contracts.md`)**.
