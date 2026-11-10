# AuthHorizon — 3-Minute Demo Video Screenplay
## PayPal AI Hackathon 2026

**Format:** 1080p60, screen capture + voiceover  
**Duration:** 2:50 (10s buffer before 3:00 hard limit)  
**Tone:** Confident, technical, visual-first

---

## Second-by-Second Breakdown

| Time | Visual | Voiceover Script | Action |
|------|--------|------------------|--------|
| **0:00–0:05** | Black screen → AuthHorizon logo fade-in with tagline "Split-Shipment Intelligence" | *"What happens when your customer orders three items… and one gets delayed?"* | Logo animation |
| **0:05–0:12** | Quick montage: screenshot of messy German supplier email, FTC regulation highlight, PayPal dashboard | *"Today, merchants face a brutal choice: charge everything upfront and violate shipping regulations, or cancel the entire order and lose revenue."* | 3 images cycle |
| **0:12–0:20** | AuthHorizon architecture diagram (from AUTHORIZON_SPEC.md) zooms in | *"AuthHorizon bridges the gap between unstructured supplier communications, buyer consent, and PayPal's native authorization-and-capture lifecycle. AI reads the mess. Deterministic code moves every cent."* | Diagram overlay |
| **0:20–0:25** | Transition to live demo — Merchant Dashboard visible | *"Let me show you."* | Cut to browser |

### ACT 2: Live Sandbox Order & Split-Capture (0:25–1:00)

| Time | Visual | Voiceover Script | Action |
|------|--------|------------------|--------|
| **0:25–0:32** | Click "Create Demo Order" button. Order card appears with 3 items ($30 each = $90 total) | *"We create a ninety-dollar order with three industrial components. PayPal creates an AUTHORIZE intent — no money moves yet."* | Click button, show response |
| **0:32–0:38** | Click PayPal approval link → PayPal Sandbox modal opens → login as sandbox buyer → approve | *"The buyer approves on PayPal. Still, zero dollars captured."* | PayPal sandbox approval |
| **0:38–0:42** | Click "Authorize" button. Hold Bar appears: solid $90.00 bar | *"We lock the authorization. Ninety dollars held, zero charged."* | Authorization call |
| **0:42–0:50** | Click "Ship In-Stock Items". **HERO MOMENT:** Hold Bar animates — splits into $60 Green / $30 Amber | *"Items A and B ship immediately. Watch the Hold Bar split: sixty dollars captured for shipped goods…"* | Partial capture, bar animation |
| **0:50–0:55** | Camera lingers on the Split Hold Bar. Amber segment pulses. | *"…thirty dollars still held, pulsing amber, waiting for the delayed item."* | Hold on visual |
| **0:55–1:00** | AG Grid updates: order status → PARTIALLY_CAPTURED, capture audit row appears | *"Every transaction is logged with PayPal's idempotency key and webhook verification."* | Grid auto-refresh |

### ACT 3: AI Notice Parser & Buyer Consent (1:00–1:45)

| Time | Visual | Voiceover Script | Action |
|------|--------|------------------|--------|
| **1:00–1:08** | Select "German" from fixture dropdown. Raw German supplier email appears in textarea | *"Now a German supplier sends this — an unstructured email, in German, about a delayed ceramic coating."* | Select fixture |
| **1:08–1:15** | Click "Parse Notice". Extraction card appears: SKU, ship date "mid-November", reason, confidence badges (all HIGH, green) | *"Claude extracts the SKU, new ship date, and delay reason — with confidence scores. Notice: the AI never sees a single dollar amount."* | Parse API call |
| **1:15–1:22** | Highlight the AI Safety Gate badge: "✅ AI outputs zero currency. Amounts injected by deterministic code." | *"This is the non-negotiable financial safety gate. AI reads the mess. Code calculates the money."* | Point to badge |
| **1:22–1:30** | Navigate to Buyer Consent Portal. Three choice cards visible: Wait, Swap, Cancel | *"The buyer gets a clean consent portal. Three choices, each with an exact breakdown of what has been charged and what's on hold."* | Browser navigation |
| **1:30–1:38** | Hover over each card. Click "Wait for Ceramic Coating Kit" | *"They choose to wait. The thirty-dollar hold stays active until the new ship date."* | Click Wait card |
| **1:38–1:45** | Confirmation modal → confirm → success with consent hash displayed | *"Consent is cryptographically bound — a SHA-256 hash of the displayed text, the choice, and the timestamp. Immutable audit trail."* | Confirm action |

