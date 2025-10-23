"""
ETL Processing logic for Cloud Functions
Converts raw_inputs to sentiment_breakdown and approval_ratings
"""
from datetime import datetime
from typing import Dict, List
from textblob import TextBlob
import re


def clean_text(text: str) -> str:
    """Clean and normalize text for sentiment analysis"""
    text = text.lower()
    text = re.sub(r'http\S+', '', text)  # Remove URLs
    text = re.sub(r'[^a-z0-9\s]', '', text)  # Remove special chars
    text = re.sub(r'\s+', ' ', text).strip()  # Normalize whitespace
    return text


def calculate_sentiment(text: str) -> Dict[str, float]:
    """
    Calculate sentiment scores using TextBlob
    Returns dict with positive, negative, neutral percentages
    """
    try:
        blob = TextBlob(clean_text(text))
        polarity = blob.sentiment.polarity
        
        # Convert polarity (-1 to 1) to positive/negative/neutral percentages
        if polarity > 0.1:
            positive = polarity * 100
            negative = 0
            neutral = 100 - positive
        elif polarity < -0.1:
            negative = abs(polarity) * 100
            positive = 0
            neutral = 100 - negative
        else:
            neutral = 100
            positive = 0
            negative = 0
            
        return {
            "positive": round(positive, 2),
            "negative": round(negative, 2),
            "neutral": round(neutral, 2)
        }
    except Exception as e:
        print(f"Sentiment calculation error: {e}")
        return {"positive": 0, "negative": 0, "neutral": 100}


def calculate_approval_score(sentiment: Dict[str, float]) -> float:
    """
    Convert sentiment to approval score (0-100)
    Formula: (positive * 1.0 + neutral * 0.5) = approval %
    """
    score = (sentiment["positive"] * 1.0 + sentiment["neutral"] * 0.5)
    return round(min(100, max(0, score)), 2)


def aggregate_sentiments(sentiments: List[Dict]) -> Dict:
    """
    Aggregate multiple sentiment scores
    Returns average positive, negative, neutral percentages
    """
    if not sentiments:
        return {"positive": 0, "negative": 0, "neutral": 100}
    
    total_pos = sum(s["positive"] for s in sentiments)
    total_neg = sum(s["negative"] for s in sentiments)
    total_neu = sum(s["neutral"] for s in sentiments)
    count = len(sentiments)
    
    return {
        "positive": round(total_pos / count, 2),
        "negative": round(total_neg / count, 2),
        "neutral": round(total_neu / count, 2)
    }

