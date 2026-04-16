"""
Vercel ASGI entry point.

On Vercel Lambda, files land in /var/task/:
  /var/task/api/index.py        ← this file
  /var/task/backend/app/main.py ← FastAPI app
  /var/task/backend/app/...     ← routers, services, etc.

backend/app/* uses bare  `from app.xxx import ...`  (designed to run with
`uvicorn` started from the backend/ dir).  We must add /var/task/backend
to sys.path so those intra-package imports resolve correctly.
"""

import sys

for path in ('/var/task', '/var/task/backend'):
    if path not in sys.path:
        sys.path.insert(0, path)

from backend.app.main import app  # noqa: F401  — Vercel picks up `app` by name
