import os
from fastapi import FastAPI, UploadFile, File, HTTPException, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse, Response
from starlette import status
from pathlib import Path
from utils.logging_setup import init_logging, get_logger
import requests

API_KEY = os.getenv("API_KEY", "change-me")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

init_logging()
logger = get_logger(__name__)
app = FastAPI(title="PulseTrack Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/healthz")
async def healthz():
    return {"ok": True}

# Global friendly error handler
@app.exception_handler(Exception)
async def unhandled_exception_handler(_req, exc: Exception):
    # Log server-side; return friendly generic message
    msg = str(exc)
    logger.exception("Unhandled exception: %s", msg)
    return JSONResponse(status_code=500, content={
        "error": "server_error",
        "message": "We hit a snag processing your request. Please try again shortly.",
    })


@app.get("/snapstats/geojson")
async def snapstats_geojson():
    """Proxy a private Supabase Storage object to the client.

    Requires env vars:
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE
    - SUPABASE_BUCKET (e.g., 'pulse')
    - SUPABASE_OBJECT_PATH (e.g., 'snapstats/nigeria_states.geojson')
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_role = os.getenv("SUPABASE_SERVICE_ROLE")
    bucket = os.getenv("SUPABASE_BUCKET", "pulse")
    object_path = os.getenv("SUPABASE_OBJECT_PATH", "snapstats/nigeria_states.geojson")

    if not supabase_url or not supabase_service_role:
        raise HTTPException(status_code=500, detail="Supabase is not configured on the server. Please contact the administrator.")

    # Supabase storage object download endpoint (private requires service role)
    obj_url = f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path}"
    try:
        r = requests.get(obj_url, headers={
            "Authorization": f"Bearer {supabase_service_role}",
            "apikey": supabase_service_role,
        }, timeout=30)
    except Exception as e:
        logger.exception("GeoJSON upstream fetch failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Unable to fetch the GeoJSON right now. ({e})")

    if r.status_code != 200:
        logger.warning("GeoJSON upstream bad status: %s", r.status_code)
        raise HTTPException(status_code=r.status_code, detail="GeoJSON is temporarily unavailable. Please try again later.")

    return Response(content=r.content, media_type="application/geo+json")


def run_data_processor(file_path: Path) -> None:
    # Placeholder: integrate with data_processor.py logic
    # For now, just log the file name
    logger.info("[ETL] Received file: %s", file_path)

@app.post("/admin/upload")
async def admin_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    x_api_key: str | None = Header(default=None, convert_underscores=False)
):
    if not x_api_key or x_api_key != API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized. Provide a valid API key.")

    dest = UPLOAD_DIR / file.filename
    try:
        with dest.open("wb") as f:
            while chunk := await file.read(1024 * 1024):
                f.write(chunk)
    except Exception:
        raise HTTPException(status_code=500, detail="We couldn't save the file. Please try again.")
    await file.close()

    background_tasks.add_task(run_data_processor, dest)
    return JSONResponse({"accepted": True, "filename": file.filename})
