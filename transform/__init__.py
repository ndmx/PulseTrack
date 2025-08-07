import pandas as pd
import nltk
from textblob import TextBlob
from sqlalchemy import text
nltk.download('punkt', quiet=True)
def transform(df_raw, engine):
    df_raw = df_raw.drop_duplicates(subset=['content'])
    df_raw['content'] = df_raw['content'].str.lower().str.replace(r'[^\w\s]', '', regex=True)
    df_raw['sentiment'] = df_raw['content'].apply(lambda x: TextBlob(x).sentiment.polarity)
    state_df = pd.read_sql('SELECT * FROM state_demographics', engine)
    ref_voters = state_df['registered_voters'].sum()
    threshold = 0.1
    mentions = len(df_raw)
    df_raw['verification_status'] = 'verified' if mentions < ref_voters * threshold else 'suspicious'
    approval_score = (df_raw['sentiment'] > 0).mean() * 100 if not df_raw.empty else 0
    candidate = df_raw['candidate'].iloc[0] if not df_raw.empty else ''
    with engine.connect() as conn:
        prev_query = text("SELECT rating_score FROM approval_ratings WHERE candidate = :candidate ORDER BY timestamp DESC LIMIT 1")
        prev_result = conn.execute(prev_query, {'candidate': candidate}).fetchone()
        prev_score = prev_result[0] if prev_result else 0
    delta = approval_score - prev_score
    approvals_df = pd.DataFrame([{'candidate': candidate, 'rating_score': approval_score, 'change_delta': delta, 'state': 'National'}])  # Expand for states later
    return df_raw, approvals_df
