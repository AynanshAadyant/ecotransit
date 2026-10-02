"""EcoTransit Ingestion Worker - Verification Service.

Verifies consumption of ecotransit_shared schemas, contracts, and utilities.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

# Add shared/python to sys.path for workspace resolution
workspace_root = Path(__file__).resolve().parents[3]
shared_path = workspace_root / "shared" / "python"
if str(shared_path) not in sys.path:
    sys.path.insert(0, str(shared_path))

from ecotransit_shared import __version__ as shared_version  # noqa: E402
from ecotransit_shared.contracts.ingestion import ISink  # noqa: E402
from ecotransit_shared.geo import is_in_bounding_box, is_valid_coordinate  # noqa: E402
from ecotransit_shared.logging import create_logger  # noqa: E402
from ecotransit_shared.schemas import (  # noqa: E402
    HealthStatus,
    SinkResult,
    VehiclePosition,
)


def run_verification() -> int:
    logger = create_logger("ingestion-worker-verify")
    logger.info(f"Ingestion Worker starting with shared package v{shared_version}")

    # 1. Verify schema instantiation
    sample_pos = VehiclePosition(
        vehicle_id="DL1PC9999",
        route_id="419",
        latitude=28.6139,
        longitude=77.2090,
        speed=12.5,
        bearing=180.0,
        timestamp=int(time.time()),
    )
    assert sample_pos.vehicle_id == "DL1PC9999"

    # 2. Verify geo validation
    in_delhi = is_in_bounding_box(
        lat=sample_pos.latitude,
        lon=sample_pos.longitude,
        min_lat=28.30,
        max_lat=28.95,
        min_lon=76.80,
        max_lon=77.55,
    )
    assert in_delhi is True
    assert is_valid_coordinate(sample_pos.latitude, sample_pos.longitude) is True

    # 3. Verify ISink & contracts definition
    class VerificationSink(ISink):
        @property
        def is_critical(self) -> bool:
            return True

        async def write(self, batch: list[VehiclePosition]) -> SinkResult:
            return SinkResult(written_count=len(batch))

        async def health(self) -> HealthStatus:
            return HealthStatus(status="healthy", details={"worker": "verified"})

    sink = VerificationSink()
    assert sink.is_critical is True

    logger.info("Ingestion Worker verification successfully passed!")
    print("Ingestion Worker verification: OK")
    return 0


if __name__ == "__main__":
    sys.exit(run_verification())
