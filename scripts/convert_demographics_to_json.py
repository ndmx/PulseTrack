#!/usr/bin/env python3
"""
Regenerate Snapstats demographic assets from the canonical dataset.

This script consumes the base `state_demographics.json` file (or any file with
the same shape) and produces the derived JSON assets used by the frontend.
It also aggregates zone statistics by inspecting `nigeria_states.geojson`.

Usage:
    python scripts/convert_demographics_to_json.py \
        --source frontend/public/snapstats/state_demographics.json \
        --geojson frontend/public/snapstats/nigeria_states.geojson \
        --output frontend/public/snapstats/derived
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = PROJECT_ROOT / "frontend" / "public" / "snapstats" / "state_demographics.json"
DEFAULT_GEOJSON = PROJECT_ROOT / "frontend" / "public" / "snapstats" / "nigeria_states.geojson"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "frontend" / "public" / "snapstats" / "derived"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Snapstats demographic assets.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="Path to the canonical state demographics JSON.")
    parser.add_argument("--geojson", type=Path, default=DEFAULT_GEOJSON, help="GeoJSON file containing zone + area metadata.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_DIR, help="Directory where derived JSON files will be written.")
    parser.add_argument("--from-firestore", action="store_true", help="Fetch states from the Firestore `state_demographics` collection instead of reading a local file.")
    parser.add_argument("--service-account", type=Path, help="Optional service-account JSON for Firestore access.")
    parser.add_argument("--save-source", type=Path, default=DEFAULT_SOURCE, help="Where to persist the canonical JSON when fetching from Firestore.")
    return parser.parse_args()


def load_states(path: Path) -> Tuple[List[Dict], Dict]:
    if not path.exists():
        raise FileNotFoundError(f"Source data not found: {path}")

    payload = json.loads(path.read_text())
    states = payload.get("states") if isinstance(payload, dict) else payload
    if not isinstance(states, list):
        raise ValueError("State dataset must be a list or contain a 'states' list.")

    totals = payload.get("totals")
    if not totals:
        totals = {
            "total_population": sum(int(s.get("total_population", 0)) for s in states),
            "voting_age_population": sum(int(s.get("voting_age_population", 0)) for s in states),
            "registered_voters": sum(int(s.get("registered_voters", 0)) for s in states),
        }

    return states, totals


def load_states_from_firestore(service_account: Path | None) -> Tuple[List[Dict], Dict]:
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore  # type: ignore
    except ImportError as exc:
        raise RuntimeError("firebase_admin must be installed to fetch from Firestore.") from exc

    if not firebase_admin._apps:
        if service_account:
            cred = credentials.Certificate(service_account)
        else:
            cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)

    client = firestore.client()
    docs = client.collection("state_demographics").stream()
    states: List[Dict] = []
    for doc in docs:
        data = doc.to_dict() or {}
        data.setdefault("state", doc.id)
        states.append(data)

    totals = {
        "total_population": sum(int(s.get("total_population", 0)) for s in states),
        "voting_age_population": sum(int(s.get("voting_age_population", 0)) for s in states),
        "registered_voters": sum(int(s.get("registered_voters", 0)) for s in states),
    }
    return states, totals


def normalize_key(value: str | None) -> str:
    if not value:
        return ""
    return "".join(ch for ch in value.lower() if ch.isalnum())


def compute_party_stats(states: Iterable[Dict]) -> List[Dict]:
    counter = Counter()
    for state in states:
        party = (state.get("political_affiliation") or "Unknown").strip() or "Unknown"
        counter[party] += 1
    return [
        {"party": party, "stateCount": count}
        for party, count in counter.most_common()
    ]


def compute_zone_stats(geojson_path: Path) -> List[Dict]:
    if not geojson_path.exists():
        print(f"⚠️  GeoJSON not found at {geojson_path}. Skipping zone stats.")
        return []

    payload = json.loads(geojson_path.read_text())
    features = payload.get("features") or []
    zones: Dict[str, Dict[str, float]] = defaultdict(lambda: {"Zone": "", "stateCount": 0, "totalArea": 0.0})

    for feature in features:
        props = feature.get("properties") or {}
        zone = props.get("Zone") or "Unknown"
        area = float(props.get("area_km2") or 0)

        entry = zones[zone]
        entry["Zone"] = zone
        entry["stateCount"] += 1
        entry["totalArea"] += area

    return sorted(zones.values(), key=lambda row: row["Zone"])


def write_json(path: Path, data: Dict | List) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))
    print(f"✓ Wrote {path.relative_to(PROJECT_ROOT)}")


def main() -> None:
    args = parse_args()
    if args.from_firestore:
        states, totals = load_states_from_firestore(args.service_account)
    else:
        states, totals = load_states(args.source)
    states_sorted = sorted(states, key=lambda s: s.get("state", ""))

    derived_dir = args.output

    demographics_payload = {
        "totals": totals,
        "states": states_sorted,
    }
    write_json(derived_dir / "demographics.json", demographics_payload)
    if args.from_firestore and args.save_source:
        write_json(args.save_source, demographics_payload)

    party_stats = compute_party_stats(states_sorted)
    write_json(derived_dir / "party_stats.json", party_stats)

    zone_stats = compute_zone_stats(args.geojson)
    if zone_stats:
        write_json(derived_dir / "zone_stats.json", zone_stats)

    print("Done.")


if __name__ == "__main__":
    main()

