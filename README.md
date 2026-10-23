# PulseTrack

PulseTrackr is PulseTrack's community safety product on iPhone and the web. The website follows the app's core Map → Feed → Report flow; the iPhone app also provides SOS, trusted-contact alerts, and escorted walks. Voter and community data remain at `/insights` and `/snapstats`, outside the safety navigation.

**Live Site**: https://pulsetracker.org/

The web map and feed read the shared `safety_incidents_public` collection in real time and show reports from the last 24 hours. Browser reporting uses the app's `submit_incident` callable and requires Firebase App Check configuration. See [the unification plan](docs/web-unification.md) for the feature split and release dependencies.

---

## Current product surfaces

1. **PulseTrackr on the web** (React + Vite + TypeScript)
   - Map-first community safety home, including an empty map when no public reports are recent
   - Live feed, nearby filter, category search, incident detail and sharing
   - Browser incident reporting when Firebase App Check is configured

2. **PulseTrackr on iPhone**
   - Map, Feed, Report and Settings
   - SOS, trusted contacts, escorted walks, push alerts and background location

3. **Civic data**
   - `/insights` shows existing voter, population, and community data; `/snapstats` provides the map explorer
   - Candidate opinion intake and scheduled sentiment processing are retired. Historical records remain in Firestore.

---

## Historical civic insights architecture (retired)

This diagram describes the earlier candidate sentiment system. It is not an active data flow. The current `/insights` view reads `state_demographics` and static community estimates; `/api/submit_opinion` and `/api/admin_upload` return HTTP 410.

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                           │
│              (React + Vite + TypeScript)                    │
│                                                             │
│  Pages:                                                     │
│  • PulseTrack (Approval & Sentiment Charts)                │
│  • Snapstats (Geographic Map Visualization)                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Firebase SDK
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  FIREBASE SERVICES                          │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Hosting    │  │   Firestore  │  │ Cloud Functions │  │
│  │              │  │              │  │                 │  │
│  │ Static Files │  │  NoSQL DB    │  │ Python Backend  │  │
│  │ React Build  │  │  Collections │  │ ETL Processing  │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                      │
                      │ Scheduled Jobs (every 10 min)
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  ETL PIPELINE                               │
│                                                             │
│  • Fetch raw opinion data from Firestore                   │
│  • Analyze sentiment (TextBlob + NLTK)                     │
│  • Calculate approval scores                                │
│  • Aggregate by state/candidate/time                       │
│  • Store processed data back to Firestore                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
PulseTrack/
├── frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── hooks/         # Firestore data hooks
│   │   ├── lib/           # Firebase client
│   │   └── routes/        # Pages (PulseTrack, Snapstats)
│   └── public/snapstats/  # Static GeoJSON + demographics
│
├── functions/             # Cloud Functions (Python)
│   ├── main.py            # HTTP & scheduled functions
│   └── etl_processor.py   # Sentiment analysis engine
│
├── data/archive/          # Historical CSV data
├── firebase.json          # Firebase config
├── firestore.rules        # Security rules
├── firestore.indexes.json # Query indexes
└── seed.js                # Data seeding script
```

---

## 📦 Tech Stack

### Frontend
- **React 19** + **TypeScript** - Modern UI framework
- **Vite** - Fast build tool and dev server
- **TanStack Query** - Data fetching and caching
- **Recharts** - Interactive charts
- **Leaflet** + **React-Leaflet** - Map visualization
- **React Router** - Client-side routing
- **Firebase SDK** - Firestore client

### Backend
- **Firebase Cloud Functions** - Serverless Python backend
- **Cloud Firestore** - NoSQL database
- **Firebase Hosting** - CDN for static assets

### ETL/Processing
- **TextBlob** + **NLTK** - Natural language processing, sentiment analysis
- **Pandas** - Data manipulation
- **Python 3.12** - Runtime

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** and npm
- **Firebase CLI**: `npm install -g firebase-tools`
- **Firebase project** (create at [console.firebase.google.com](https://console.firebase.google.com))

### Setup

```bash
# 1. Clone repository
git clone https://github.com/yourusername/pulsetrack.git
cd pulsetrack

