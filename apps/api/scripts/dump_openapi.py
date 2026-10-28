"""Write the OpenAPI schema to a file (used to generate the frontend's TypeScript types).

Usage: python -m scripts.dump_openapi ../web/openapi.json
"""

import json
import sys
from pathlib import Path

from app.main import app

out = Path(sys.argv[1] if len(sys.argv) > 1 else "openapi.json")
out.write_text(json.dumps(app.openapi(), indent=2), encoding="utf-8")
print(f"Wrote {out}")
