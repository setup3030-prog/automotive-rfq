"""
Vercel ASGI entry point.
Adds the project root to sys.path so the `backend` package is importable,
then re-exports the FastAPI app instance for Vercel's Python runtime.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.main import app  # noqa: F401  — Vercel picks up `app` by name
