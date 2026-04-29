from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from ingest.runner import ingest_ticker


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/ingest_filing.py <TICKER>")

    result = ingest_ticker(sys.argv[1])
    print(json.dumps(result))


if __name__ == "__main__":
    main()
