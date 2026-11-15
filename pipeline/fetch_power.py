"""Fetch NASA POWER climatology for every Earth candidate site and cache it.

Usage:  python pipeline/fetch_power.py [--force]

Writes one raw JSON response per site to data/cache/power_<id>.json. Sites that
already have a cached response are skipped unless --force is given, so the
pipeline can always be re-run offline from the cache.
"""
from __future__ import annotations

import csv
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CANDIDATES = ROOT / "pipeline" / "candidates.csv"
CACHE = ROOT / "data" / "cache"

API = "https://power.larc.nasa.gov/api/temporal/climatology/point"
PARAMS_URL = "https://power.larc.nasa.gov/api/system/manager/parameters"
# Requested POWER parameters. If the API rejects one, we look up the closest
# valid name and log the substitution (see README "POWER parameter log").
PARAMETERS = [
    "T2M", "T2M_MIN", "T2M_MAX", "T2M_RANGE",
    "PRECTOTCORR", "ALLSKY_SFC_UV_INDEX", "PS", "WS10M",
]
FALLBACKS = {"PRECTOTCORR": "PRECTOT", "ALLSKY_SFC_UV_INDEX": "ALLSKY_SFC_UVB"}


def cache_path(site_id: str) -> Path:
    return CACHE / f"power_{site_id}.json"


def fetch(lat: float, lon: float, params: list[str]) -> dict:
    query = urllib.parse.urlencode({
        "parameters": ",".join(params),
        "community": "RE",
        "latitude": lat,
        "longitude": lon,
        "format": "JSON",
    })
    req = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": "terratwin-pipeline"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def fetch_with_substitution(lat: float, lon: float) -> dict:
    params = list(PARAMETERS)
    try:
        return fetch(lat, lon, params)
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", "replace")
        if err.code != 422:
            raise
        # Parameter rejected: swap in the documented fallback and retry once.
        rejected = [p for p in params if p in body]
        print(f"  POWER rejected {rejected}; substituting fallbacks", file=sys.stderr)
        params = [FALLBACKS.get(p, p) if p in rejected else p for p in params]
        data = fetch(lat, lon, params)
        data["_substitutions"] = {p: FALLBACKS.get(p) for p in rejected}
        return data


def main() -> int:
    force = "--force" in sys.argv
    CACHE.mkdir(parents=True, exist_ok=True)
    with CANDIDATES.open(newline="", encoding="utf-8") as fh:
        sites = list(csv.DictReader(fh))

    fetched = skipped = failed = 0
    for site in sites:
        path = cache_path(site["id"])
        if path.exists() and not force:
            skipped += 1
            continue
        print(f"fetching {site['id']} ({site['lat']}, {site['lon']})")
        for attempt in range(3):
            try:
                data = fetch_with_substitution(float(site["lat"]), float(site["lon"]))
                path.write_text(json.dumps(data, indent=1), encoding="utf-8")
                fetched += 1
                break
            except (urllib.error.URLError, TimeoutError) as err:
                print(f"  attempt {attempt + 1} failed: {err}", file=sys.stderr)
                time.sleep(2 * (attempt + 1))
        else:
            failed += 1
        time.sleep(0.3)  # be polite to the public API

    print(f"done: {fetched} fetched, {skipped} cached, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
