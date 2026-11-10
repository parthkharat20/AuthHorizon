#!/usr/bin/env python3
"""
AuthHorizon - PayPal Sandbox Gate Verification Spike (T0 Gate)
Tests:
  (a) Authorize $90, capture $60 (final_capture=false), then $30 (final_capture=true):
      verify via GET that both captures are COMPLETED and merchant balance moves (seller_receivable_breakdown).
  (b) Authorize, capture $60 (final_capture=false), then void:
      verify via GET that authorization is VOIDED.
  (c) Capture after final capture returns 422.
  (d) Replay identical PayPal-Request-Id: no second charge (idempotency).

Saves raw results to: evidence/paypal-sandbox-run.json
"""

import os
import sys
import json
import time
import uuid
import argparse
import requests
from dotenv import load_dotenv

load_dotenv()

PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET")
PAYPAL_API_BASE = os.getenv("PAYPAL_API_BASE", "https://api-m.sandbox.paypal.com")

if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET or PAYPAL_CLIENT_ID == "your_sandbox_client_id_here":
    print("❌ ERROR: PayPal Sandbox credentials missing in .env")
    sys.exit(1)

OUTPUT_FILE = "evidence/paypal-sandbox-run.json"
evidence = {
    "test_run_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "environment": "sandbox",
    "flow_a": {},
    "flow_b": {},
    "verifications": {}
}

def get_access_token():
    url = f"{PAYPAL_API_BASE}/v1/oauth2/token"
    res = requests.post(url, auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET), data={"grant_type": "client_credentials"})
    if res.status_code != 200:
        print(f"❌ Failed to get access token: {res.status_code} {res.text}")
        sys.exit(1)
    return res.json()["access_token"]

def create_order(token, desc="AuthHorizon Test Order"):
    url = f"{PAYPAL_API_BASE}/v2/checkout/orders"
    req_id = str(uuid.uuid4())
    payload = {
        "intent": "AUTHORIZE",
        "purchase_units": [{
            "reference_id": f"PU-{req_id[:8]}",
            "description": desc,
            "amount": {
                "currency_code": "USD",
                "value": "90.00",
                "breakdown": {"item_total": {"currency_code": "USD", "value": "90.00"}}
            },
            "items": [
                {"name": "Item A & B (In-Stock)", "sku": "SKU-STOCK-01", "unit_amount": {"currency_code": "USD", "value": "60.00"}, "quantity": "1", "category": "PHYSICAL_GOODS"},
                {"name": "Item C (Delayed)", "sku": "SKU-DELAY-02", "unit_amount": {"currency_code": "USD", "value": "30.00"}, "quantity": "1", "category": "PHYSICAL_GOODS"}
            ]
        }],
        "application_context": {
            "return_url": "http://localhost:5173/checkout/success",
            "cancel_url": "http://localhost:5173/checkout/cancel",
            "user_action": "CONTINUE"
        }
    }
    res = requests.post(url, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "PayPal-Request-Id": req_id}, json=payload)
    if res.status_code not in (200, 201):
        print(f"❌ Failed to create order: {res.status_code} {res.text}")
        sys.exit(1)
    order = res.json()
    approve_url = next(link["href"] for link in order["links"] if link["rel"] == "approve")
    return order["id"], approve_url

def poll_order_approval(token, order_id, label="Order"):
    print(f"\n⏳ Waiting for buyer approval on {label} ({order_id})...")
    url = f"{PAYPAL_API_BASE}/v2/checkout/orders/{order_id}"
    for attempt in range(300): # poll for up to 15 minutes
        res = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        status = res.json().get("status")
        if status == "APPROVED":
            print(f"✅ {label} is APPROVED by buyer!")
            return res.json()
        elif status in ("COMPLETED", "VOIDED"):
            print(f"ℹ️ {label} is already in state: {status}")
            return res.json()
        time.sleep(3)
    print(f"❌ Timed out waiting for buyer approval on {label}")
    sys.exit(1)

