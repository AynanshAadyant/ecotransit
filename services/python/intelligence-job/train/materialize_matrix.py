import asyncio
import math
import sys
from pathlib import Path

# Add shared/python to sys.path
workspace_root = Path(__file__).resolve().parents[4]
shared_path = workspace_root / "shared" / "python"
if str(shared_path) not in sys.path:
    sys.path.insert(0, str(shared_path))

train_dir = Path(__file__).resolve().parent
if str(train_dir) not in sys.path:
    sys.path.insert(0, str(train_dir))

import numpy as np
import pandas as pd
import asyncpg
import joblib

from ecotransit_shared.config import DatabaseSettings

async def materialize():
    repo_root = Path('.').resolve()
    artifacts_dir = repo_root / "services/python/intelligence-job/artifacts"
    models_dir = repo_root / "models/linear_regression"
    
    featurized_csv = artifacts_dir / "featurized_traversal_samples.csv"
    segments_csv = artifacts_dir / "static_route_segments.csv"
    model_path = models_dir / "model.joblib"
    
    if not featurized_csv.exists() or not model_path.exists():
        print("Missing featurized samples or model artifact.")
        return
        
    print("Loading featurized samples and model...")
    feat_df = pd.read_csv(featurized_csv)
    model = joblib.load(model_path)
    
    # Load segment distances
    seg_df = pd.read_csv(segments_csv)
    seg_dist_map = dict(zip(seg_df["segment_id"], seg_df["distance_meters"]))
    
    # Empirical stats per (segment_id, hour_of_day, day_type)
    grouped = feat_df.groupby(["segment_id", "hour_of_day", "day_type"])
    stats = grouped.agg(
        sample_count=("travel_seconds", "count"),
        naive_avg_seconds=("travel_seconds", "mean"),
        variance_score=("travel_seconds", lambda s: float(np.var(s)) if len(s) > 1 else 0.0),
    ).reset_index()
    stats_map = {
        (row["segment_id"], row["hour_of_day"], row["day_type"]): row
        for _, row in stats.iterrows()
    }
    
    unique_segments = sorted(feat_df["segment_id"].unique())
    day_types = ["weekday", "saturday", "sunday"]
    hours = list(range(24))
    
    grid_rows = []
    for seg_id in unique_segments:
        dist = seg_dist_map.get(seg_id, 450.0)
        for d in day_types:
            for h in hours:
                st = stats_map.get((seg_id, h, d))
                cnt = int(st["sample_count"]) if st is not None else 0
                avg = float(st["naive_avg_seconds"]) if st is not None else None
                var = float(st["variance_score"]) if st is not None else 0.0
                grid_rows.append({
                    "segment_id": int(seg_id),
                    "hour_of_day": int(h),
                    "day_type": d,
                    "distance_meters": dist,
                    "sample_count": cnt,
                    "naive_avg_seconds": avg,
                    "variance_score": var,
                })
                
    predict_df = pd.DataFrame(grid_rows)
    print(f"Generating predictions for {len(predict_df):,} discrete cells...")
    
    # Vectorized model prediction
    ml_preds = model.predict(predict_df[["segment_id", "hour_of_day", "day_type", "distance_meters"]])
    predict_df["ml_predicted_seconds"] = np.clip(ml_preds, a_min=10.0, a_max=3600.0)
    
    records = [
        (
            int(r["segment_id"]),
            int(r["hour_of_day"]),
            str(r["day_type"]),
            int(r["sample_count"]),
            float(r["naive_avg_seconds"]) if pd.notnull(r["naive_avg_seconds"]) else None,
            float(r["ml_predicted_seconds"]),
            float(r["variance_score"]),
        )
        for _, r in predict_df.iterrows()
    ]
    
    db = DatabaseSettings()
    print(f"Connecting to Postgres at {db.postgres_host}:{db.postgres_port}...")
    conn = await asyncpg.connect(db.dsn)
    
    try:
        print("Inserting records into route_segment_traversal_matrix_staging...")
        await conn.execute("TRUNCATE route_segment_traversal_matrix_staging")
        
        await conn.copy_records_to_table(
            "route_segment_traversal_matrix_staging",
            records=records,
            columns=[
                "segment_id",
                "hour_of_day",
                "day_type",
                "sample_count",
                "naive_avg_seconds",
                "ml_predicted_seconds",
                "variance_score",
            ],
        )
        
        print("Executing atomic transaction swap into route_segment_traversal_matrix...")
        async with conn.transaction():
            await conn.execute("TRUNCATE route_segment_traversal_matrix")
            await conn.execute("""
                INSERT INTO route_segment_traversal_matrix (
                    segment_id, hour_of_day, day_type, sample_count,
                    naive_avg_seconds, ml_predicted_seconds, variance_score
                )
                SELECT
                    segment_id, hour_of_day, day_type, sample_count,
                    naive_avg_seconds, ml_predicted_seconds, variance_score
                FROM route_segment_traversal_matrix_staging
            """)
            await conn.execute("TRUNCATE route_segment_traversal_matrix_staging")
            
        count = await conn.fetchval("SELECT COUNT(*) FROM route_segment_traversal_matrix")
        print(f"[OK] Successfully materialized {count:,} cells into route_segment_traversal_matrix!")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(materialize())
