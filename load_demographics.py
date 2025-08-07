import pandas as pd
from db_connect import engine
df = pd.read_csv('state_demographics.csv')
df.to_sql('state_demographics', engine, if_exists='replace', index=False)
print("Demographics loaded!")