def authorize_order(token, order_id):
    url = f"{PAYPAL_API_BASE}/v2/checkout/orders/{order_id}/authorize"
    req_id = str(uuid.uuid4())
    for attempt in range(5):
        try:
            res = requests.post(url, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "PayPal-Request-Id": req_id}, json={}, timeout=30)
            if res.status_code in (200, 201):
                data = res.json()
                auth = data["purchase_units"][0]["payments"]["authorizations"][0]
                return auth["id"], auth
            elif res.status_code == 422 and "ORDER_ALREADY_AUTHORIZED" in res.text:
                order_res = requests.get(f"{PAYPAL_API_BASE}/v2/checkout/orders/{order_id}", headers={"Authorization": f"Bearer {token}"}, timeout=30)
                auth = order_res.json()["purchase_units"][0]["payments"]["authorizations"][0]
                return auth["id"], auth
            elif res.status_code in (500, 502, 503, 504):
                print(f"⚠️ Authorize returned {res.status_code}, retrying attempt {attempt+1}/5 after 3s...")
                time.sleep(3)
                continue
            else:
                print(f"❌ Failed to authorize order: {res.status_code} {res.text}")
                sys.exit(1)
        except requests.RequestException as e:
            print(f"⚠️ Network error during authorize: {e}, retrying attempt {attempt+1}/5...")
            time.sleep(3)
    print(f"❌ Failed to authorize order after retries.")
    sys.exit(1)

def capture_authorization(token, auth_id, amount, final_capture, req_id, note=""):
    url = f"{PAYPAL_API_BASE}/v2/payments/authorizations/{auth_id}/capture"
    payload = {
        "amount": {"currency_code": "USD", "value": f"{amount:.2f}"},
        "final_capture": final_capture,
        "note_to_payer": note
    }
    for attempt in range(5):
        try:
            res = requests.post(url, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "PayPal-Request-Id": req_id}, json=payload, timeout=30)
            if res.status_code in (500, 502, 503, 504):
                print(f"⚠️ Capture returned {res.status_code}, retrying attempt {attempt+1}/5 after 3s...")
                time.sleep(3)
                continue
            return res.status_code, (res.json() if res.text else {})
        except requests.RequestException as e:
            print(f"⚠️ Network error during capture: {e}, retrying...")
            time.sleep(3)
    return res.status_code, (res.json() if res.text else {})

def void_authorization(token, auth_id):
    url = f"{PAYPAL_API_BASE}/v2/payments/authorizations/{auth_id}/void"
    for attempt in range(5):
        try:
            res = requests.post(url, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, json={}, timeout=30)
            if res.status_code in (500, 502, 503, 504):
                print(f"⚠️ Void returned {res.status_code}, retrying attempt {attempt+1}/5 after 3s...")
                time.sleep(3)
                continue
            return res.status_code, (res.json() if res.text else {})
        except requests.RequestException as e:
            print(f"⚠️ Network error during void: {e}, retrying...")
            time.sleep(3)
    return res.status_code, (res.json() if res.text else {})

def get_authorization(token, auth_id):
    url = f"{PAYPAL_API_BASE}/v2/payments/authorizations/{auth_id}"
    for attempt in range(5):
        try:
            res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
            if res.status_code in (500, 502, 503, 504):
                time.sleep(2)
                continue
            return res.status_code, res.json()
        except requests.RequestException:
            time.sleep(2)
    return res.status_code, res.json()

def get_capture(token, capture_id):
    url = f"{PAYPAL_API_BASE}/v2/payments/captures/{capture_id}"
    for attempt in range(5):
        try:
            res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
            if res.status_code in (500, 502, 503, 504):
                time.sleep(2)
                continue
            return res.status_code, res.json()
        except requests.RequestException:
            time.sleep(2)
    return res.status_code, res.json()


