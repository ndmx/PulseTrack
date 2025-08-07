import pandas as pd
from db_connect import engine
def load_to_db(df, table_name):
    df.to_sql(table_name, engine, if_exists='append', index=False)
def load_approvals(df_approvals):
    load_to_db(df_approvals, 'approval_ratings')
