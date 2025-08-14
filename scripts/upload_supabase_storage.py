#!/usr/bin/env python3
import os
import sys
from pathlib import Path
import mimetypes
import requests


def upload_object(supabase_url: str, service_role: str, bucket: str, local_path: Path, object_path: str) -> str:
    api = supabase_url.rstrip('/') + f"/storage/v1/object/{bucket}/{object_path}"
    mime, _ = mimetypes.guess_type(str(local_path))
    headers = {
        "Authorization": f"Bearer {service_role}",
        "apikey": service_role,
        "x-upsert": "true",
        "Content-Type": mime or "application/octet-stream",
    }
    data = local_path.read_bytes()
    r = requests.put(api, headers=headers, data=data, timeout=60)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Upload failed for {object_path}: {r.status_code} {r.text}")
    # public URL helper
    public_url = supabase_url.rstrip('/') + f"/storage/v1/object/public/{bucket}/{object_path}"
    return public_url


def main():
    supabase_url = os.getenv("SUPABASE_URL")
    service_role = os.getenv("SUPABASE_SERVICE_ROLE")
    bucket = os.getenv("SUPABASE_PUBLIC_BUCKET", "pulse-public")
    if not supabase_url or not service_role:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required in env", file=sys.stderr)
        sys.exit(2)

    project_root = Path(__file__).resolve().parents[1]
    processed_dir = project_root / "backend" / "data" / "processed"
    derived_dir = processed_dir / "derived"

    uploads = [
        (processed_dir / "nigeria_states.geojson", "snapstats/nigeria_states.geojson"),
        (derived_dir / "zone_stats.json", "snapstats/derived/zone_stats.json"),
        (derived_dir / "party_stats.json", "snapstats/derived/party_stats.json"),
        (derived_dir / "tribe_stats.json", "snapstats/derived/tribe_stats.json"),
        (derived_dir / "demographics.json", "snapstats/derived/demographics.json"),
    ]

    print(f"Uploading to bucket '{bucket}' at {supabase_url} ...")
    for local, remote in uploads:
        if not local.exists():
            print(f"SKIP (missing): {local}")
            continue
        public = upload_object(supabase_url, service_role, bucket, local, remote)
        print(f"OK {remote} -> {public}")


if __name__ == "__main__":
    main()


