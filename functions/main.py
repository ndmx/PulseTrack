# Firebase Cloud Functions (Python 3.12)
# Deploy with: firebase deploy --only functions

import csv
import hashlib
import hmac
import io
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

from firebase_functions import https_fn, scheduler_fn, params
from firebase_admin import initialize_app, firestore
import google.cloud.firestore

# Initialize Firebase Admin
initialize_app()

# ---------------------------------------------------------------------------
# Ingestion constants & helpers
# ---------------------------------------------------------------------------
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 5
RATE_LIMIT_COLLECTION = "submission_rate_limits"
INGEST_VERSION = "2025-11-27"
RAW_INPUT_BATCH_LIMIT = 500
WRITE_BATCH_CHUNK = 400
DAILY_AGG_COLLECTION = "approval_trends_daily"
MONTHLY_AGG_COLLECTION = "approval_trends_monthly"

_rate_limit_cache: Dict[str, List[float]] = {}
ADMIN_API_KEY_SECRET = params.SecretParam("ADMIN_API_KEY")

CANDIDATE_MAP = {
    "tinubu": "Tinubu",
    "bola tinubu": "Tinubu",
    "asiwaju": "Tinubu",
    "obi": "Obi",
    "peter obi": "Obi",
    "labour": "Obi",
    "labour party": "Obi",
    "atiku": "Atiku",
    "atiku abubakar": "Atiku",
    "pdp": "Atiku",
}

STATE_ZONE_BASE = {
    "abia": ("Abia", "South East"),
    "adamawa": ("Adamawa", "North East"),
    "akwa ibom": ("Akwa Ibom", "South South"),
    "anambra": ("Anambra", "South East"),
    "bauchi": ("Bauchi", "North East"),
    "bayelsa": ("Bayelsa", "South South"),
    "benue": ("Benue", "North Central"),
    "borno": ("Borno", "North East"),
    "cross river": ("Cross River", "South South"),
    "delta": ("Delta", "South South"),
    "ebonyi": ("Ebonyi", "South East"),
    "edo": ("Edo", "South South"),
    "ekiti": ("Ekiti", "South West"),
    "enugu": ("Enugu", "South East"),
    "gombe": ("Gombe", "North East"),
    "imo": ("Imo", "South East"),
    "jigawa": ("Jigawa", "North West"),
    "kaduna": ("Kaduna", "North West"),
    "kano": ("Kano", "North West"),
    "katsina": ("Katsina", "North West"),
    "kebbi": ("Kebbi", "North West"),
    "kogi": ("Kogi", "North Central"),
    "kwara": ("Kwara", "North Central"),
    "lagos": ("Lagos", "South West"),
    "nasarawa": ("Nasarawa", "North Central"),
    "niger": ("Niger", "North Central"),
    "ogun": ("Ogun", "South West"),
    "ondo": ("Ondo", "South West"),
    "osun": ("Osun", "South West"),
    "oyo": ("Oyo", "South West"),
    "plateau": ("Plateau", "North Central"),
    "rivers": ("Rivers", "South South"),
    "sokoto": ("Sokoto", "North West"),
    "taraba": ("Taraba", "North East"),
    "yobe": ("Yobe", "North East"),
    "zamfara": ("Zamfara", "North West"),
    "federal capital territory": ("Federal Capital Territory", "North Central"),
}


def _canonical_key(value: str) -> str:
    return " ".join(value.strip().lower().replace("-", " ").split())


def _build_state_lookup() -> Dict[str, tuple[str, str]]:
    lookup: Dict[str, tuple[str, str]] = {}
    for raw_key, info in STATE_ZONE_BASE.items():
        canonical = _canonical_key(raw_key)
        lookup[canonical] = info
        lookup[_canonical_key(f"{raw_key} state")] = info
    # Common aliases
    lookup["abuja"] = STATE_ZONE_BASE["federal capital territory"]
    lookup["fct"] = STATE_ZONE_BASE["federal capital territory"]
    lookup["f c t"] = STATE_ZONE_BASE["federal capital territory"]
    return lookup


STATE_ZONE_LOOKUP = _build_state_lookup()


def log_event(event: str, **fields) -> None:
    """Emit structured logs for Cloud Logging / Monitoring."""
    payload = {"event": event, **fields}
    try:
        print(json.dumps(payload))
    except Exception:
        # Fallback to simple print if serialization fails
        print(f"{event}: {fields}")


def json_response(payload: Dict[str, Any], *, status: int = 200) -> https_fn.Response:
    return https_fn.Response(
        json.dumps(payload),
        status=status,
        headers={"Content-Type": "application/json"}
    )


def get_client_ip(req: https_fn.Request) -> str:
    forwarded = req.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return getattr(req, "remote_addr", "") or "unknown"


