import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

# Resolve `.env` next to this package — avoids missing vars when cwd is repo root / IDE tasks.
_BACKEND_ROOT = Path(__file__).resolve().parent
load_dotenv(_BACKEND_ROOT / ".env")

_url = os.environ.get("SUPABASE_URL")
_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not _url or not _key:
    raise RuntimeError(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. "
        f"Expected a .env file at {_BACKEND_ROOT / '.env'} (loaded automatically from the backend package)."
    )

supabase: Client = create_client(_url, _key)
