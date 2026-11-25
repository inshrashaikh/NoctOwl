import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure `app` package is importable when pytest runs from apps/ai-service
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import app  # noqa: E402


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)
