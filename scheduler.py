from apscheduler.schedulers.background import BackgroundScheduler
import time
from ingest.ingest_grok import process_ingest_folder
from utils.logging_setup import init_logging, get_logger
from db.audit import ensure_audit_table, log_event


def main() -> None:
    init_logging()
    logger = get_logger(__name__)
    ensure_audit_table()

    scheduler = BackgroundScheduler()
    scheduler.add_job(process_ingest_folder, 'interval', minutes=10)
    scheduler.start()
    log_event("scheduler.started", details="interval=10min")
    logger.info("Scheduler started (interval=10min)")

    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        log_event("scheduler.stopped")
        logger.info("Scheduler stopped")


if __name__ == "__main__":
    main()


