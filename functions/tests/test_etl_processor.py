import math
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from etl_processor import (  # noqa: E402
    clean_text,
    calculate_sentiment,
    calculate_approval_score,
    aggregate_sentiments,
)


def test_clean_text_strips_urls_and_symbols():
    raw = "Check https://example.com NOW!!! #Nigeria"
    assert clean_text(raw) == "check now nigeria"


@pytest.mark.parametrize("text", ["I absolutely love this leader", "Great policies and vision"])
def test_calculate_sentiment_positive(text: str):
    scores = calculate_sentiment(text)
    assert scores["positive"] > scores["negative"]
    assert scores["neutral"] <= 100


@pytest.mark.parametrize("text", ["Terrible decisions all around", "I dislike everything about this"])
def test_calculate_sentiment_negative(text: str):
    scores = calculate_sentiment(text)
    assert scores["negative"] >= scores["positive"]
    assert scores["neutral"] <= 100


def test_calculate_sentiment_neutral_text():
    scores = calculate_sentiment("It is what it is.")
    assert scores["neutral"] == 100
    assert scores["positive"] == 0
    assert scores["negative"] == 0


def test_calculate_approval_score_bounds():
    high = calculate_approval_score({"positive": 120, "neutral": 50, "negative": 0})
    low = calculate_approval_score({"positive": -10, "neutral": 0, "negative": 0})
    assert 0 <= low <= 100
    assert high == 100


def test_aggregate_sentiments_average_values():
    sentiments = [
        {"positive": 60, "negative": 20, "neutral": 20},
        {"positive": 30, "negative": 50, "neutral": 20},
    ]
    avg = aggregate_sentiments(sentiments)
    assert math.isclose(avg["positive"], 45.0)
    assert math.isclose(avg["negative"], 35.0)
    assert math.isclose(avg["neutral"], 20.0)


def test_aggregate_sentiments_empty_defaults_to_neutral():
    avg = aggregate_sentiments([])
    assert avg == {"positive": 0, "negative": 0, "neutral": 100}

