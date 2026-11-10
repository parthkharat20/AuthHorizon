"""
AuthHorizon PayPal REST v2 Gateway Implementation
Real sandbox API calls with OAuth token caching, idempotency headers, and strict error handling.
"""

import os
import time
import requests
from typing import Dict, Any, List, Optional
from backend.gateway.base import PayPalGatewayInterface

class PayPalGateway(PayPalGatewayInterface):
    def __init__(self, client_id: str, client_secret: str, api_base: str = "https://api-m.sandbox.paypal.com"):
        self.client_id = client_id
        self.client_secret = client_secret
        self.api_base = api_base
        self._cached_token: Optional[str] = None
        self._token_expires_at: float = 0.0

    def get_access_token(self) -> str:
        """Fetch or return cached OAuth2 access token."""
        # Buffer 60 seconds before expiration
        if self._cached_token and time.time() < (self._token_expires_at - 60):
            return self._cached_token

        url = f"{self.api_base}/v1/oauth2/token"
        headers = {"Accept": "application/json", "Accept-Language": "en_US"}
        data = {"grant_type": "client_credentials"}
        
        resp = requests.post(url, auth=(self.client_id, self.client_secret), headers=headers, data=data, timeout=15)
        if resp.status_code != 200:
            raise RuntimeError(f"PayPal OAuth error ({resp.status_code}): {resp.text}")

        data = resp.json()
        self._cached_token = data["access_token"]
        self._token_expires_at = time.time() + data.get("expires_in", 32400)
        return self._cached_token

    def _headers(self, request_id: Optional[str] = None) -> Dict[str, str]:
        token = self.get_access_token()
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        }
        if request_id:
            headers["PayPal-Request-Id"] = request_id
        return headers

    def create_order(self, items: List[Dict[str, Any]], total_amount: float, request_id: str) -> Dict[str, Any]:
        url = f"{self.api_base}/v2/checkout/orders"
        
        # Build items payload
        paypal_items = []
        for it in items:
            paypal_items.append({
                "name": it["name"],
                "sku": it["sku"],
                "unit_amount": {
                    "currency_code": "USD",
                    "value": f"{it['unit_amount']:.2f}"
                },
                "quantity": str(it.get("quantity", 1)),
                "category": "PHYSICAL_GOODS"
            })

        payload = {
            "intent": "AUTHORIZE",
            "purchase_units": [
                {
                    "reference_id": f"PU-{request_id[:8]}",
                    "amount": {
                        "currency_code": "USD",
                        "value": f"{total_amount:.2f}",
                        "breakdown": {
                            "item_total": {
                                "currency_code": "USD",
                                "value": f"{total_amount:.2f}"
                            }
                        }
                    },
                    "items": paypal_items
                }
            ],
            "application_context": {
                "return_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:8000')}/checkout/success",
                "cancel_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:8000')}/checkout/cancel",
                "user_action": "CONTINUE"
            }
        }

        resp = requests.post(url, headers=self._headers(request_id), json=payload, timeout=20)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"PayPal create_order error ({resp.status_code}): {resp.text}")
        return resp.json()

    def authorize_order(self, paypal_order_id: str, request_id: str) -> Dict[str, Any]:
        url = f"{self.api_base}/v2/checkout/orders/{paypal_order_id}/authorize"
        resp = requests.post(url, headers=self._headers(request_id), json={}, timeout=20)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"PayPal authorize_order error ({resp.status_code}): {resp.text}")
        return resp.json()

    def capture_authorization(self, auth_id: str, amount: float, final_capture: bool, request_id: str, note: str = "") -> Dict[str, Any]:
        url = f"{self.api_base}/v2/payments/authorizations/{auth_id}/capture"
        payload = {
            "amount": {
                "currency_code": "USD",
                "value": f"{amount:.2f}"
            },
            "final_capture": final_capture,
            "note_to_payer": note or ("Final capture" if final_capture else "Partial shipment capture")
        }
        resp = requests.post(url, headers=self._headers(request_id), json=payload, timeout=20)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"PayPal capture error ({resp.status_code}): {resp.text}")
        return resp.json()

    def void_authorization(self, auth_id: str) -> Dict[str, Any]:
        url = f"{self.api_base}/v2/payments/authorizations/{auth_id}/void"
        resp = requests.post(url, headers=self._headers(), json={}, timeout=20)
        if resp.status_code not in (200, 204):
            raise RuntimeError(f"PayPal void error ({resp.status_code}): {resp.text}")
        if resp.text:
            return resp.json()
        return {"id": auth_id, "status": "VOIDED"}

    def get_authorization(self, auth_id: str) -> Dict[str, Any]:
        url = f"{self.api_base}/v2/payments/authorizations/{auth_id}"
        resp = requests.get(url, headers=self._headers(), timeout=15)
        if resp.status_code != 200:
            raise RuntimeError(f"PayPal get_authorization error ({resp.status_code}): {resp.text}")
        return resp.json()

    def get_capture(self, capture_id: str) -> Dict[str, Any]:
        url = f"{self.api_base}/v2/payments/captures/{capture_id}"
        resp = requests.get(url, headers=self._headers(), timeout=15)
        if resp.status_code != 200:
            raise RuntimeError(f"PayPal get_capture error ({resp.status_code}): {resp.text}")
        return resp.json()

    def verify_webhook_signature(self, headers: Dict[str, str], raw_body: str, webhook_id: str) -> bool:
        url = f"{self.api_base}/v1/notifications/verify-webhook-signature"
        import json
        try:
            event_body = json.loads(raw_body)
        except Exception:
            return False

        payload = {
            "auth_algo": headers.get("paypal-auth-algo", ""),
            "cert_url": headers.get("paypal-cert-url", ""),
            "transmission_id": headers.get("paypal-transmission-id", ""),
            "transmission_sig": headers.get("paypal-transmission-sig", ""),
            "transmission_time": headers.get("paypal-transmission-time", ""),
            "webhook_id": webhook_id,
            "webhook_event": event_body
        }
        resp = requests.post(url, headers=self._headers(), json=payload, timeout=15)
        if resp.status_code != 200:
            return False
        return resp.json().get("verification_status") == "SUCCESS"

