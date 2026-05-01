# PulseTrack

Real-time sentiment tracking for Nigerian political candidates using user opinions and NLP, focused on 2027 elections.

**Live Site**: https://pulsetracker.org/

---

## ✨ Key Features

1. **Modern React Frontend** (Vite + TypeScript)  
   - Interactive approval rating cards, trend charts, and sentiment visualizations  
   - Geographic data explorer with Leaflet maps (Snapstats)  
   - State-level demographic insights and filtering  
   - User opinion submission form

2. **Firebase Full-Stack**  
   - **Hosting**: Global CDN for static assets  
   - **Database**: Cloud Firestore (NoSQL, serverless, no hibernation)  
   - **Functions**: Python backend for ETL pipeline

3. **Automated ETL Pipeline**  
   - Runs every 10 minutes via Cloud Scheduler  
   - Extracts user submissions, analyzes sentiment (TextBlob + NLTK)  
   - Calculates approval scores and aggregates by candidate/state/time

---

## 🏗️ Architecture

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
#   VITE_SUBMIT_OPINION_URL=https://<your-cloud-function-url>/submit_opinion
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

See [`docs/dataflow.md`](./docs/dataflow.md) for an end-to-end description of how submissions travel through Firestore, the ETL pipeline, and the frontend visualizations. Keep it updated when the ingestion or processing layers change.

### Seed Database (Optional)

```bash
# Install dependencies
npm install firebase-admin

# Seed with historical data (Tinubu, Obi, Atiku) or generate test data
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

## 🔄 How It Works

1. **User Interaction**: Users submit opinions via `/api/submit_opinion` (Cloud Function) which rate-limits, validates, and normalizes locations before writing to Firestore `raw_inputs`
2. **ETL Pipeline**: Cloud Function runs every 10 minutes, analyzes sentiment (TextBlob), calculates approval scores, writes to `approval_ratings` and `sentiment_breakdown`
3. **Data Visualization**: React hooks query Firestore, components render charts (Recharts) and maps (Leaflet)
4. **Static Assets**: GeoJSON and demographics served from CDN for fast map rendering

---

## 🔐 Security & Database

**Firestore Security Rules** (`firestore.rules`):
- Public read: `approval_ratings`, `sentiment_breakdown`, `state_demographics`
- `raw_inputs`: write access disabled for clients (all submissions flow through Cloud Functions)
- Admin-only: Other collections

**Environment Variables**:
- Frontend: Firebase config in `frontend/.env.local` (never commit)
- Functions: Auto-inherit credentials from Firebase
- Local seeding: use `GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_SERVICE_ACCOUNT_JSON`, or Application Default Credentials; do not store service-account JSON files in this repo.

**Database Schema**: See Firestore collections (`approval_ratings`, `sentiment_breakdown`, `state_demographics`, `raw_inputs`) in Firebase Console or code comments.

### Admin Upload API

- Endpoint: `POST /api/admin_upload`
- Authentication: supply `x-api-key` header that matches the `ADMIN_API_KEY` secret configured for Cloud Functions.
- Payloads:
  - JSON: `{ "records": [ { "candidate": "...", "location": "...", "content": "..." }, ... ] }`
  - CSV upload (`multipart/form-data`) with matching column headers.
- Set the secret once per project:

```bash
firebase functions:secrets:set ADMIN_API_KEY
firebase deploy --only functions
```

For local emulators, export `ADMIN_API_KEY` before running `task functions:serve`.

---

## 🔒 Security Best Practices

### API Key Management

**Never commit API keys to Git:**
- All Firebase credentials are stored in `frontend/.env.local` (gitignored)
- Use the template `frontend/.env.example` to create your local environment file
- The exposed key has been removed from Git history

**Add API Key Restrictions in Google Cloud Console:**

1. Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. Select your Firebase project
3. Click on your API key to edit
4. Add **Application restrictions**:
   - Select "HTTP referrers (web sites)"
   - Add your domains:
     - `https://pulsetracker-0000.web.app/*`
     - `https://pulsetracker-0000.firebaseapp.com/*`
     - `https://pulsetracker.org/*`
     - `http://localhost:5173/*` (for local development)
5. Add **API restrictions**:
   - Select "Restrict key"
   - Enable only required APIs:
     - Cloud Firestore API
     - Firebase Hosting API
6. Click "Save"

**Note**: Firebase API keys are safe to expose in client-side code IF properly restricted. The restrictions above ensure your key can only be used from your authorized domains and for specific Firebase services.

---

## 🛡️ License

Source code: MIT  
INEC statistics © Independent National Electoral Commission (public domain)

---

## 🙏 Acknowledgements

- **geoBoundaries** - Open administrative boundaries
- **INEC Nigeria** - Voter statistics (93.47M registered voters, 2023)
- **World Bank & Statista** - Population projections
- **Firebase & TextBlob** - Infrastructure and NLP tools

---

## 🔗 Links

- **Live App**: https://pulsetracker.org/
- **Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Firebase Docs**: https://firebase.google.com/docs

---

For issues or advanced setup, see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

**Designed by edentv** - Creator Studio
