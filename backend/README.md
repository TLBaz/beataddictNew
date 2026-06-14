# Beat Addicts AI Backend

## Run locally

1. Install deps

```bash
pip install -r requirements.txt
```

2. Set env

```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

3. Start API

```bash
uvicorn app.main:app --reload --port 8000
```
