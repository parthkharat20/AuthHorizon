"""
AuthHorizon Deterministic Mock PayPal Gateway
Simulates real PayPal API responses and failure modes for local testing.
"""

import uuid
import time
from typing import Dict, Any, List
from backend.gateway.base import PayPalGatewayInterface

class MockPayPalGateway(PayPalGatewayInterface):
    def __init__(self):
        # In-memory storage for mock transactions
        self.orders: Dict[str, Dict[str, Any]] = {}
        self.authorizations: Dict[str, Dict[str, Any]] = {}
        self.captures: Dict[str, Dict[str, Any]] = {}
        
        # Test simulation flags
        self.simulate_network_timeout: bool = False
        self.simulate_ghost_capture: bool = False
        self.simulate_void_rejection: bool = False

    def create_order(self, items: List[Dict[str, Any]], total_amount: float, request_id: str) -> Dict[str, Any]:
        if self.simulate_network_timeout:
            raise TimeoutError("Simulated PayPal gateway timeout on create_order")

        # Idempotency replay check
        for existing_ord in self.orders.values():
            if existing_ord.get("request_id") == request_id:
                return existing_ord

        order_id = f"MOCK-ORD-{uuid.uuid4().hex[:12].upper()}"
        order_obj = {
            "id": order_id,
            "status": "CREATED",
            "intent": "AUTHORIZE",
            "total_amount": total_amount,
            "items": items,
            "request_id": request_id,
            "links": [
                {
                    "rel": "approve",
                    "href": f"https://www.sandbox.paypal.com/checkoutnow?token={order_id}"
                }
            ],
            "created_at": time.time()
        }
        self.orders[order_id] = order_obj
        return order_obj

    def authorize_order(self, paypal_order_id: str, request_id: str) -> Dict[str, Any]:
        if self.simulate_network_timeout:
            raise TimeoutError("Simulated PayPal gateway timeout on authorize_order")

        # Idempotency replay check
        for existing_auth in self.authorizations.values():
            if existing_auth.get("request_id") == request_id:
                return existing_auth

        order = self.orders.get(paypal_order_id)
        if not order:
            raise ValueError(f"Order {paypal_order_id} not found")

        auth_id = f"MOCK-AUTH-{uuid.uuid4().hex[:12].upper()}"
        auth_obj = {
            "id": auth_id,
            "status": "CREATED",
            "order_id": paypal_order_id,
            "amount": {
                "currency_code": "USD",
                "value": f"{order['total_amount']:.2f}"
            },
            "remaining_amount": order["total_amount"],
            "captured_amount": 0.0,
            "request_id": request_id,
            "created_at": time.time()
        }
        self.authorizations[auth_id] = auth_obj
        order["status"] = "COMPLETED"  # Order transitions to COMPLETED when authorized
        order["auth_id"] = auth_id
        return auth_obj

    def capture_authorization(self, auth_id: str, amount: float, final_capture: bool, request_id: str, note: str = "") -> Dict[str, Any]:
        if self.simulate_network_timeout:
            raise TimeoutError("Simulated PayPal gateway timeout on capture_authorization")

        # Idempotency replay check: if request_id matches an existing capture, return it
        for existing_cap in self.captures.values():
            if existing_cap.get("request_id") == request_id:
                return existing_cap

        auth = self.authorizations.get(auth_id)
        if not auth:
            raise ValueError(f"Authorization {auth_id} not found")

        if auth["status"] in ("VOIDED", "EXPIRED"):
            raise ValueError(f"Cannot capture on {auth['status']} authorization")

        if amount > auth["remaining_amount"]:
            raise ValueError(f"Capture amount {amount} exceeds remaining {auth['remaining_amount']}")

        capture_id = f"MOCK-CAP-{uuid.uuid4().hex[:12].upper()}"
        
        # Ghost capture simulation: returns 200 payload but does not update internal balance
        if not self.simulate_ghost_capture:
            auth["remaining_amount"] = round(auth["remaining_amount"] - amount, 2)
            auth["captured_amount"] = round(auth["captured_amount"] + amount, 2)
            if final_capture or auth["remaining_amount"] <= 0:
                auth["status"] = "CAPTURED"
            else:
                auth["status"] = "PARTIALLY_CAPTURED"

        cap_obj = {
            "id": capture_id,
            "status": "COMPLETED",
            "amount": {
                "currency_code": "USD",
                "value": f"{amount:.2f}"
            },
            "final_capture": final_capture,
            "auth_id": auth_id,
            "request_id": request_id,
            "note_to_payer": note,
            "created_at": time.time()
        }
        self.captures[capture_id] = cap_obj
        return cap_obj

    def void_authorization(self, auth_id: str) -> Dict[str, Any]:
        if self.simulate_void_rejection:
            raise ValueError("AUTHORIZATION_CANNOT_BE_VOIDED: Simulated void rejection")

        auth = self.authorizations.get(auth_id)
        if not auth:
            raise ValueError(f"Authorization {auth_id} not found")

        auth["status"] = "VOIDED"
        auth["remaining_amount"] = 0.0
        return {"id": auth_id, "status": "VOIDED"}

    def get_authorization(self, auth_id: str) -> Dict[str, Any]:
        auth = self.authorizations.get(auth_id)
        if not auth:
            raise ValueError(f"Authorization {auth_id} not found")
        return auth

    def get_capture(self, capture_id: str) -> Dict[str, Any]:
        cap = self.captures.get(capture_id)
        if not cap:
            raise ValueError(f"Capture {capture_id} not found")
        return cap

    def verify_webhook_signature(self, headers: Dict[str, str], raw_body: str, webhook_id: str) -> bool:
        # Mock gateway accepts webhooks with valid simulation headers
        return headers.get("paypal-transmission-sig") != "INVALID"

