import tweepy
import os
from dotenv import load_dotenv
import pandas as pd
load_dotenv()
bearer_token = os.getenv('X_BEARER_TOKEN')
client = tweepy.Client(bearer_token=bearer_token)
def extract_from_x(candidate, max_results=100):
    query = f'{candidate} approval Nigeria OR rating -is:retweet'
    tweets = client.search_recent_tweets(query=query, tweet_fields=['created_at', 'text', 'author_id'], max_results=max_results)
    data = []
    if tweets.data:
        for tweet in tweets.data:
            data.append({'source': 'x', 'content': tweet.text, 'user_id': tweet.author_id, 'timestamp': tweet.created_at, 'candidate': candidate})
    return pd.DataFrame(data)
