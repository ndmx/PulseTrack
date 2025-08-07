import pandas as pd
import matplotlib.pyplot as plt
from db_connect import engine
def generate_chart():
    df = pd.read_sql('SELECT * FROM approval_ratings ORDER BY timestamp', engine)
    if df.empty:
        return None
    plt.figure(figsize=(10,6))
    for candidate in df['candidate'].unique():
        cand_df = df[df['candidate'] == candidate]
        plt.plot(cand_df['timestamp'], cand_df['rating_score'], label=candidate)
    plt.xlabel('Time')
    plt.ylabel('Approval Rating (%)')
    plt.legend()
    chart_path = 'static/chart.png'  # Create static folder if needed
    plt.savefig(chart_path)
    return chart_path
