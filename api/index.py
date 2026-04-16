"""
Vercel ASGI entry point.
"""

import sys
import os

# Project root — works both locally and on Vercel Lambda (/var/task/)
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

# Also try /var/task explicitly (Vercel Lambda working directory)
if '/var/task' not in sys.path:
    sys.path.insert(0, '/var/task')

from backend.app.main import app  # noqa: F401  — Vercel picks up `app` by name
