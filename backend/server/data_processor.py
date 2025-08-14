from pathlib import Path

def process(input_file: Path) -> None:
    # TODO: merge logic from existing ETL modules (etl.py, ingest/ingest_grok.py)
    print(f"[processor] Processing: {input_file}")
