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

# Set page config
st.set_page_config(
    page_title="PulseTrack",
    page_icon="🇳🇬",
    layout="wide"
)

# Add custom CSS
st.markdown("""
    <style>
    .main {
        padding: 2rem;
    }
    .stPlotlyChart {
        background-color: white;
        border-radius: 5px;
        padding: 1rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    </style>
""", unsafe_allow_html=True)

# Title and description
st.title("🇳🇬 PulseTrack")
st.markdown("""
    Track real-time approval ratings for Nigerian political candidates based on social media sentiment 
    and user submissions. Data is updated every 10 minutes.
""")

# Ensure DB schema compatibility (add missing columns if needed)
def ensure_schema() -> None:
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE raw_inputs ADD COLUMN IF NOT EXISTS candidate VARCHAR(100)"
            ))
    except Exception:
        # If engine is not available or table doesn't exist yet, skip silently
        pass

ensure_schema()

# Sidebar filters
st.sidebar.header("Filters")

# Date range filter
date_ranges = {
    "Last 24 hours": timedelta(days=1),
    "Last 7 days": timedelta(days=7),
    "Last 30 days": timedelta(days=30),
    "All time": timedelta(days=365*10)  # Very large range
}
selected_range = st.sidebar.selectbox("Time Period", list(date_ranges.keys()))

# State filter
# Load states list for dropdown; if DB unavailable, fall back to CSV
try:
    states_df = pd.read_sql("SELECT DISTINCT state FROM state_demographics ORDER BY state", engine)
except Exception:
    from pathlib import Path
    csv_path = Path(__file__).resolve().parent / "data" / "state_demographics.csv"
    fallback = pd.read_csv(csv_path)
    states_df = pd.DataFrame({"state": sorted(fallback["state"].unique())})
selected_state = st.sidebar.selectbox(
    "Select State",
    ["National"] + states_df['state'].tolist()
)

# Get approval ratings data
@st.cache_data(ttl=600)  # Cache for 10 minutes
def load_approval_data(time_delta, state):
    query = """
    SELECT timestamp, candidate, rating_score, change_delta, state 
    FROM approval_ratings 
    WHERE timestamp >= NOW() - interval '%s seconds'
    """
    if state != "National":
        query += " AND state = %s"
        params = (time_delta.total_seconds(), state)
    else:
        params = (time_delta.total_seconds(),)
    
    df = pd.read_sql(query, engine, params=params)
    return df

# Load data based on filters
approval_data = load_approval_data(date_ranges[selected_range], selected_state)

# Create main dashboard
col1, col2 = st.columns(2)

with col1:
    st.subheader("Current Approval Ratings")
    if not approval_data.empty:
        # Get latest ratings for each candidate
        latest_ratings = approval_data.sort_values('timestamp').groupby('candidate').last()
        
        # Create gauge charts for each candidate
        for candidate in latest_ratings.index:
            score = latest_ratings.loc[candidate, 'rating_score']
            delta = latest_ratings.loc[candidate, 'change_delta']
            
            fig = go.Figure(go.Indicator(
                mode = "gauge+number+delta",
                value = score,
                delta = {'reference': score - delta, 'relative': True},
                title = {'text': candidate},
                gauge = {
                    'axis': {'range': [0, 100]},
                    'bar': {'color': "darkblue"},
                    'steps': [
                        {'range': [0, 30], 'color': "red"},
                        {'range': [30, 70], 'color': "yellow"},
                        {'range': [70, 100], 'color': "green"}
                    ]
                }
            ))
            fig.update_layout(height=200)
            st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No approval data available for the selected filters.")

