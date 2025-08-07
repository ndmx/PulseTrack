import pandas as pd
from extract import extract_from_x
from transform import transform
from db.load import load_to_db, load_approvals
from db.connect import engine
from apscheduler.schedulers.background import BackgroundScheduler
import time
candidates = ['Tinubu', 'Atiku', 'Obi']  # Add more
def run_etl():
    for candidate in candidates:
        df_raw = extract_from_x(candidate)
        if not df_raw.empty:
            df_verified, df_approvals = transform(df_raw, engine)
            load_to_db(df_verified, 'verified_polls')
            load_approvals(df_approvals)
    print("ETL run complete!")
scheduler = BackgroundScheduler()
scheduler.add_job(run_etl, 'interval', minutes=10)
scheduler.start()
try:
    while True:
        time.sleep(1)
except (KeyboardInterrupt, SystemExit):
    scheduler.shutdown()
