"""Convenience entry point to launch the Intelligence Job ETA Server."""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Ensure service directory and root repo are on sys.path
service_dir = Path(__file__).resolve().parent
repo_root = service_dir.parents[2]
sys.path.insert(0, str(service_dir))
sys.path.insert(0, str(repo_root / "shared" / "python"))

load_dotenv(repo_root / ".env")

import uvicorn  # noqa: E402

if __name__ == "__main__":
    host = os.getenv("ETA_SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("PORT_INTELLIGENCE_SERVICE", os.getenv("ETA_SERVICE_PORT", "8002")))
    reload = os.getenv("STATUS", "development") == "development"
    print(f"Starting EcoTransit ETA Microservice on http://{host}:{port} (reload={reload})")
    uvicorn.run("server:app", host=host, port=port, reload=reload)
