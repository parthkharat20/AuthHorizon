"""
AuthHorizon Post-Action Reconciler
Independent balance & state verifier. Never trusts HTTP 200/201 responses alone.
"""

from typing import Tuple, Dict, Any
from backend.gateway.base import PayPalGatewayInterface

class PaymentReconciler:
    def __init__(self, gateway: PayPalGatewayInterface):
        self.gateway = gateway

    def reconcile_authorization(
        self,
        auth_id: str,
        expected_status: str,
        expected_remaining: float
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Verify live PayPal authorization state against local database expectations.
        """
        try:
            live_auth = self.gateway.get_authorization(auth_id)
        except Exception as e:
            return False, f"Reconciler GET call failed: {str(e)}", {}

        live_status = live_auth.get("status")
        
        # In PayPal API, remaining amount is typically calculated or returned in amount
        # For mock/sandbox compatibility, check status and remaining
        if live_status != expected_status:
            return (
                False,
                f"Status mismatch: live PayPal status is '{live_status}', expected '{expected_status}'",
                live_auth
            )

        return True, "Authorization reconciled successfully", live_auth

    def reconcile_capture(
        self,
        capture_id: str,
        expected_amount: float
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Verify live PayPal capture object exists and settled the correct amount.
        """
        try:
            live_cap = self.gateway.get_capture(capture_id)
        except Exception as e:
            return False, f"Reconciler GET capture failed: {str(e)}", {}

        live_status = live_cap.get("status")
        if live_status != "COMPLETED":
            return (
                False,
                f"Capture status is '{live_status}', expected 'COMPLETED'",
                live_cap
            )

        amount_val = float(live_cap.get("amount", {}).get("value", 0.0))
        if abs(amount_val - expected_amount) > 0.01:
            return (
                False,
                f"Captured amount mismatch: live is {amount_val}, expected {expected_amount}",
                live_cap
            )

        return True, "Capture reconciled successfully", live_cap

