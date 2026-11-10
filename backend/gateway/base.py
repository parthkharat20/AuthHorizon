"""
AuthHorizon PayPal Gateway Interface
Abstract base class for payment operations (mock and real sandbox).
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List

class PayPalGatewayInterface(ABC):
    @abstractmethod
    def create_order(self, items: List[Dict[str, Any]], total_amount: float, request_id: str) -> Dict[str, Any]:
        """Create a PayPal order with intent=AUTHORIZE."""
        pass

    @abstractmethod
    def authorize_order(self, paypal_order_id: str, request_id: str) -> Dict[str, Any]:
        """Authorize the approved order."""
        pass

    @abstractmethod
    def capture_authorization(self, auth_id: str, amount: float, final_capture: bool, request_id: str, note: str = "") -> Dict[str, Any]:
        """Capture all or part of an authorization."""
        pass

    @abstractmethod
    def void_authorization(self, auth_id: str) -> Dict[str, Any]:
        """Void an authorization hold."""
        pass

    @abstractmethod
    def get_authorization(self, auth_id: str) -> Dict[str, Any]:
        """Retrieve current authorization details for reconciliation."""
        pass

    @abstractmethod
    def get_capture(self, capture_id: str) -> Dict[str, Any]:
        """Retrieve current capture details for reconciliation."""
        pass

    @abstractmethod
    def verify_webhook_signature(self, headers: Dict[str, str], raw_body: str, webhook_id: str) -> bool:
        """Verify the cryptographic signature of an incoming PayPal webhook."""
        pass

