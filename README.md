# PulseTrack

Real-time sentiment tracking for Nigerian political candidates using user opinions and NLP, focused on 2027 elections.

**Live Demo**: https://pulsetracker-0000.web.app

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
```

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

### Seed Database (Optional)

```bash
# Install dependencies
npm install firebase-admin

# Seed with historical data (Tinubu, Obi, Atiku) or generate test data
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

1. **User Interaction**: Users submit opinions via web form → stored in Firestore `raw_inputs`
2. **ETL Pipeline**: Cloud Function runs every 10 minutes, analyzes sentiment (TextBlob), calculates approval scores, writes to `approval_ratings` and `sentiment_breakdown`
3. **Data Visualization**: React hooks query Firestore, components render charts (Recharts) and maps (Leaflet)
4. **Static Assets**: GeoJSON and demographics served from CDN for fast map rendering

---

## 🔐 Security & Database

**Firestore Security Rules** (`firestore.rules`):
- Public read: `approval_ratings`, `sentiment_breakdown`, `state_demographics`
- Validated writes: `raw_inputs` (user submissions)
- Admin-only: Other collections

**Environment Variables**:
- Frontend: Firebase config in `frontend/.env.local` (never commit)
- Functions: Auto-inherit credentials from Firebase

**Database Schema**: See Firestore collections (`approval_ratings`, `sentiment_breakdown`, `state_demographics`, `raw_inputs`) in Firebase Console or code comments.

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

- **Live App**: https://pulsetracker-0000.web.app
- **Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Firebase Docs**: https://firebase.google.com/docs

---

For issues or advanced setup, see [DEPLOYMENT.md](./DEPLOYMENT.md).