with col2:
    st.subheader("Approval Trends")
    if not approval_data.empty:
        # Create line chart
        fig = px.line(
            approval_data,
            x='timestamp',
            y='rating_score',
            color='candidate',
            title=f"Approval Ratings Over Time ({selected_state})"
        )
        fig.update_layout(
            xaxis_title="Date",
            yaxis_title="Approval Rating (%)",
            hovermode='x unified'
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No trend data available for the selected filters.")

# User submission form
st.subheader("Submit Your Opinion")
with st.form("poll_form"):
    col1, col2 = st.columns(2)
    
    with col1:
        candidate = st.selectbox("Select Candidate", ["Tinubu", "Atiku", "Obi"])
        location = st.selectbox("Your State", states_df['state'].tolist())
    
    with col2:
        response = st.text_area("Your Opinion", height=100)
        
    submitted = st.form_submit_button("Submit")
    
    if submitted:
        if response.strip():
            # Create DataFrame for submission
            df = pd.DataFrame([{
                'source': 'user_form',
                'content': response,
                'user_id': str(uuid.uuid4()),
                'location': location,
                'candidate': candidate
            }])
            
            # Save to database
            load_to_db(df, 'raw_inputs')
            st.success("Thank you for your submission! Your opinion has been recorded.")
        else:
            st.error("Please enter your opinion before submitting.")

# Demographics section
st.subheader("State Demographics")

@st.cache_data
def load_demographics_data(state_filter: str) -> pd.DataFrame:
    """Load demographics from DB; if unavailable, fall back to CSV.
    When state_filter == 'National', return all states; otherwise return a single state.
    """
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

    # Fallback to CSV (from data folder)
    csv_path = Path(__file__).resolve().parent / "data" / "state_demographics.csv"
    df_csv = pd.read_csv(csv_path)
    # Normalize column names if needed
    df_csv.columns = [c.strip() for c in df_csv.columns]
    if state_filter != "National":
        return df_csv[df_csv["state"].str.casefold() == state_filter.casefold()].copy()
    return df_csv.copy()

demo_data = load_demographics_data(selected_state)

if selected_state != "National":
    # Single state view
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Total Population", f"{demo_data['total_population'].iloc[0]:,}")
    with col2:
        st.metric("Registered Voters", f"{demo_data['registered_voters'].iloc[0]:,}")
    with col3:
        st.metric("Voter Registration Rate", f"{(demo_data['registered_voters'].iloc[0] / demo_data['voting_age_population'].iloc[0] * 100):.1f}%")
else:
    # National view (no maps). Show national aggregates and charts from CSV/DB data.
    st.subheader("National Overview")

    totals = {
        'total_population': int(demo_data['total_population'].sum()),
        'registered_voters': int(demo_data['registered_voters'].sum()),
        'voting_age_population': int(demo_data['voting_age_population'].sum()),
    }
    rate = 0.0
    if totals['voting_age_population']:
        rate = totals['registered_voters'] / totals['voting_age_population'] * 100.0

    c1, c2, c3 = st.columns(3)
    with c1:
        st.metric("Total Population", f"{totals['total_population']:,}")
    with c2:
        st.metric("Registered Voters", f"{totals['registered_voters']:,}")
    with c3:
        st.metric("Voter Registration Rate", f"{rate:.1f}%")

    st.divider()

    # Charts based on state-level rows
    st.subheader("Registered Voters by State")
    state_sorted = demo_data.copy()
    state_sorted['state'] = state_sorted['state'].astype(str)
    state_sorted = state_sorted.sort_values('registered_voters', ascending=False)
    fig_bar = px.bar(
        state_sorted,
        x='registered_voters',
        y='state',
        orientation='h',
        labels={'registered_voters': 'Registered Voters', 'state': 'State'},
        title='Registered Voters by State (Descending)'
    )
    fig_bar.update_layout(height=800, yaxis={'categoryorder':'total ascending'})
    st.plotly_chart(fig_bar, use_container_width=True)

    st.subheader("Population vs Registered Voters")
    fig_scatter = px.scatter(
        demo_data,
        x='voting_age_population',
        y='registered_voters',
        hover_name='state',
        labels={'voting_age_population': 'Voting Age Population', 'registered_voters': 'Registered Voters'}
    )
    st.plotly_chart(fig_scatter, use_container_width=True)

# Run the Streamlit app with: streamlit run app_streamlit.py
