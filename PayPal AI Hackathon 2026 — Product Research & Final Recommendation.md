# AuthHorizon: Locked Problem Statement and Technical Blueprint

Nov 2, 2026 · @Parth

## 1. The locked problem statement: AuthHorizon

AuthHorizon lets an online store get paid now for the part of an order that is ready, keep the rest on the buyer's PayPal hold, and let the buyer choose what happens to the delayed part. AI reads the supplier's delay notice. Plain code moves every cent.

**Status:** locked on Nov 7, 2026, with one kill-switch. If two partial captures on one PayPal authorization do not both move real sandbox funds (spike S2), we switch to SubShift (C33). No new hunt, no new debate.

**The problem in one example.** Ana orders $90 of goods. Two items ($60) are in stock. One item ($30) is delayed 9 days. The store can wait and ship nothing, cancel everything, or charge $90 and refund later. PayPal documents multiple partial captures for split shipments, but nothing helps a merchant decide what to do when the supplier's notice arrives, and nothing asks the buyer for consent.

**Why the pain is real** (links in Sources at the end)

- PayPal's own delayed-capture guide recommends multiple partial captures for split shipments.
- A Shopify community thread (Aug 21, 2023) shows a merchant stuck because the gateway does not allow partial captures of a single authorization.
- The US FTC mail, internet and telephone order rule says a seller must seek the customer's consent to a shipping delay and let the customer cancel for a full, prompt refund. This is background, not legal advice.

**Who pays whom.** A sandbox buyer pays a sandbox merchant, which is our own demo store. The catalog is labelled TEST DATA. No real money moves.

**Prize plan.** The rules allow one main prize or honorable mention plus one sponsor prize per project. Slot 1: Best Overall, or the honorable mention that fits best (Best Use of PayPal + AI). Slot 2: the AG Grid sponsor prize, with AG Studio as the live ledger.

**Honest odds.** This is a solid, real, technically deep entry, not a guaranteed winner. Innovation is MED, because PayPal documents the mechanism and some platforms ship parts of it. It wins on execution: real PayPal calls with visible proof, one clear hold-bar moment, a hard AI input problem (messy, multilingual supplier notices), and a polished three-minute video.

## 2. The product, end to end

The example throughout is Ana's $90 order: items A and B ($60) in stock, item C ($30) delayed 9 days. Tags: **\[doc\]** means I read it in PayPal's docs. **\[test\]** means it must pass a sandbox test before we rely on it. **\[ours\]** means our own logic, not a PayPal feature.

**Step 1. Checkout creates a hold, not a charge.** The store creates a PayPal order with intent AUTHORIZE for $90. Ana approves it in a PayPal browser window. The store then authorizes the order and receives an authorization ID. Nothing is captured yet. **\[doc\]** The authorization lives up to 29 days, with a 3-day honor period.

**Step 2. The ledger opens a row.** AG Studio shows one row per order: authorized $90, captured $0, held $90, days since authorization, and a status. **\[ours\]**

**Step 3. Ship what is ready.** The store marks A and B shipped. Our backend captures $60 with `final_capture=false`, so the authorization stays open. **\[doc\]** PayPal documents partial capture and `final_capture`. **\[test\]** Whether a second partial capture really moves money is the S2 gate.

**Step 4. Proof of payment arrives.** PayPal sends the PAYMENT.CAPTURE.COMPLETED webhook. We verify its signature with PayPal's verify-webhook-signature endpoint, then fetch the capture and only then mark the $60 as paid. We never trust a webhook body or an API 201 alone. **\[doc\]**

**Step 5. The supplier's delay notice lands.** A store owner pastes or forwards the supplier's message. It can be messy: free text, a different language, a partial date like "mid-November". **\[ours\]**

**Step 6. AI reads the notice.** The model returns a fixed structure: which item, new ship date (or a date range), reason, language, and a LOW, MED or HIGH confidence per field. It never returns money amounts. **\[ours\]**

**Step 7. Code checks the AI.** Validators confirm the item exists on this order, the date is in the future, the date fits inside the authorization window, and the stated amount matches our own catalog. Anything ambiguous goes to a human review queue instead of Ana. **\[ours\]**

**Step 8. Code builds Ana's options.** The options come from fixed rules, not from the AI.

- **Wait.** Keep the $30 on hold and ship C on the new date. Offered only if the new date lands inside the authorization window.
- **Swap.** Replace C with a similar item from the store's own catalog at the same price or lower. Capture is capped at the original $30.
- **Cancel.** Drop item C and release the $30 hold.

**Step 9. AI writes the message.** The model drafts Ana's message in her language. The dollar amounts, dates and buttons are filled in by code after the model's text is produced, so the model cannot change a number. **\[ours\]**

**Step 10. Ana decides on a consent page.** She sees exactly what is captured, what is held, and the three choices. Her choice is stored as a consent receipt: timestamp, the exact text shown, the amounts, and her choice. Silence does nothing. **\[ours\]** The FTC rule allows treating silence as consent only in narrow cases, so we choose the safer default and never capture on silence.

**Step 11. Code carries out her choice.**

- Wait: nothing moves until C ships. Then capture $30 with `final_capture=true`.
- Swap: after the swap ships, capture at most $30 with `final_capture=true`.
- Cancel: void the remaining authorization. **\[doc\]** A void endpoint exists. **\[test\]** Voiding an authorization that is already partially captured is not covered by spikes S1 to S4 and needs its own test (call it S5).

**Step 12. The ledger closes the order.** The hold bar shows $60 captured and $30 released or captured, with a PayPal ID next to every number. **\[ours\]**

**Step 13. A guard watches the clock.** A scheduler checks every open authorization. As the window closes it flags the order red in the ledger and prompts the store to act. We use real timestamps from the sandbox, never a fake clock presented as real. Reauthorization is a stretch goal only. **\[doc\]** The rules are: once only, between days 4 and 29, PayPal-account payments only. **\[test\]** Behavior on a partially captured authorization is undocumented.
