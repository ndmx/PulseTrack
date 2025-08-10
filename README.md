# PulseTrack

Real-time approval-ratings and demographic insights platform for Nigerian politics. It ingests social-media chatter, user polls and official electoral data to produce live analytics ahead of the 2027 general elections (and off-cycle polls such as Anambra 2025).

---

## ✨ Key Features

1. **ETL Pipeline (10-minute cadence)**  
   • Extract: Recent X/Twitter mentions via Tweepy + user form submissions  
   • Transform: Duplicate removal, text cleaning, TextBlob sentiment → approval score, voter-threshold verification, rating deltas  
   • Load: Writes raw, verified and time-series approval data into PostgreSQL
2. **Streamlit Dashboard**  
   • Live gauges (Current Approval Ratings) over last 30 days  
   • Approval Trends line chart over all-time  
   • Sentiment Breakdown (latest)  
   • Demographics: National overview by default; optional multi-select for states
3. **Streamlit-only** UI and submission form
4. **Database Schema** (PostgreSQL)  
   `reference_data`, `raw_inputs`, `verified_polls`, `state_demographics`, `approval_ratings`
5. **Self-contained** – single repo, automatic virtual-env, one-command start-up

---

## 🗂️ Folder Structure

```
├── app_streamlit.py       # Main Streamlit interface
├── scheduler.py           # APScheduler-driven ingestion runner
├── extract/               # Extraction package
│   └── __init__.py        # X/Twitter extraction
├── transform/             # Transform package
│   └── __init__.py        # Sentiment + approval logic
├── db/                    # Database package
│   ├── connect.py         # SQLAlchemy engine factory
│   ├── load.py            # Generic DB load helpers
│   ├── load_demographics.py   # One-off CSV → DB loader
│   └── audit.py           # Audit event log helpers (DB)
├── data/
│   └── state_demographics.csv # INEC + projections
├── ingest/
│   └── ingest_grok.py     # CSV ingestion (watchdog or batch)
├── utils/
│   ├── logging_setup.py   # Centralized logging with rotation
│   └── __init__.py
└── logs/                  # Rotating log files (gitignored)
```

---

## 🚀 Quick-start (macOS/Linux)

```bash
# 1. Clone & enter repo
$ git clone https://github.com/youruser/pulsetrack.git
$ cd pulsetrack

# 2. Python venv & deps
$ python3 -m venv venv
$ source venv/bin/activate
$ pip install -r requirements.txt  # or see list below

# 3. PostgreSQL (Homebrew)
$ brew install postgresql@14
$ brew services start postgresql@14
$ createdb election_db

# 4. Environment variables
$ cp .env.example .env  # then edit
# .env contents
X_BEARER_TOKEN=your_twitter_bearer
DB_USER=$USER
DB_PASS=
DB_HOST=localhost
DB_NAME=election_db

# 5. Create tables & seed demographics
$ psql -d election_db -f sql/create_tables.sql   # or run the SQL snippet in README
$ python load_demographics.py

# 6. Seed demographics (one time)
$ python -m db.load_demographics

# 7. Start scheduler (optional)
$ ./venv/bin/python scheduler.py

# 8. Launch Streamlit UI
$ ./venv/bin/python -m streamlit run app_streamlit.py --server.port 8501 --server.address 0.0.0.0 --server.headless true
```

Open http://localhost:8501 for the live dashboard.  ETL logs output to the terminal every 10 minutes.

### SQL schema (quick copy-paste)
```sql
CREATE TABLE reference_data (
  id SERIAL PRIMARY KEY,
  source VARCHAR(255),
  data_type VARCHAR(100),
  value JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE raw_inputs (
  id SERIAL PRIMARY KEY,
  source VARCHAR(255),
  content TEXT,
  user_id VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  location VARCHAR(255)
);

CREATE TABLE verified_polls (
  id SERIAL PRIMARY KEY,
  poll_question TEXT,
  response JSONB,
  verification_status VARCHAR(50),
  score FLOAT,
  ref_id INTEGER REFERENCES reference_data(id),
  candidate VARCHAR(100)
);

CREATE TABLE state_demographics (
  state VARCHAR(50) PRIMARY KEY,
  total_population BIGINT,
  voting_age_population BIGINT,
  registered_voters BIGINT,
  political_affiliation VARCHAR(100),
  tribal_affiliation TEXT,
  employment_rate FLOAT,
  marriage_status TEXT,
  religious_affiliation TEXT
);

CREATE TABLE approval_ratings (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  candidate VARCHAR(100),
  rating_score FLOAT,
  change_delta FLOAT,
  state VARCHAR(50)
);
```

---

## 📦 Requirements

```
pandas requests tweepy psycopg2-binary sqlalchemy python-dotenv
nltk textblob apscheduler matplotlib
streamlit plotly
```
(Install via `pip install …` or `pip install -r requirements.txt`.)

---

## 🔧 How It Works

| Stage | Script | Detail |
|-------|--------|--------|
| Extract | `extract/` | Tweepy search of keywords ("Tinubu approval" etc.), returns JSON → DataFrame |
| Transform | `transform/` | Lower-case, regex clean, `TextBlob` polarity → approval %, verify against registered-voter threshold |
| Load | `db/` | Generic helper writes DataFrame → PostgreSQL via SQLAlchemy |
| Schedule | `scheduler.py` | APScheduler: every 10 min calls ingestion |
| Visualize | `app_streamlit.py` | Live gauges (30d), trends (all-time), demographics toggle |

---

## 📊 Data Sources

* **INEC 2023 registered-voter statistics** (93.47 M total) – until CVR update 2025
* **World Bank & Statista** population projections (2.5 % CAGR) → 2025 demographics
* **Twitter/X** public tweets (Academic Research API or elevated Free tier)
* **User polls** via embedded Streamlit form

---

## 📝 Logging & Audit

- File logs: `logs/pulsetrack.log` (rotates daily, 14-day retention)
- DB audit: `audit_log` table stores key events (scheduler start/stop, ingestions, archives, submissions)

### Streamlit Cloud deployment
1. Ensure repo has `requirements.txt` (present)
2. In Streamlit Cloud, create a new app → choose file `app_streamlit.py`
3. Set secrets in the UI (Settings → Secrets):
   - Either `DB_URL=postgresql://USER:PASS@HOST:PORT/DBNAME?sslmode=require`
   - Or parts: `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SSLMODE=require`
4. Seed demographics once locally: `python -m db.load_demographics`
5. Ingestion: upload CSVs in-app (optional uploader) or run `python -m ingest.ingest_grok` off-platform pointed at the same DB

---

## 🛡️ License

Source code: MIT.  
INEC statistics © Independent National Electoral Commission (public domain).

---

## 🙏 Acknowledgements

* geoBoundaries team (William & Mary geoLab) for open administrative boundaries
* INEC Nigeria for voter statistics
* Streamlit & Plotly for interactive visualisation stack

Happy hacking 🔥
