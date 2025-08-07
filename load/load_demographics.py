import pandas as pd
from db_connect import engine
from pathlib import Path
df = pd.read_csv(Path(__file__).resolve().parents[1] / 'data' / 'state_demographics.csv')
df.to_sql('state_demographics', engine, if_exists='replace', index=False)
print("Demographics loaded!")
