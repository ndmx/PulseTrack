import streamlit as st
import sqlalchemy
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

# Page config (mobile-friendly)
st.set_page_config(
    page_title="PulseTrack",
    page_icon="🇳🇬",
    layout="centered",
    initial_sidebar_state="collapsed",
)

# Logging
init_logging()
logger = get_logger(__name__)
db_ok = True
try:
    with engine.connect() as conn:
        conn.execute(sqlalchemy.text("SELECT 1"))
except Exception:
    db_ok = False
    logger.error("DB connectivity check failed")
    st.error("Database connection failed. Please verify Streamlit secrets (DB_URL).")
ensure_audit_table()
log_event("app.start")

# CSS
st.markdown(
    """
    <style>
    :root {
        --primary:#008753; /* Deep Green */
        --bg:#FFFFFF;      /* App background (light mode) */
        --text:#212529;    /* Text (light mode) */
        --surface:#FFFFFF; /* Card/chart surface */
        --cardBorder:#E9ECEF;
        --pos:#2ECC71;     /* Positive */
        --neg:#E74C3C;     /* Negative */
        --neu:#95A5A6;     /* Neutral */
        --gold:#E4B429;    /* Accent */
    }
    .main { padding: 1rem; }
    html, body, .stApp, [data-testid="stAppViewContainer"], .block-container { background-color: var(--bg) !important; }
    body { font-family: 'Arial', sans-serif; font-size: 16px; line-height: 1.5; color: var(--text); }
    h1, h2, h3 { color: var(--text); margin-bottom: 1rem; }
    p, span, li, label, div { color: var(--text); }
    .stMetric { font-size: 18px; }
    .stPlotlyChart { background-color: var(--surface); border: 1px solid var(--cardBorder); border-radius: 12px; padding: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.06); margin-bottom: 1.5rem; overflow: hidden; width: calc(100% + 10px); margin-left: -5px; margin-right: -5px; }
    .stPlotlyChart > div { border-radius: 12px !important; overflow: hidden; }
    .stForm { background-color: #E6F4F1; padding: 1rem; border-radius: 5px; }
    .st-expander { margin-bottom: 1rem; }
    .st-expander { margin-bottom: 1rem; }
    /* Toggle styling: Blue track, green thumb */
    /* Ensure no parent white background overrides the switch */
    [data-testid="stToggle"],
    [data-testid="stToggle"] label,
    [data-testid="stToggle"] label > div {
        background: transparent !important;
    }
    [data-testid="stToggle"] label div[role="switch"] {
        background-color: #AED6F1 !important; /* Light blue track when off */
        border-radius: 999px !important;
        box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);
        transition: background-color 0.3s;
    }
    [data-testid="stToggle"] label div[role="switch"][aria-checked="true"] {
        background-color: #007BFF !important; /* Dark blue track when on */
    }
    [data-testid="stToggle"] label div[role="switch"] > div {
        background-color: #008753 !important; /* Green thumb */
        box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;
        border: 1px solid #FFFFFF !important; /* White border for contrast */
        transition: transform 0.3s;
    }
    /* Fallback for DOM variations */
    div[role="switch"] { background-color: #AED6F1 !important; }
    div[role="switch"][aria-checked="true"] { background-color: #007BFF !important; }
    div[role="switch"] > div { background-color: #008753 !important; }
    @media (max-width: 768px) {
        body { font-size: 14px; }
        .stMetric { font-size: 16px; text-align: center; }
        .stPlotlyChart { height: auto; min-height: 300px; }
    }
    /* Tooltips: force white text for help bubbles (BaseWeb tooltips) */
    div[data-baseweb="tooltip"],
    div[role="tooltip"] {
        color: #FFFFFF !important;
        background-color: rgba(0,0,0,0.9) !important;
        border-radius: 6px !important;
    }
    div[data-baseweb="tooltip"] *,
    div[role="tooltip"] * {
        color: #FFFFFF !important;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# Title
st.title("🇳🇬 PulseTrack")
st.markdown(
    "Track real-time approval ratings for Nigerian political candidates based on social media sentiment and user submissions. Data updated via manual ingestion."
)

# Theme toggle (top-right moon icon)
if 'dark_mode' not in st.session_state:
    st.session_state.dark_mode = False
top_left, top_right = st.columns([0.92, 0.08])
with top_right:
    if st.button("🌙", key="theme_icon", help="Toggle theme"):
        st.session_state.dark_mode = not st.session_state.dark_mode
dark_mode = st.session_state.dark_mode
if dark_mode:
    st.markdown(
        """
        <style>
        :root {
            --bg:#0F1117;      /* App background (dark mode) */
            --text:#E9ECEF;    /* Text (dark mode) */
            --surface:#1E1E1E; /* Card/chart surface */
            --cardBorder:#2A2F3A;
        }
        html, body, .stApp, [data-testid="stAppViewContainer"], .block-container { background-color: var(--bg) !important; }
        </style>
        """,
        unsafe_allow_html=True,
    )
plotly_template = 'plotly_dark' if dark_mode else 'plotly_white'


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
approval_data = (
    load_approval_data(time_period_current, "National") if db_ok else pd.DataFrame()
)


@st.cache_data(ttl=600)
def load_sentiment_data() -> dict:
    if not db_ok:
        return {}
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
                    title={"text": cand.title()},
                    domain={"x": [0.12, 0.88], "y": [0.0, 0.76]},
                    gauge={
                        "axis": {"range": [0, 100], "tickfont": {"size": 10}},
                        "bar": {"color": "#008753", "thickness": 0.15},
                        "bgcolor": "rgba(0,0,0,0)",
                        "bordercolor": "rgba(0,0,0,0)",
                        "steps": [
                            {"range": [0, 30], "color": "red"},
                            {"range": [30, 70], "color": "yellow"},
                            {"range": [70, 100], "color": "green"},
                        ],
                    },
                )
            )
            fig.update_layout(height=280, margin={"l": 6, "r": 20, "t": 36, "b": 8})
            fig.update_layout(template=plotly_template)
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
                    "Positive": "#2ECC71",
                    "Negative": "#E74C3C",
                    "Neutral": "#95A5A6",
                },
                title=f"{cand.title()} Sentiment Split",
            )
            fig_pie.update_traces(
                hoverinfo='label+percent',
                textinfo='percent+label',
                marker=dict(line=dict(color='#FFFFFF', width=2)),
                domain=dict(x=[0.08, 0.92], y=[0.12, 0.92])  # reduce visible circumference ~10%
            )
            fig_pie.update_layout(template=plotly_template)
            fig_pie.update_layout(
                margin=dict(l=20, r=35, t=40, b=40),
                legend=dict(orientation='h', y=-0.15),
            )
            st.plotly_chart(fig_pie, use_container_width=True, key=f"pie_{cand}")


    with st.expander("Key Headlines Affecting Trends"):
        for cand in sentiment_dict:
            st.markdown(f"**{cand}**: {sentiment_dict[cand]['Headlines']}")
else:
    st.info("No sentiment data available. Ingest data via ingest_grok.py.")

@st.cache_data(ttl=600)
def load_trend_all_time() -> pd.DataFrame:
    if not db_ok:
        return pd.DataFrame()
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
if trend_source.empty:
    st.info("No trend data available yet.")
else:
    trend_df = trend_source.copy()
    trend_df["timestamp"] = pd.to_datetime(trend_df["timestamp"], errors="coerce")
    trend_df = trend_df.dropna(subset=["timestamp"])  # guard against bad dates
    monthly = (
        trend_df
        .groupby(["candidate", pd.Grouper(key="timestamp", freq="MS")])["rating_score"]
        .mean()
        .reset_index()
    )
    # Capitalize candidate labels for legend/readability
    if 'candidate' in monthly.columns:
        monthly['candidate'] = monthly['candidate'].astype(str).str.title()
    if monthly.empty:
        st.info("No trend data available yet.")
    else:
        candidate_colors = {"Obi": "#008753", "Tinubu": "#007BFF", "Atiku": "#E4B429"}
        fig = px.line(
            monthly,
            x="timestamp",
            y="rating_score",
            color="candidate",
            title="Approval Ratings Over Time (All Data)",
            color_discrete_map=candidate_colors,
        )
        fig.update_traces(line=dict(width=3))
        fig.update_layout(
            xaxis_title="Month",
            yaxis_title="Approval Rating (%)",
            hovermode="x unified",
            xaxis_rangeslider_visible=True,
            xaxis_rangeslider_thickness=0.08,
            template=plotly_template,
            margin=dict(l=20, r=30, t=60, b=120),
            xaxis=dict(domain=[0.0, 0.90]),
            legend=dict(orientation='h', y=-0.40, x=0.5, xanchor='center')
        )
        st.plotly_chart(fig, use_container_width=True, key="trend_alltime")

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
        color_discrete_map={
            "LP": "#008753",    # green
            "APC": "#F1C40F",   # yellow
            "PDP": "#007BFF",   # blue
            "NNPP": "#E74C3C",  # red
        },
        title="Registered Voters by State (Descending)",
    )
    fig_bar.update_layout(
        height=600,
        template=plotly_template,
        margin=dict(l=20, r=60, t=60, b=100),
        legend=dict(orientation='h', x=1.0, xanchor='right', y=-0.18, yanchor='top')
    )
    st.plotly_chart(fig_bar, use_container_width=True, key="bar_registered_by_state")


