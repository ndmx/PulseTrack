import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
from db.connect import engine
from sqlalchemy import text
from db.load import load_to_db
import uuid
from pathlib import Path
from utils.logging_setup import init_logging, get_logger
from db.audit import ensure_audit_table, log_event

# Page config
st.set_page_config(page_title="PulseTrack", page_icon="🇳🇬", layout="wide")

# Logging
init_logging()
logger = get_logger(__name__)
ensure_audit_table()
log_event("app.start")

# CSS
st.markdown(
    """
    <style>
    .main { padding: 2rem; }
    .stPlotlyChart { background-color: white; border-radius: 5px; padding: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    </style>
    """,
    unsafe_allow_html=True,
)

# Title
st.title("🇳🇬 PulseTrack")
st.markdown(
    "Track real-time approval ratings for Nigerian political candidates based on social media sentiment and user submissions. Data updated via manual ingestion."
)


def ensure_schema() -> None:
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS sentiment_breakdown (
                        id SERIAL PRIMARY KEY,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        candidate VARCHAR(100),
                        positive FLOAT,
                        negative FLOAT,
                        neutral FLOAT,
                        trending_phrases TEXT,
                        headlines TEXT
                    )
                    """
                )
            )
            conn.execute(
                text("ALTER TABLE raw_inputs ADD COLUMN IF NOT EXISTS candidate VARCHAR(100)")
            )
    except Exception:
        pass


ensure_schema()
logger.info("Schema ensured (sentiment_breakdown, raw_inputs.candidate)")

# Load states for submission/demographics
try:
    states_df = pd.read_sql(
        "SELECT DISTINCT state FROM state_demographics ORDER BY state", engine
    )
except Exception:
    csv_path = Path(__file__).resolve().parent / "data" / "state_demographics.csv"
    fallback = pd.read_csv(csv_path)
    states_df = pd.DataFrame({"state": sorted(fallback["state"].unique())})


@st.cache_data(ttl=600)
def load_approval_data(time_delta: timedelta, state: str) -> pd.DataFrame:
    query = (
        "SELECT timestamp, candidate, rating_score, change_delta, state "
        "FROM approval_ratings WHERE timestamp >= NOW() - interval '%s seconds'"
    )
    if state != "National":
        query += " AND state = %s"
        params = (time_delta.total_seconds(), state)
    else:
        params = (time_delta.total_seconds(),)
    return pd.read_sql(query, engine, params=params)


# Fixed period for Current Approval Ratings (last 30 days), National only
time_period_current = timedelta(days=30)
approval_data = load_approval_data(time_period_current, "National")


@st.cache_data(ttl=600)
def load_sentiment_data() -> dict:
    df = pd.read_sql(
        "SELECT * FROM sentiment_breakdown ORDER BY timestamp DESC", engine
    )
    if df.empty:
        return {}
    latest = df.groupby("candidate").first()
    out: dict[str, dict[str, object]] = {}
    for cand in latest.index:
        out[cand] = {
            "Positive": latest.loc[cand, "positive"],
            "Negative": latest.loc[cand, "negative"],
            "Neutral": latest.loc[cand, "neutral"],
            "Trending Phrases": latest.loc[cand, "trending_phrases"],
            "Headlines": latest.loc[cand, "headlines"],
        }
    return out


sentiment_dict = load_sentiment_data()

# Current Approval Ratings (top, full width)
st.subheader("Current Approval Ratings")
if not approval_data.empty:
    latest = approval_data.sort_values("timestamp").groupby("candidate").last()
    cols = st.columns(len(latest))
    for i, cand in enumerate(latest.index):
        with cols[i]:
            score = latest.loc[cand, "rating_score"]
            delta = latest.loc[cand, "change_delta"]
            fig = go.Figure(
                go.Indicator(
                    mode="gauge+number+delta",
                    value=score,
                    delta={"reference": score - delta},
                    title={"text": cand},
                    gauge={
                        "axis": {"range": [0, 100]},
                        "bar": {"color": "darkblue"},
                        "steps": [
                            {"range": [0, 30], "color": "red"},
                            {"range": [30, 70], "color": "yellow"},
                            {"range": [70, 100], "color": "green"},
                        ],
                    },
                )
            )
            fig.update_layout(height=300, margin={"l": 0, "r": 0, "t": 60, "b": 0})
            st.plotly_chart(fig, use_container_width=True, key=f"gauge_{cand}")
else:
    st.info("No approval data available for the last 30 days.")

# Sentiment Breakdown
st.subheader("Sentiment Breakdown from Recent Data")
if sentiment_dict:
    c1, c2 = st.columns(2)
    for i, cand in enumerate(sentiment_dict):
        with (c1 if i % 2 == 0 else c2):
            names = ["Positive", "Negative", "Neutral"]
            values = [
                sentiment_dict[cand]["Positive"],
                sentiment_dict[cand]["Negative"],
                sentiment_dict[cand]["Neutral"],
            ]
            fig_pie = px.pie(
                names=names,
                values=values,
                color=names,
                color_discrete_map={
                    "Positive": "#2ecc71",
                    "Negative": "#e74c3c",
                    "Neutral": "#95a5a6",
                },
                title=f"{cand} Sentiment Split",
            )
            st.plotly_chart(fig_pie, use_container_width=True, key=f"pie_{cand}")


    with st.expander("Key Headlines Affecting Trends"):
        for cand in sentiment_dict:
            st.markdown(f"**{cand}**: {sentiment_dict[cand]['Headlines']}")
else:
    st.info("No sentiment data available. Ingest data via ingest_grok.py.")

@st.cache_data(ttl=600)
def load_trend_all_time() -> pd.DataFrame:
    # All-time National (includes NULL for legacy rows)
    query = (
        "SELECT timestamp, candidate, rating_score, state FROM approval_ratings "
        "WHERE state = 'National' OR state IS NULL"
    )
    df = pd.read_sql(query, engine)
    return df


# Trends (ignore time filter; always all available data; line chart)
st.subheader("Approval Trends")
trend_source = load_trend_all_time()
if not trend_source.empty:
    trend_df = trend_source.copy()
    trend_df["timestamp"] = pd.to_datetime(trend_df["timestamp"], errors="coerce")
    trend_df = trend_df.dropna(subset=["timestamp"])  # guard against bad dates
    monthly = (
        trend_df
        .groupby(["candidate", pd.Grouper(key="timestamp", freq="MS")])["rating_score"]
        .mean()
        .reset_index()
    )
    if monthly.empty:
        st.info("No trend data available yet.")
    else:
        fig = px.line(
            monthly,
            x="timestamp",
            y="rating_score",
            color="candidate",
            title="Approval Ratings Over Time (All Data)",
        )
        fig.update_layout(
            xaxis_title="Month",
            yaxis_title="Approval Rating (%)",
            hovermode="x unified",
        )
        st.plotly_chart(fig, use_container_width=True, key="trend_alltime")
else:
    st.info("No trend data available yet.")

# Submission form
st.subheader("Submit Your Opinion")
with st.form("poll_form"):
    col1, col2 = st.columns(2)
    with col1:
        candidate = st.selectbox("Select Candidate", ["Tinubu", "Atiku", "Obi"])
        location = st.selectbox("Your State", states_df["state"].tolist())
    with col2:
        response = st.text_area("Your Opinion", height=100)
    submitted = st.form_submit_button("Submit")
    if submitted:
        if response.strip():
            df = pd.DataFrame(
                [
                    {
                        "source": "user_form",
                        "content": response,
                        "user_id": str(uuid.uuid4()),
                        "location": location,
                        "candidate": candidate,
                    }
                ]
            )
            load_to_db(df, "raw_inputs")
            st.success("Thank you for your submission! Your opinion has been recorded.")
            log_event("submission.saved", subject=candidate, details=f"state={location}")
        else:
            st.error("Please enter your opinion before submitting.")

# Demographics (toggle-based)
st.subheader("State Demographics")

@st.cache_data
def load_demographics_data(state_filter: str) -> pd.DataFrame:
    try:
        if state_filter != "National":
            df = pd.read_sql(
                "SELECT * FROM state_demographics WHERE state = %s",
                engine,
                params=(state_filter,),
            )
        else:
            df = pd.read_sql("SELECT * FROM state_demographics", engine)
        if not df.empty:
            return df
    except Exception:
        pass

    csv_path = Path(__file__).resolve().parent / "data" / "state_demographics.csv"
    df_csv = pd.read_csv(csv_path)
    df_csv.columns = [c.strip() for c in df_csv.columns]
    if state_filter != "National":
        return df_csv[df_csv["state"].str.casefold() == state_filter.casefold()].copy()
    return df_csv.copy()

# Toggle to switch between National and State view
view_state = st.toggle("View Specific States", value=False)

if view_state:
    selected_states = st.multiselect(
        "Select States",
        states_df["state"].tolist(),
        placeholder="Choose states to view",
        help="Scroll to select multiple states.",
    )
    if selected_states:
        for state in selected_states:
            st.markdown(f"### {state}")
            demo_data = load_demographics_data(state)
            if not demo_data.empty:
                c1, c2, c3 = st.columns(3)
                with c1:
                    st.metric("Total Population", f"{demo_data['total_population'].iloc[0]:,}")
                with c2:
                    st.metric("Registered Voters", f"{demo_data['registered_voters'].iloc[0]:,}")
                with c3:
                    st.metric(
                        "Voter Registration Rate",
                        f"{(demo_data['registered_voters'].iloc[0] / demo_data['voting_age_population'].iloc[0] * 100):.1f}%",
                    )
            else:
                st.info(f"No data for {state}.")
    else:
        st.info("Select states to view details.")
else:
    st.subheader("National Overview")

    @st.cache_data(ttl=3600)
    def load_national_totals() -> pd.Series:
        try:
            return pd.read_sql(
                "SELECT SUM(total_population) AS total_population, "
                "SUM(voting_age_population) AS voting_age_population, "
                "SUM(registered_voters) AS registered_voters FROM state_demographics",
                engine,
            ).iloc[0]
        except Exception:
            df = pd.read_csv(Path(__file__).resolve().parent / "data" / "state_demographics.csv")
            return pd.Series(
                {
                    "total_population": int(df["total_population"].sum()),
                    "voting_age_population": int(df["voting_age_population"].sum()),
                    "registered_voters": int(df["registered_voters"].sum()),
                }
            )

    totals = load_national_totals()
    rate = (
        totals["registered_voters"] / totals["voting_age_population"] * 100
        if totals["voting_age_population"]
        else 0
    )
    c1, c2, c3 = st.columns(3)
    with c1:
        st.metric("Total Population", f"{int(totals['total_population']):,}")
    with c2:
        st.metric("Registered Voters", f"{int(totals['registered_voters']):,}")
    with c3:
        st.metric("Voter Registration Rate", f"{rate:.1f}%")

    st.subheader("Registered Voters by State")
    demo_data = load_demographics_data("National")
    state_sorted = demo_data.sort_values("registered_voters", ascending=False)
    fig_bar = px.bar(
        state_sorted,
        x="registered_voters",
        y="state",
        orientation="h",
        color="political_affiliation",
        title="Registered Voters by State (Descending)",
    )
    fig_bar.update_layout(height=800)
    st.plotly_chart(fig_bar, use_container_width=True, key="bar_registered_by_state")


