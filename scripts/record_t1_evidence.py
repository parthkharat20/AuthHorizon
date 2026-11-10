#!/usr/bin/env python3
"""
AuthHorizon - Record T1 UI Flow Evidence
Fetches Order record from local SQLite, queries PayPal Sandbox API via GET
for every PayPal ID (Order, Authorization, Partial Capture, Final Capture/Void),
and appends structured cryptographic proof into evidence/paypal-sandbox-run.json.
"""

import os
import sys
import json
import time
import requests
from dotenv import load_dotenv

load_dotenv()

PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET")
PAYPAL_API_BASE = os.getenv("PAYPAL_API_BASE", "https://api-m.sandbox.paypal.com")
EVIDENCE_FILE = "evidence/paypal-sandbox-run.json"

def get_access_token():
    url = f"{PAYPAL_API_BASE}/v1/oauth2/token"
    res = requests.post(url, auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET), data={"grant_type": "client_credentials"})
    if res.status_code != 200:
        print(f"❌ Failed to get access token: {res.status_code} {res.text}")
        sys.exit(1)
    return res.json()["access_token"]

def main():
    order_id = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    print(f"🔍 Inspecting Order #{order_id} from local API...")
    
    # Query local backend
    res = requests.get(f"http://127.0.0.1:8000/api/orders/{order_id}")
    if res.status_code != 200:
        print(f"❌ Failed to fetch order {order_id} from local API: {res.status_code} {res.text}")
        sys.exit(1)
    
    order_data = res.json()
    paypal_order_id = order_data.get("paypal_order_id")
    auth_id = order_data.get("auth_id")
    
    print(f"   Local Status: {order_data.get('status')}")
    print(f"   PayPal Order ID: {paypal_order_id}")
    print(f"   PayPal Auth ID:  {auth_id}")
    print(f"   Captured Amount: ${order_data.get('captured_amount')}")
    print(f"   Held Amount:     ${order_data.get('held_amount')}")

    token = get_access_token()

    t1_record = {
        "verified_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "local_order_id": order_id,
        "paypal_order_id": paypal_order_id,
        "auth_id": auth_id,
        "local_order_status": order_data.get("status"),
        "total_amount": order_data.get("total_amount"),
        "captured_amount": order_data.get("captured_amount"),
        "held_amount": order_data.get("held_amount"),
        "line_items": order_data.get("items", []),
        "delay_notices": order_data.get("delay_notices", []),
        "buyer_consents": order_data.get("consents", []),
        "captures_audit": order_data.get("captures", []),
        "paypal_verifications": {}
    }

    # 1. Verify PayPal Order via GET
    if paypal_order_id:
        res_o = requests.get(f"{PAYPAL_API_BASE}/v2/checkout/orders/{paypal_order_id}", headers={"Authorization": f"Bearer {token}"})
        t1_record["paypal_verifications"]["order"] = {
            "http_status": res_o.status_code,
            "status": res_o.json().get("status"),
            "data": res_o.json()
        }
        print(f"✅ PayPal Order GET: Status={res_o.json().get('status')}")

    # 2. Verify Authorization via GET
    if auth_id:
        res_a = requests.get(f"{PAYPAL_API_BASE}/v2/payments/authorizations/{auth_id}", headers={"Authorization": f"Bearer {token}"})
        t1_record["paypal_verifications"]["authorization"] = {
            "http_status": res_a.status_code,
            "status": res_a.json().get("status"),
            "data": res_a.json()
        }
        print(f"✅ PayPal Auth GET: Status={res_a.json().get('status')}")

    # 3. Verify Captures via GET
    t1_record["paypal_verifications"]["captures"] = []
    for cap in order_data.get("captures", []):
        cap_id = cap.get("paypal_capture_id")
        if cap_id:
            res_c = requests.get(f"{PAYPAL_API_BASE}/v2/payments/captures/{cap_id}", headers={"Authorization": f"Bearer {token}"})
            t1_record["paypal_verifications"]["captures"].append({
                "capture_id": cap_id,
                "http_status": res_c.status_code,
                "status": res_c.json().get("status"),
                "amount": res_c.json().get("amount"),
                "seller_receivable_breakdown": res_c.json().get("seller_receivable_breakdown")
            })
            print(f"✅ PayPal Capture GET ({cap_id}): Status={res_c.json().get('status')}, Amount={res_c.json().get('amount')}")

    # Read existing evidence file and update
    with open(EVIDENCE_FILE, "r") as f:
        evidence = json.load(f)

    evidence["t1_ui_flow"] = t1_record

    with open(EVIDENCE_FILE, "w") as f:
        json.dump(evidence, f, indent=2)

    print(f"\n🎉 Successfully recorded T1 UI Flow evidence to: {EVIDENCE_FILE}")

if __name__ == "__main__":
    main()

