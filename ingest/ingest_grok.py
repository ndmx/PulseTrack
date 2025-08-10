import pandas as pd
import os
from pathlib import Path
from db.connect import engine
from db.load import load_approvals, load_to_db
from transform import transform
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import time
import logging
from sqlalchemy import text
from utils.logging_setup import init_logging, get_logger
from db.audit import ensure_audit_table, log_event

# Process CSVs placed directly in the ingest/ folder (this file's parent)
init_logging()
logger = get_logger(__name__)
ensure_audit_table()

INGEST_DIR = Path(__file__).parent

def ingest_grok_data(file_path: Path) -> None:
    try:
        df = pd.read_csv(
            file_path,
            engine='python',
            sep=',',
            quotechar='"',
            escapechar='\\',
            on_bad_lines='skip'
        )
    except pd.errors.EmptyDataError:
        logger.info(f"Skipping empty CSV: {file_path}")
        log_event("ingest.skip_empty_csv", subject=str(file_path))
        return

    # Group rows by 'Date' if present; otherwise treat the entire file as a single group
    if 'Date' in df.columns:
        groups = df.groupby('Date')  # yields (date_key, group_df)
        iterable = groups
    else:
        groups = {'now': df}
        iterable = groups.items()  # yields (key, df)

    for date_key, group_df in (iterable if isinstance(iterable, dict) else groups):
        try:
            if date_key == 'now':
                timestamp = datetime.now()
            else:
                timestamp = datetime.strptime(str(date_key), '%Y-%m-%d')
        except ValueError:
            logger.warning(f"Invalid date {date_key} in {file_path}. Using current date.")
            timestamp = datetime.now()

        headlines_row = group_df[group_df['Sentiment Category'] == 'Headlines']
        headlines = headlines_row['Percentage'].iloc[0] if not headlines_row.empty else ''
        trending_all = '; '.join(group_df['Trending Phrases'].dropna().unique())
        content_text_lower = f"{headlines} {trending_all}".lower()
        if 'tinubu' in content_text_lower:
            candidate = 'Tinubu'
        elif 'obi' in content_text_lower:
            candidate = 'Obi'
        else:
            logger.warning(f"Could not detect candidate for date {date_key} in {file_path}. Skipping group.")
            log_event("ingest.unknown_candidate", subject=str(file_path), details=f"date={date_key}")
            continue

        sentiment_rows = group_df[group_df['Sentiment Category'].isin(['Positive', 'Negative', 'Neutral'])]
        positive = sentiment_rows[sentiment_rows['Sentiment Category'] == 'Positive']['Percentage'].iloc[0] if not sentiment_rows[sentiment_rows['Sentiment Category'] == 'Positive'].empty else 0
        negative = sentiment_rows[sentiment_rows['Sentiment Category'] == 'Negative']['Percentage'].iloc[0] if not sentiment_rows[sentiment_rows['Sentiment Category'] == 'Negative'].empty else 0
        neutral = sentiment_rows[sentiment_rows['Sentiment Category'] == 'Neutral']['Percentage'].iloc[0] if not sentiment_rows[sentiment_rows['Sentiment Category'] == 'Neutral'].empty else 0
        trending = '; '.join(sentiment_rows['Trending Phrases'].dropna().unique())

        approval_score = positive
        df_raw = pd.DataFrame({
            'source': ['grok'] * len(sentiment_rows),
            'content': sentiment_rows['Example Posts'].tolist(),
            'user_id': ['grok_id'] * len(sentiment_rows),
            'timestamp': [timestamp] * len(sentiment_rows),
            'candidate': [candidate] * len(sentiment_rows)
        })
        df_verified, df_approvals = transform(df_raw, engine)
        # Ensure approvals row carries the CSV date, not NOW()
        df_approvals['timestamp'] = timestamp
        df_approvals['rating_score'] = approval_score

        # Prevent duplicates for same candidate-timestamp pair
        try:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "DELETE FROM approval_ratings WHERE candidate = :cand AND timestamp = :ts"
                    ),
                    {"cand": candidate, "ts": timestamp},
                )
        except Exception as e:
            logger.warning(f"Pre-delete duplicate failed for {candidate} @ {timestamp}: {e}")

        load_approvals(df_approvals)

        sentiment_df = pd.DataFrame([{
            'candidate': candidate,
            'positive': positive,
            'negative': negative,
            'neutral': neutral,
            'trending_phrases': trending,
            'headlines': headlines,
            'timestamp': timestamp
        }])
        load_to_db(sentiment_df, 'sentiment_breakdown')
        msg = f"Ingested data for {candidate} on {timestamp.date()} from {file_path}. Approval: {approval_score}%."
        logger.info(msg)
        log_event("ingest.success", subject=f"{candidate}:{timestamp.date()}", details=msg)

# Batch process all CSV files in ingest folder
def process_ingest_folder() -> None:
    for file in list(INGEST_DIR.glob('*.csv')):
        ingest_grok_data(file)
        archive_dir = INGEST_DIR / 'archive'
        os.makedirs(archive_dir, exist_ok=True)
        try:
            file.rename(archive_dir / file.name)
            logger.info(f"Archived {file.name} to {archive_dir}")
            log_event("ingest.archived", subject=file.name, details=str(archive_dir))
        except Exception as e:
            logger.warning(f"Could not archive {file}: {e}")


class Handler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.src_path.endswith('.csv'):
            logger.info(f"Detected modification: {event.src_path}")
            process_ingest_folder()

    def on_created(self, event):
        if event.src_path.endswith('.csv'):
            logger.info(f"Detected new file: {event.src_path}")
            process_ingest_folder()

if __name__ == "__main__":
    os.makedirs(INGEST_DIR, exist_ok=True)
    observer = Observer()
    observer.schedule(Handler(), str(INGEST_DIR), recursive=False)
    observer.start()
    logger.info("Watchdog monitoring started for ingest/ folder.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        logger.info("Watchdog monitoring stopped.")
    observer.join()


