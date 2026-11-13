#!/usr/bin/env python3
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(backend_dir))

from verify_ledger import main

if __name__ == "__main__":
    main()
