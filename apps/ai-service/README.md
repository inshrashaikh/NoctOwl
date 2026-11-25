# NoctOwl AI Service

FastAPI microservice providing deterministic night-travel risk scoring (`POST /risk/assess`) for NoctOwl (M3 MVP).

## Local Development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Tests

```bash
pytest -v --cov=app --cov-report=term-missing
```
