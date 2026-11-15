"""Build web/data/sites.json from the curated inputs and the cached POWER data.

Usage:  python pipeline/build_sites.py

Runs fully offline: it only reads pipeline/*.yaml, pipeline/candidates.csv and
data/cache/. Sites without a cached POWER response get explicit nulls for every
climate feature (the frontend shows these as "no data" and scores them 0).
Run pipeline/fetch_power.py first to (re)fill the cache.
"""
from __future__ import annotations

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
PIPE = ROOT / "pipeline"
CACHE = ROOT / "data" / "cache"
OUT = ROOT / "web" / "data" / "sites.json"

MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
FILL = -999.0

# Feature catalogue: how each derived feature is computed and labelled.
FEATURES = {
    "t2m_c":        {"label": "Mean 2 m temperature", "unit": "°C", "source": "NASA POWER T2M (annual)"},
    "t2m_min_c":    {"label": "Coldest monthly minimum", "unit": "°C", "source": "NASA POWER T2M_MIN (annual)"},
    "t2m_max_c":    {"label": "Hottest monthly maximum", "unit": "°C", "source": "NASA POWER T2M_MAX (annual)"},
    "t2m_range_c":  {"label": "Mean diurnal range", "unit": "°C", "source": "NASA POWER T2M_RANGE (annual)"},
    "precip_mm_yr": {"label": "Precipitation", "unit": "mm/yr", "source": "NASA POWER PRECTOTCORR (mm/day × 365)"},
    "uv_mean":      {"label": "Mean UV index", "unit": "", "source": "NASA POWER ALLSKY_SFC_UV_INDEX (annual)"},
    "uv_peak":      {"label": "Peak-month UV index", "unit": "", "source": "NASA POWER ALLSKY_SFC_UV_INDEX (max month)"},
    "ps_kpa":       {"label": "Surface pressure", "unit": "kPa", "source": "NASA POWER PS (annual)"},
    "ws10m":        {"label": "Mean 10 m wind speed", "unit": "m/s", "source": "NASA POWER WS10M (annual)"},
    "elevation_m":  {"label": "Elevation (POWER 0.5° cell)", "unit": "m", "source": "NASA POWER grid elevation"},
    "abs_lat":      {"label": "Absolute latitude", "unit": "°", "source": "Site coordinates"},
}
CLIMATE_FEATURES = [k for k in FEATURES if k != "abs_lat"]


def clean(value):
    if value is None or value == FILL:
        return None
    return float(value)


def r(value, nd=2):
    return None if value is None else round(value, nd)


def derive_features(power: dict | None) -> tuple[dict, dict | None]:
    feats = {k: None for k in CLIMATE_FEATURES}
    if not power:
        return feats, None
    p = power.get("properties", {}).get("parameter", {})

    def ann(name):
        return clean(p.get(name, {}).get("ANN"))

    def monthly(name):
        vals = [clean(p.get(name, {}).get(m)) for m in MONTHS]
        return [v for v in vals if v is not None]

    precip = ann("PRECTOTCORR")
    uv_months = monthly("ALLSKY_SFC_UV_INDEX")
    tmin = monthly("T2M_MIN")
    tmax = monthly("T2M_MAX")
    feats.update({
        "t2m_c": r(ann("T2M")),
        "t2m_min_c": r(min(tmin)) if tmin else r(ann("T2M_MIN")),
        "t2m_max_c": r(max(tmax)) if tmax else r(ann("T2M_MAX")),
        "t2m_range_c": r(ann("T2M_RANGE")),
        "precip_mm_yr": r(precip * 365, 0) if precip is not None else None,
        "uv_mean": r(ann("ALLSKY_SFC_UV_INDEX")),
        "uv_peak": r(max(uv_months)) if uv_months else None,
        "ps_kpa": r(ann("PS")),
        "ws10m": r(ann("WS10M")),
    })
    coords = power.get("geometry", {}).get("coordinates", [])
    grid = None
    if len(coords) >= 3:
        feats["elevation_m"] = r(clean(coords[2]), 0)
        grid = {"lon": coords[0], "lat": coords[1]}
    return feats, grid


def load_yaml(name: str) -> dict:
    with (PIPE / name).open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def main() -> int:
    reqs = load_yaml("requirements.yaml")
    targets = load_yaml("targets.yaml")["targets"]
    with (PIPE / "candidates.csv").open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    sites, missing = [], []
    for row in rows:
        cache = CACHE / f"power_{row['id']}.json"
        power = json.loads(cache.read_text(encoding="utf-8")) if cache.exists() else None
        if power is None:
            missing.append(row["id"])
        feats, grid = derive_features(power)
        lat, lon = float(row["lat"]), float(row["lon"])
        feats["abs_lat"] = round(abs(lat), 2)
        sites.append({
            "id": row["id"],
            "name": row["name"],
            "country": row["country"],
            "lat": lat,
            "lon": lon,
            "tags": [t.strip() for t in row["tags"].split(";") if t.strip()],
            "is_known_analog": row["is_known_analog"].strip().lower() == "true",
            "access_tier": int(row["access_tier"]),
            "description": row["description"],
            "citation_url": row["citation_url"],
            "features": feats,
            "power_cell": grid,
        })

    out = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "features": FEATURES,
        "requirements": reqs["requirements"],
        "presets": reqs["presets"],
        "gaps": reqs["gaps"],
        "targets": targets,
        "sites": sites,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")

    nulls = {k: sum(1 for s in sites if s["features"][k] is None) for k in FEATURES}
    print(f"wrote {OUT.relative_to(ROOT)}: {len(sites)} sites, {len(reqs['requirements'])} requirements")
    print("null counts per feature:", {k: v for k, v in nulls.items() if v} or "none")
    if missing:
        print(f"WARNING: no cached POWER data for {len(missing)} sites: {', '.join(missing)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