# 2. Firebase login and project setup
firebase login
firebase use <your-project-id>

# 3. Install frontend dependencies
cd frontend
npm install

# 4. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase config from Firebase Console > Project Settings
# Optional overrides:
#   VITE_SNAPSTATS_BASE_URL=https://storage.googleapis.com/<bucket>/snapstats
```

**⚠️ IMPORTANT - Environment Variables Security:**
- Never commit `.env.local` or `.env` files to Git
- Firebase API keys should always be stored in environment variables
- Add API key restrictions in Google Cloud Console to limit usage to your domains
- The `.env.example` file is a template only - copy it to `.env.local` with your actual credentials

### Local Development

```bash
# Run frontend dev server
cd frontend
npm run dev

# Visit http://localhost:5173
```

### Build Frontend

```bash
cd frontend
npm run build
```

## 🛠️ Repository Tasks

Install [go-task](https://taskfile.dev/#/installation) once (`brew install go-task` on macOS). After that, run common workflows from the repo root:

```bash
task dev:frontend          # Vite dev server
task typecheck:frontend    # TypeScript validation
task build:frontend        # Production build
task preview:frontend      # Serve dist/ locally
task functions:serve       # Firebase Functions emulator (Python)
task functions:test        # Run pytest suite for Cloud Functions
task data:convert-demographics  # Refresh Snapstats JSON assets
task docs:dataflow         # Quick pointer to the architecture doc
```

### Snapstats data pipeline

- `task data:convert-demographics` regenerates every file under `frontend/public/snapstats/derived` using the canonical `state_demographics.json` (or, when you add `--from-firestore`, directly from the `state_demographics` collection).
- To pull straight from Firestore, export credentials and run:

  ```bash
  export GOOGLE_APPLICATION_CREDENTIALS=service-account.json
  python3 scripts/convert_demographics_to_json.py --from-firestore
  ```

- The frontend reads all Snapstats assets via `SNAPSTATS_URLS` (see `frontend/src/lib/snapstatsConfig.ts`), so you can move the files to Cloud Storage/CDN by setting `VITE_SNAPSTATS_BASE_URL` without touching any React code.

## 📘 Dataflow Reference

See [`docs/dataflow.md`](./docs/dataflow.md) for the current civic data sources and the retired opinion flow.

### Seed Database (Optional)

```bash
# Install dependencies
npm install firebase-admin

# Historical import utility only; do not use for new candidate opinion collection
export GOOGLE_APPLICATION_CREDENTIALS=/secure/path/to/service-account.json
node seed.js          # Production (from CSV files)
node seed.js test     # Test data (synthetic)
```

---

## 🚢 Deployment

```bash
# Build frontend
cd frontend && npm run build && cd ..

# Deploy to Firebase
firebase deploy

# Or deploy selectively
firebase deploy --only hosting   # Frontend only
firebase deploy --only functions # Backend only
```

For detailed instructions, troubleshooting, and CI/CD setup, see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 🔄 Current civic data flow

- `/insights` reads `state_demographics` from Firestore for voter and population records.
- `/insights` and `/snapstats` read existing Snapstats static files for community and geographic estimates.
- Historical candidate opinion documents remain stored. The public and admin intake endpoints return HTTP 410, and the scheduled `process_etl` function is retired.

---

## 🔐 Security & Database

**Firestore Security Rules** (`firestore.rules`):
- Public read: `approval_ratings`, `sentiment_breakdown`, `state_demographics`
- `raw_inputs`: client writes disabled; retired HTTP endpoints no longer add records
- Admin-only: Other collections

**Environment Variables**:
- Frontend: Firebase config in `frontend/.env.local` (never commit)
- Functions: Auto-inherit credentials from Firebase
- Local seeding: use `GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_SERVICE_ACCOUNT_JSON`, or Application Default Credentials; do not store service-account JSON files in this repo.

**Database Schema**: See Firestore collections (`approval_ratings`, `sentiment_breakdown`, `state_demographics`, `raw_inputs`) in Firebase Console or code comments.

### Retired opinion APIs

`/api/submit_opinion` and `/api/admin_upload` return HTTP 410, including for cached clients. Their Hosting rewrites remain so callers receive that response instead of web app HTML.
