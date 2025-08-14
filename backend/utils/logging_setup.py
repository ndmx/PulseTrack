import logging
import os
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path


LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "pulsetrack.log"


def init_logging(level: int = logging.INFO) -> None:
    """Initialize app-wide logging once. Safe to call multiple times."""
    root = logging.getLogger()
    if any(isinstance(h, TimedRotatingFileHandler) for h in root.handlers):
        return

    root.setLevel(level)

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Console handler
    ch = logging.StreamHandler()
    ch.setLevel(level)
    ch.setFormatter(fmt)
    root.addHandler(ch)

    # Daily rotating file handler, keep 14 days
    fh = TimedRotatingFileHandler(str(LOG_FILE), when="midnight", interval=1, backupCount=14)
    fh.setLevel(level)
    fh.setFormatter(fmt)
    root.addHandler(fh)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


