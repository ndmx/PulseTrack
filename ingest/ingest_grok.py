import pandas as pd
from io import StringIO
import os
from pathlib import Path
from db.connect import engine
from db.load import load_approvals, load_to_db
from transform import transform
from datetime import datetime

INGEST_DIR = Path(__file__).parent / 'ingest'

def ingest_grok_data(sentiment_file, headlines_file, candidate):
    # Read sentiment CSV
    with open(sentiment_file, 'r') as f:
        table_str = f.read()
    df = pd.read_csv(StringIO(table_str))
    positive = df[df['Sentiment Category'].str.contains('Positive')]['Percentage'].iloc[0] if 'Positive' in df['Sentiment Category'].values else 0
    negative = df[df['Sentiment Category'].str.contains('Negative')]['Percentage'].iloc[0] if 'Negative' in df['Sentiment Category'].values else 0
    neutral = df[df['Sentiment Category'].str.contains('Neutral')]['Percentage'].iloc[0] if 'Neutral' in df['Sentiment Category'].values else 0
    trending = '; '.join(df['Trending Phrases'].dropna().unique())

    # Read headlines
    with open(headlines_file, 'r') as f:
        headlines = f.read().strip()

    # Extract date from filename (e.g., 2025-08-10)
    date_str = sentiment_file.stem.split('_')[-1]
    timestamp = datetime.strptime(date_str, '%Y-%m-%d')

    # Prepare approvals
    approval_score = positive
    df_raw = pd.DataFrame({
        'source': ['grok'] * len(df),
        'content': df['Example Posts'].tolist(),
        'user_id': ['grok_id'] * len(df),
        'timestamp': [timestamp] * len(df),
        'candidate': [candidate] * len(df)
    })
    df_verified, df_approvals = transform(df_raw, engine)
    df_approvals['rating_score'] = approval_score
    load_approvals(df_approvals)

    # Load to sentiment_breakdown
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
    print(f"Ingested data for {candidate} from {sentiment_file}. Approval: {approval_score}%.")

# Batch process all files in ingest folder
def process_ingest_folder():
    for file in INGEST_DIR.glob('*_sentiment_*.csv'):
        candidate = file.stem.split('_')[0].capitalize()  # e.g., 'Tinubu' from 'tinubu_sentiment_...'
        headlines_file = file.with_name(f"{candidate.lower()}_headlines_{file.stem.split('_')[-1]}.txt")
        if headlines_file.exists():
            ingest_grok_data(file, headlines_file, candidate)
        else:
            print(f"Missing headlines file for {file}; skipping.")

if __name__ == "__main__":
    os.makedirs(INGEST_DIR, exist_ok=True)
    process_ingest_folder()


