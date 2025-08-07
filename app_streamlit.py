import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
from db_connect import engine
from load import load_to_db
import uuid

# Set page config
st.set_page_config(
    page_title="Nigeria Political Approval Ratings",
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
st.title("🇳🇬 Nigeria Political Approval Ratings")
st.markdown("""
    Track real-time approval ratings for Nigerian political candidates based on social media sentiment 
    and user submissions. Data is updated every 10 minutes.
""")

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
states_df = pd.read_sql("SELECT DISTINCT state FROM state_demographics ORDER BY state", engine)
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
demo_data = pd.read_sql(f"SELECT * FROM state_demographics WHERE state = '{selected_state}'", engine) if selected_state != "National" else pd.read_sql("SELECT * FROM state_demographics", engine)

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
    # National view with improved map
    import geopandas as gpd
    import matplotlib.pyplot as plt

    @st.cache_data
    def load_geojson():
        """Fetch Nigeria ADM1 simplified GeoJSON from HDX and return as GeoDataFrame"""
        import requests, json
        url = (
            "https://data.humdata.org/dataset/3a198c00-bb58-45e2-b6ce-ca625eb0246a/resource/"
            "f2519d8d-7a3b-4589-9af7-9e4e8152ef58/download/geoboundaries-nga-adm1_simplified.geojson"
        )
        try:
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
            geojson = resp.json()
        except Exception as e:
            st.error(f"Failed to download GeoJSON: {e}")
            st.stop()
        gdf = gpd.GeoDataFrame.from_features(geojson["features"])
        # Ensure column for state name is named 'state'
        if "shapeName" in gdf.columns:
            gdf = gdf.rename(columns={"shapeName": "state"})
        elif "name" in gdf.columns:
            gdf = gdf.rename(columns={"name": "state"})
        gdf = gdf.set_crs("EPSG:4326")
        return gdf
    gdf = load_geojson()

    # Merge with demo_data (ensure matching case)
    demo_data['state'] = demo_data['state'].str.title()
    gdf['state'] = gdf['state'].str.title()
    gdf = gdf.merge(demo_data, on='state', how='left')

    fig, ax = plt.subplots(figsize=(10, 10))
    gdf.plot(ax=ax, column='registered_voters', cmap='Blues', legend=True, edgecolor='black', linewidth=1.5)

    # Add country boundary outline
    # Draw Nigeria outline
    try:
        country_boundary = gdf.unary_union.boundary
        gpd.GeoSeries(country_boundary).plot(ax=ax, color='black', linewidth=1.5)
    except Exception:
        pass

    # Add state labels
    for idx, row in gdf.iterrows():
        ax.text(row.geometry.centroid.x, row.geometry.centroid.y, row['state'], fontsize=6, ha='center')

    ax.set_title('Nigeria States Map - Registered Voters')
    ax.axis('off')
    st.pyplot(fig)

# Run the Streamlit app with: streamlit run app_streamlit.py