def _prune_and_store_hits(identifier: str) -> bool:
    """Return True if caller is under the rate limit window."""
    now = time.time()
    hits = _rate_limit_cache.get(identifier, [])
    hits = [ts for ts in hits if now - ts <= RATE_LIMIT_WINDOW_SECONDS]
    if len(hits) >= RATE_LIMIT_MAX_REQUESTS:
        _rate_limit_cache[identifier] = hits
        return False
    hits.append(now)
    _rate_limit_cache[identifier] = hits
    return True


def _rate_limit_doc_id(identifier: str) -> str:
    return hashlib.sha256(identifier.encode("utf-8")).hexdigest()


def enforce_shared_rate_limit(db: google.cloud.firestore.Client, identifier: str) -> bool:
    """Return True when the caller is under the shared Firestore rate limit."""
    doc_ref = db.collection(RATE_LIMIT_COLLECTION).document(_rate_limit_doc_id(identifier))
    transaction = db.transaction()
    now = time.time()

    @firestore.transactional
    def update(transaction):
        snapshot = doc_ref.get(transaction=transaction)
        hits = []
        if snapshot.exists:
            data = snapshot.to_dict() or {}
            hits = [
                float(ts)
                for ts in data.get("hits", [])
                if isinstance(ts, (int, float)) and now - float(ts) <= RATE_LIMIT_WINDOW_SECONDS
            ]

        if len(hits) >= RATE_LIMIT_MAX_REQUESTS:
            transaction.set(
                doc_ref,
                {"hits": hits, "updated_at": firestore.SERVER_TIMESTAMP},
                merge=True,
            )
            return False

        hits.append(now)
        transaction.set(
            doc_ref,
            {"hits": hits, "updated_at": firestore.SERVER_TIMESTAMP},
            merge=True,
        )
        return True

    return bool(update(transaction))


def _normalize_candidate(raw_candidate: str) -> str:
    key = _canonical_key(raw_candidate or "")
    candidate = CANDIDATE_MAP.get(key)
    if not candidate:
        raise ValueError("Unsupported candidate. Choose Tinubu, Obi, or Atiku.")
    return candidate


def _normalize_state(raw_location: str) -> Dict[str, str]:
    if not raw_location:
        raise ValueError("Location / state is required.")
    key = _canonical_key(raw_location)
    canonical_name, zone = STATE_ZONE_LOOKUP.get(key, (raw_location.strip().title(), "Unknown"))
    return {
        "state": canonical_name,
        "zone": zone,
        "state_slug": canonical_name.lower().replace(" ", "-"),
    }


def _compact_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in data.items() if v not in (None, "", [], {}, ())}


def sanitize_submission(payload: Dict[str, Any], *, ingest_via: str) -> Dict[str, Any]:
    content = str(payload.get("content", "")).strip()
    if not content:
        raise ValueError("Opinion content cannot be empty.")
    if len(content) > 500:
        raise ValueError("Opinion content must be 500 characters or less.")

    candidate = _normalize_candidate(str(payload.get("candidate", "")))
    location_info = _normalize_state(str(payload.get("location", "")))

    user_id = str(payload.get("user_id") or payload.get("client_ref") or uuid4())
    source_label = payload.get("source") or ("user_form" if ingest_via == "public_submit" else ingest_via)

    metadata = _compact_dict({
        "client_ref": payload.get("client_ref"),
        "raw_location": payload.get("location"),
        "notes": payload.get("notes"),
    })

    sanitized = {
        "source": source_label,
        "content": content,
        "candidate": candidate,
        "location": location_info["state"],
        "state_zone": location_info["zone"],
        "state_slug": location_info["state_slug"],
        "user_id": user_id,
        "metadata": metadata,
    }
    return _compact_dict(sanitized)


