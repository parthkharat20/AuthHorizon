"""
Pytest global fixtures for AuthHorizon test suite.
"""

import pytest
from backend.database import init_db

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Ensure database schema is created and migrated once per test session."""
    init_db()