### ACT 4: AG Studio Visual Climax & Audit Ledger (1:45–2:20)

| Time | Visual | Voiceover Script | Action |
|------|--------|------------------|--------|
| **1:45–1:52** | Return to Merchant Dashboard. AG Grid shows updated order. Capture audit log has 2 entries. | *"Back in the Merchant Command Center, AG Grid displays every order with real-time status."* | Dashboard view |
| **1:52–2:00** | Expand audit log: show both captures (partial $60 + final $30), webhook verification ✓ | *"The capture audit ledger tracks both partial captures — each with a unique PayPal Request ID and verified webhook confirmation."* | Expand audit |
| **2:00–2:08** | Hold Bar shows final state: fully green $90 bar (both segments captured) | *"And the Hold Bar resolves — from a single authorization, through a split capture, to complete fulfillment. Every dollar accounted for."* | Final bar state |
| **2:08–2:15** | Quick replay: run the Cancel scenario — show amber segment shrinking to zero, "$30 RELEASED" | *"Or if the buyer cancels — the held amount releases immediately. No overcharge, no dispute."* | Quick Cancel demo |
| **2:15–2:20** | Architecture diagram returns, this time with green checkmarks on each layer | *"AI parses. Code validates. Buyer consents. PayPal executes. Auditable end to end."* | Overlay checkmarks |

### ACT 5: Closing Engineering Defense (2:20–2:50)

| Time | Visual | Voiceover Script | Action |
|------|--------|------------------|--------|
| **2:20–2:28** | Split screen: left = code snippet showing `final_capture: false`, right = PayPal API response | *"Under the hood: idempotent captures with PayPal-Request-Id headers, webhook signature verification, Pydantic type safety, and SQLite audit persistence."* | Code + API |
| **2:28–2:35** | Three bullet points appear: "FTC 16 CFR Part 435", "EU Shipping Directive", "PayPal Seller Protection" | *"AuthHorizon enforces compliance with FTC mail order rules and EU shipping directives — protecting merchants from chargebacks and regulatory exposure."* | Bullets overlay |
| **2:35–2:42** | Impact stats: "23% of e-commerce orders contain backordered items", "Split shipments lose 2.4x more to disputes" | *"Twenty-three percent of multi-item orders hit delays. Without split-capture automation, merchants lose revenue or face disputes. AuthHorizon closes that gap."* | Stats overlay |
| **2:42–2:48** | AuthHorizon logo + GitHub URL + team info | *"AuthHorizon. Built for PayPal. Built by [Your Name]."* | End card |
| **2:48–2:50** | Fade to black | *(silence)* | End |

---

## Recording Checklist

- [ ] PayPal Sandbox credentials loaded in .env
- [ ] Backend running on localhost:8000
- [ ] Frontend running on localhost:5173
- [ ] Sandbox buyer account logged in and ready
- [ ] Screen recording at 1080p60 (OBS or QuickTime)
- [ ] Microphone tested (clear voiceover, no background noise)
- [ ] Browser zoom at 110% for readability
- [ ] Dark mode system theme active
- [ ] Close all other browser tabs
- [ ] Rehearse full flow 2x before recording

## Key Demo Flow (Step by Step)

1. Click "Create Demo Order" → copy PayPal approval URL
2. Open approval URL → log in as sandbox buyer → approve
3. Click "Authorize" → Hold Bar appears ($90 solid)
4. Click "Ship In-Stock Items" → Hold Bar splits ($60 green / $30 amber) ← **HERO MOMENT**
5. Select German fixture → Click "Parse Notice" → show extraction results
6. Navigate to Buyer Consent Portal → click "Wait" → confirm
7. Return to Dashboard → show audit log with verified captures
8. (Quick) Show Cancel scenario for contrast