def build_raw_input_doc(
    payload: Dict[str, Any],
    *,
    ingest_via: str,
    client_ip: str | None = None,
    extra_metadata: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    sanitized = sanitize_submission(payload, ingest_via=ingest_via)
    metadata = sanitized.pop("metadata", {})
    if extra_metadata:
        metadata.update(extra_metadata)

    doc: Dict[str, Any] = {
        **sanitized,
        "ingest_via": ingest_via,
        "ingest_version": INGEST_VERSION,
        "timestamp": firestore.SERVER_TIMESTAMP,
        "processed_at": None,
    }
    if client_ip and client_ip != "unknown":
        doc["client_ip"] = client_ip
        metadata.setdefault("client_ip", client_ip)

    metadata = _compact_dict(metadata)
    if metadata:
        doc["metadata"] = metadata
    return doc


def verify_admin_api_key(provided: str | None) -> bool:
    expected = (ADMIN_API_KEY_SECRET.value or "").strip()
    provided = (provided or "").strip()
    return bool(expected) and hmac.compare_digest(provided, expected)


def parse_admin_payload(req: https_fn.Request) -> List[Dict[str, Any]]:
    """Return a list of entries supplied via JSON or CSV upload."""
    if getattr(req, "files", None):
        uploaded = req.files.get("file")
        if uploaded and uploaded.filename:
            text = uploaded.stream.read().decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text))
            rows = [row for row in reader]
            if not rows:
                raise ValueError("CSV file contained no rows.")
            return rows

    payload = req.get_json(silent=True)
    if payload is None:
        raise ValueError("Expected JSON body or 'file' upload with CSV content.")

    if isinstance(payload, list):
        entries = payload
    else:
        entries = payload.get("records") or payload.get("entries")

    if not isinstance(entries, list) or not entries:
        raise ValueError("Payload must include a non-empty 'records' array.")

    return entries


def write_raw_inputs(db: google.cloud.firestore.Client, docs: List[Dict[str, Any]]) -> int:
    batch = db.batch()
    total_written = 0
    for idx, doc in enumerate(docs, start=1):
        ref = db.collection('raw_inputs').document()
        batch.set(ref, doc)
        if idx % 400 == 0:
            batch.commit()
            batch = db.batch()
        total_written += 1
    if total_written % 400 != 0:
        batch.commit()
    return total_written


def candidate_slug(candidate: str) -> str:
    slug = "-".join(str(candidate or "unknown").strip().split()).lower()
    return slug or "unknown"


def chunked(items: List[Any], chunk_size: int):
    for i in range(0, len(items), chunk_size):
        yield items[i:i + chunk_size]


def mark_raw_inputs_processed(
    db: google.cloud.firestore.Client,
    references: List[google.cloud.firestore.DocumentReference],
    batch_id: str,
) -> None:
    for refs in chunked(references, WRITE_BATCH_CHUNK):
        batch = db.batch()
        for ref in refs:
            batch.update(ref, {
                'processed_at': firestore.SERVER_TIMESTAMP,
                'processed_batch_id': batch_id,
            })
        batch.commit()


def upsert_rollup_document(
    db: google.cloud.firestore.Client,
    collection: str,
    doc_id: str,
    bucket_field: str,
    bucket_value: str,
    candidate: str,
    approval_score: float,
    sample_count: int,
) -> None:
    if sample_count <= 0 or not bucket_value:
        return

    doc_ref = db.collection(collection).document(doc_id)
    transaction = db.transaction()

    @firestore.transactional
    def update(transaction):
        snapshot = doc_ref.get(transaction=transaction)
        weighted_total = float(approval_score) * sample_count
        total_samples = sample_count

        if snapshot.exists:
            data = snapshot.to_dict() or {}
            weighted_total += float(data.get("total_weighted_score") or 0)
            total_samples += int(data.get("sample_count") or 0)

        avg_rating = round(weighted_total / total_samples, 2) if total_samples else 0
        transaction.set(
            doc_ref,
            {
                "candidate": candidate,
                "state": "National",
                bucket_field: bucket_value,
                "avg_rating": avg_rating,
                "sample_count": total_samples,
                "total_weighted_score": weighted_total,
                "updated_at": firestore.SERVER_TIMESTAMP,
            },
        )

    update(transaction)


def fetch_previous_rating(
    db: google.cloud.firestore.Client,
    candidate: str,
    current_doc_id: str,
) -> float:
    query = db.collection('approval_ratings')\
        .where('candidate', '==', candidate)\
        .order_by('timestamp', direction=firestore.Query.DESCENDING)\
        .limit(5)\
        .stream()

    for doc in query:
        if doc.id == current_doc_id:
            continue
        data = doc.data()
        if data is None:
            continue
        rating = data.get('rating_score')
        if rating is not None:
            return float(rating)
    return 0.0


# ---------------------------------------------------------------------------
# HTTP Functions
# ---------------------------------------------------------------------------
@https_fn.on_request()
def healthz(req: https_fn.Request) -> https_fn.Response:
    """Health check endpoint"""
    return json_response({"ok": True})


@https_fn.on_request()
def submit_opinion(req: https_fn.Request) -> https_fn.Response:
    """Retired candidate opinion endpoint; cached clients receive a clear response."""
    return json_response({"error": "Candidate opinion collection has ended."}, status=410)


@https_fn.on_request()
def admin_upload(req: https_fn.Request) -> https_fn.Response:
    """Retired candidate opinion bulk upload endpoint."""
    return json_response({"error": "Candidate opinion collection has ended."}, status=410)