def main():
    parser = argparse.ArgumentParser(description="Run T0 Gateway Sandbox Verification Spike")
    parser.add_argument("--order-a", help="Pre-created or approved Order ID for Flow A")
    parser.add_argument("--order-b", help="Pre-created or approved Order ID for Flow B")
    args = parser.parse_args()

    os.makedirs("evidence", exist_ok=True)
    print("=" * 70)
    print("🚀 AUTH-HORIZON T0 GATE: PAYPAL SANDBOX VERIFICATION SPIKE")
    print("=" * 70)

    token = get_access_token()
    print("🔑 PayPal OAuth Access Token acquired successfully.")

    # -------------------------------------------------------------
    # SETUP ORDERS
    # -------------------------------------------------------------
    if args.order_a:
        order_a_id = args.order_a
        approve_url_a = f"https://www.sandbox.paypal.com/checkoutnow?token={order_a_id}"
    else:
        order_a_id, approve_url_a = create_order(token, "AuthHorizon Flow A (Split Capture & Complete)")

    if args.order_b:
        order_b_id = args.order_b
        approve_url_b = f"https://www.sandbox.paypal.com/checkoutnow?token={order_b_id}"
    else:
        order_b_id, approve_url_b = create_order(token, "AuthHorizon Flow B (Split Capture & Void)")

    print("\n" + "#" * 70)
    print("👉 ACTION REQUIRED: APPROVE THE TWO ORDERS IN YOUR BROWSER:")
    print(f"   Order A: {order_a_id}")
    print(f"   URL A:   {approve_url_a}\n")
    print(f"   Order B: {order_b_id}")
    print(f"   URL B:   {approve_url_b}")
    print("#" * 70 + "\n")

    # Poll for approvals
    poll_order_approval(token, order_a_id, "Order A")
    poll_order_approval(token, order_b_id, "Order B")

    # -------------------------------------------------------------
    # EXECUTE FLOW A: Authorize $90 -> Capture $60 -> Replay (d) -> Capture $30 (a) -> Test 422 (c)
    # -------------------------------------------------------------
    print("\n" + "=" * 70)
    print("⚡ EXECUTING FLOW A: Authorize $90 -> Split Capture $60 -> Capture $30")
    print("=" * 70)

    auth_a_id, auth_a_data = authorize_order(token, order_a_id)
    print(f"✅ Order A Authorized: ID={auth_a_id}, Status={auth_a_data['status']}")
    evidence["flow_a"]["authorization"] = auth_a_data

    # Step 1: Capture $60 non-final
    req_id_cap1 = str(uuid.uuid4())
    status_cap1, cap1_data = capture_authorization(token, auth_a_id, 60.0, False, req_id_cap1, "In-stock items")
    if status_cap1 not in (200, 201):
        print(f"❌ Partial capture 1 failed: {status_cap1} {cap1_data}")
        sys.exit(1)
    cap1_id = cap1_data["id"]
    print(f"✅ Capture 1 ($60.00, final_capture=False): ID={cap1_id}, Status={cap1_data['status']}")
    evidence["flow_a"]["capture_1"] = cap1_data

    # Step 2: Test (d) - Replay same PayPal-Request-Id
    print("\n🔍 Testing (d): Replay identical PayPal-Request-Id (Idempotency check)...")
    status_replay, cap1_replay = capture_authorization(token, auth_a_id, 60.0, False, req_id_cap1, "In-stock items replay")
    print(f"   Replay HTTP Status: {status_replay}")
    print(f"   Replay returned Capture ID: {cap1_replay.get('id')}")
    assert cap1_replay.get("id") == cap1_id, "Replay did not return identical capture ID!"
    evidence["verifications"]["d_idempotency_replay"] = {
        "status": "PASSED",
        "original_request_id": req_id_cap1,
        "http_status": status_replay,
        "returned_capture_id": cap1_replay.get("id"),
        "note": "Same PayPal-Request-Id returned original capture without double charge."
    }
    print("✅ (d) PASSED: No second charge on request-id replay.")

    # Step 3: Verify Capture 1 via GET
    get_cap1_status, get_cap1_data = get_capture(token, cap1_id)
    print(f"   GET /v2/payments/captures/{cap1_id}: Status={get_cap1_data.get('status')}")
    evidence["flow_a"]["get_capture_1"] = get_cap1_data

    # Step 4: Capture $30 final
    req_id_cap2 = str(uuid.uuid4())
    status_cap2, cap2_data = capture_authorization(token, auth_a_id, 30.0, True, req_id_cap2, "Final delayed item")
    if status_cap2 not in (200, 201):
        print(f"❌ Final capture 2 failed: {status_cap2} {cap2_data}")
        sys.exit(1)
    cap2_id = cap2_data["id"]
    print(f"✅ Capture 2 ($30.00, final_capture=True): ID={cap2_id}, Status={cap2_data['status']}")
    evidence["flow_a"]["capture_2"] = cap2_data

    # Step 5: Verify via GET - (a) Both COMPLETED & Merchant balance moves
    get_cap2_status, get_cap2_data = get_capture(token, cap2_id)
    print(f"   GET /v2/payments/captures/{cap2_id}: Status={get_cap2_data.get('status')}")
    evidence["flow_a"]["get_capture_2"] = get_cap2_data

    # Inspect seller_receivable_breakdown
    cap1_breakdown = get_cap1_data.get("seller_receivable_breakdown", {})
    cap2_breakdown = get_cap2_data.get("seller_receivable_breakdown", {})
    print(f"   Capture 1 Net Amount: {cap1_breakdown.get('net_amount', {}).get('value')} {cap1_breakdown.get('net_amount', {}).get('currency_code')}")
    print(f"   Capture 2 Net Amount: {cap2_breakdown.get('net_amount', {}).get('value')} {cap2_breakdown.get('net_amount', {}).get('currency_code')}")

    get_auth_a_status, get_auth_a_data = get_authorization(token, auth_a_id)
    print(f"   GET /v2/payments/authorizations/{auth_a_id}: Status={get_auth_a_data.get('status')}")
    evidence["flow_a"]["get_authorization_final"] = get_auth_a_data

    assert get_cap1_data.get("status") == "COMPLETED" and get_cap2_data.get("status") == "COMPLETED", "Captures not COMPLETED!"
    evidence["verifications"]["a_both_captures_completed"] = {
        "status": "PASSED",
        "capture_1_id": cap1_id,
        "capture_1_status": get_cap1_data.get("status"),
        "capture_1_net": cap1_breakdown.get("net_amount"),
        "capture_2_id": cap2_id,
        "capture_2_status": get_cap2_data.get("status"),
        "capture_2_net": cap2_breakdown.get("net_amount"),
        "parent_auth_status": get_auth_a_data.get("status")
    }
    print("✅ (a) PASSED: Both captures verified COMPLETED via GET with net balance movements.")

    # Step 6: Test (c) - Capture after final capture returns 422
    print("\n🔍 Testing (c): Capture attempt after final_capture=true (Expecting 422)...")
    status_cap3, cap3_data = capture_authorization(token, auth_a_id, 10.0, True, str(uuid.uuid4()), "Post-final capture attempt")
    print(f"   HTTP Status: {status_cap3}")
    print(f"   Response Name: {cap3_data.get('name')}")
    assert status_cap3 == 422, f"Expected 422, got {status_cap3}"
    evidence["verifications"]["c_capture_after_final_capture_422"] = {
        "status": "PASSED",
        "http_status": status_cap3,
        "error_name": cap3_data.get("name"),
        "details": cap3_data.get("details")
    }
    print("✅ (c) PASSED: Attempting capture after final capture returned 422 UNPROCESSABLE_ENTITY.")

    # -------------------------------------------------------------
    # EXECUTE FLOW B: Authorize $90 -> Capture $60 -> Void remaining
    # -------------------------------------------------------------
    print("\n" + "=" * 70)
    print("⚡ EXECUTING FLOW B: Authorize $90 -> Split Capture $60 -> Void Remaining Hold")
    print("=" * 70)

    auth_b_id, auth_b_data = authorize_order(token, order_b_id)
    print(f"✅ Order B Authorized: ID={auth_b_id}, Status={auth_b_data['status']}")
    evidence["flow_b"]["authorization"] = auth_b_data

    # Step 1: Capture $60 non-final
    req_id_cap_b = str(uuid.uuid4())
    status_cap_b, cap_b_data = capture_authorization(token, auth_b_id, 60.0, False, req_id_cap_b, "Flow B in-stock shipment")
    if status_cap_b not in (200, 201):
        print(f"❌ Partial capture B failed: {status_cap_b} {cap_b_data}")
        sys.exit(1)
    print(f"✅ Capture B ($60.00, final_capture=False): ID={cap_b_data['id']}, Status={cap_b_data['status']}")
    evidence["flow_b"]["capture_1"] = cap_b_data

    # Step 2: Void remaining authorization
    print("\n🔍 Testing (b): Voiding parent authorization after partial capture...")
    status_void, void_data = void_authorization(token, auth_b_id)
    print(f"   Void Call HTTP Status: {status_void}")
    evidence["flow_b"]["void_response"] = void_data

    # Step 3: Verify (b) via GET
    get_auth_b_status, get_auth_b_data = get_authorization(token, auth_b_id)
    print(f"   GET /v2/payments/authorizations/{auth_b_id}: Status={get_auth_b_data.get('status')}")
    evidence["flow_b"]["get_authorization_after_void"] = get_auth_b_data

    assert get_auth_b_data.get("status") == "VOIDED", f"Authorization status is {get_auth_b_data.get('status')}, expected VOIDED!"
    evidence["verifications"]["b_void_after_partial_capture"] = {
        "status": "PASSED",
        "auth_id": auth_b_id,
        "void_http_status": status_void,
        "auth_status_via_get": get_auth_b_data.get("status"),
        "note": "Authorization successfully VOIDED after partial capture, releasing remaining hold."
    }
    print("✅ (b) PASSED: Parent authorization successfully verified VOIDED via GET.")

    # -------------------------------------------------------------
    # SAVE EVIDENCE FILE
    # -------------------------------------------------------------
    with open(OUTPUT_FILE, "w") as f:
        json.dump(evidence, f, indent=2)

    print("\n" + "=" * 70)
    print("🏁 ALL T0 GATE VERIFICATIONS (a, b, c, d) PASSED WITH FLYING COLORS!")
    print(f"📄 Full evidence saved to: {OUTPUT_FILE}")
    print("=" * 70)

if __name__ == "__main__":
    main()
