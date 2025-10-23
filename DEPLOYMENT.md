# Firebase Deployment Guide

Complete guide for deploying PulseTrack to Firebase.

---

## Prerequisites

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or use existing one
3. Enable required services:
   - ✅ Firestore Database
   - ✅ Cloud Functions (requires Blaze plan)
   - ✅ Firebase Hosting

### 2. Install Firebase CLI

```bash
npm install -g firebase-tools

# Login to Firebase
firebase login

# Verify installation
firebase --version
```

### 3. System Requirements

- **Node.js 20+** (check: `node --version`)
- **Python 3.12** (for Cloud Functions)
- **npm** (check: `npm --version`)

---

## Initial Setup

### 1. Configure Firebase Project

```bash
# In project root
firebase use <your-project-id>

# Or create .firebaserc manually:
{
  "projects": {
    "default": "your-project-id"
  }
}
```

### 2. Frontend Environment Variables

Create `frontend/.env.local`:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# Static files served from /snapstats/ (local public folder)
VITE_SNAPSTATS_GEOJSON_URL=/snapstats/nigeria_states.geojson
VITE_SNAPSTATS_TRIBE_STATS_URL=/snapstats/derived/tribe_stats.json
VITE_SNAPSTATS_ZONE_STATS_URL=/snapstats/derived/zone_stats.json
VITE_SNAPSTATS_PARTY_STATS_URL=/snapstats/derived/party_stats.json
```

**Get Firebase config values**:
1. Firebase Console > Project Settings
2. General tab > Your apps > SDK setup and configuration
3. Copy values from config object

**Important**: Never use Supabase URLs or external storage URLs. All static files should be served from the local `/snapstats/` directory.

### 3. Install Dependencies

```bash
# Frontend dependencies
cd frontend
npm install

# Root dependencies (for seeding)
cd ..
npm install
```

---

## Firestore Setup

### 1. Create Firestore Database

1. Firebase Console > Firestore Database > **Create database**
2. Choose **production mode**
3. Select location (closest to your users, e.g., `us-central1`)

### 2. Deploy Security Rules

```bash
firebase deploy --only firestore:rules
```

This deploys `firestore.rules` which defines:
- Public read for core collections
- Validated writes for user submissions
- Admin-only access for sensitive data

### 3. Deploy Indexes

```bash
firebase deploy --only firestore:indexes
```

This creates composite indexes for optimized queries.

### 4. Seed Initial Data

```bash
# Install seeding dependencies
npm install firebase-admin

# Seed production data from CSV files
node seed.js

# Or seed test data (synthetic)
node seed.js test
```

---

## Deployment

### Full Deployment (Everything)

```bash
# 1. Build frontend
cd frontend
npm run build
cd ..

# 2. Deploy all Firebase services
firebase deploy
```

This deploys:
- ✅ Frontend (Hosting)
- ✅ Cloud Functions
- ✅ Firestore rules & indexes

### Selective Deployment

Deploy specific services:

```bash
# Frontend only
cd frontend && npm run build && cd ..
firebase deploy --only hosting

# Firestore rules only
firebase deploy --only firestore:rules

# Firestore indexes only
firebase deploy --only firestore:indexes

# Cloud Functions only
firebase deploy --only functions

# Specific function
firebase deploy --only functions:process_etl
```

---

## Cloud Functions Setup

### Requirements

Cloud Functions require the **Blaze (pay-as-you-go) plan**.

**Upgrade your project**:
1. Firebase Console > Usage and billing
2. Click "Modify plan"
3. Select Blaze plan

**Don't worry**: The free tier is generous:
- 2M function invocations/month
- 400K GB-seconds compute time
- 200K CPU-seconds

For typical usage, costs are minimal ($0-5/month).

### Deploy Functions

```bash
cd functions

# Create virtual environment
python3.12 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Deploy
cd ..
firebase deploy --only functions
```

### Verify Functions

```bash
# Check deployment status
firebase functions:list

# Test health check endpoint
curl https://us-central1-<your-project-id>.cloudfunctions.net/healthz

# View logs
firebase functions:log
```

---

## Post-Deployment Verification

### 1. Verify Frontend

Visit your Firebase Hosting URL:
```
https://<your-project-id>.web.app
```

**Checklist**:
- [ ] Homepage loads without errors
- [ ] Approval cards display (may be empty if no data)
- [ ] Opinion submission form works
- [ ] Snapstats page loads map and GeoJSON
- [ ] Browser console shows no errors

### 2. Verify Firestore

1. Firebase Console > Firestore Database
2. Check that collections exist:
   - `state_demographics`
   - `approval_ratings`
   - `sentiment_breakdown`
   - `raw_inputs`
3. Verify security rules allow public reads

### 3. Verify Cloud Functions

```bash
# Stream function logs
firebase functions:log --follow

# Test submit_opinion endpoint
curl -X POST https://us-central1-<project-id>.cloudfunctions.net/submit_opinion \
  -H "Content-Type: application/json" \
  -d '{"content":"Test opinion","candidate":"Tinubu","location":"Lagos","user_id":"test"}'
```

### 4. Verify Scheduled Function

The `process_etl` function runs every 10 minutes automatically.

**Check Cloud Scheduler**:
1. Google Cloud Console > Cloud Scheduler
2. Look for `firebase-schedule-process_etl`
3. Status should be "Active"

Or via CLI:
```bash
gcloud scheduler jobs list
```

---

## Monitoring

### Firebase Console

- **Hosting**: Performance & usage metrics
  - Firebase Console > Hosting > Dashboard
- **Functions**: Invocations, errors, execution time
  - Firebase Console > Functions > Dashboard
- **Firestore**: Reads, writes, deletes
  - Firebase Console > Firestore Database > Usage tab

### Logging

```bash
# Stream all function logs
firebase functions:log --follow

# Filter by function name
firebase functions:log --only process_etl

# Filter by severity
firebase functions:log --only functions --min-severity error
```

### Cost Monitoring

Check Firebase Console > Usage and billing:
- **Hosting**: 10 GB storage, 360 MB/day transfer (free tier)
- **Firestore**: 50K reads, 20K writes, 20K deletes per day (free tier)
- **Functions**: 2M invocations per month (free tier)

Set up billing alerts to avoid surprises.

---

## Troubleshooting

### Frontend Issues

#### Build Fails

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### Environment Variables Not Loading

1. Verify `.env.local` exists in `frontend/` directory
2. Check all variables start with `VITE_`
3. Restart dev server after changing `.env.local`
4. Rebuild: `npm run build`

#### Snapstats Page Not Loading

**Symptom**: "We couldn't load the map data"  
**Console Error**: `ERR_NAME_NOT_RESOLVED` for Supabase URLs

**Solution**:

1. Open `frontend/.env.local`
2. **Remove** any Supabase URLs:
   ```env
   # ❌ DELETE THESE
   VITE_SUPABASE_URL=https://nahembixfnqfejzeorme.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_SNAPSTATS_GEOJSON_URL=https://...supabase.co/storage/...
   ```

3. **Add** local static file paths:
   ```env
   # ✅ USE THESE
   VITE_SNAPSTATS_GEOJSON_URL=/snapstats/nigeria_states.geojson
   VITE_SNAPSTATS_TRIBE_STATS_URL=/snapstats/derived/tribe_stats.json
   VITE_SNAPSTATS_ZONE_STATS_URL=/snapstats/derived/zone_stats.json
   VITE_SNAPSTATS_PARTY_STATS_URL=/snapstats/derived/party_stats.json
   ```

4. Rebuild and redeploy:
   ```bash
   cd frontend
   npm run build
   cd ..
   firebase deploy --only hosting
   ```

#### Static Files Not Found (404)

Verify files exist in `frontend/public/snapstats/`:
```bash
ls -la frontend/public/snapstats/
ls -la frontend/public/snapstats/derived/
```

Should contain:
- `nigeria_states.geojson`
- `state_demographics.json`
- `derived/demographics.json`
- `derived/party_stats.json`
- `derived/tribe_stats.json`
- `derived/zone_stats.json`

### Firestore Issues

#### Permission Denied Errors

1. Deploy security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

2. Verify rules in `firestore.rules` allow public read for:
   - `approval_ratings`
   - `sentiment_breakdown`
   - `state_demographics`

3. Check browser console for specific error messages

#### Queries Too Slow

Deploy composite indexes:
```bash
firebase deploy --only firestore:indexes
```

Or create indexes manually via Firebase Console when Firestore suggests them in error messages.

### Cloud Functions Issues

#### Deploy Fails: "Must be on Blaze plan"

**Error**: `Required API cloudbuild.googleapis.com can't be enabled until the upgrade is complete`

**Solution**: Upgrade to Blaze plan (see [Cloud Functions Setup](#cloud-functions-setup))

#### Function Deploy Fails: Virtual Environment Not Found

```bash
cd functions
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..
firebase deploy --only functions
```

#### Functions Return Wrong Content-Type

Verify all responses in `functions/main.py` use:
```python
return https_fn.Response(
    json.dumps({"data": "value"}),
    status=200,
    headers={"Content-Type": "application/json"}
)
```

#### Scheduled Function Not Running

1. Check Cloud Scheduler job exists:
   ```bash
   gcloud scheduler jobs list
   ```

2. Manually trigger for testing:
   ```bash
   gcloud scheduler jobs run firebase-schedule-process_etl
   ```

3. Check function logs:
   ```bash
   firebase functions:log --only process_etl
   ```

### Authentication Issues

#### Firebase Login Fails

```bash
# Reauth
firebase login --reauth

# Or use CI token for headless environments
firebase login:ci
```

#### Credentials Expired

```bash
firebase login --reauth
```

---

## Custom Domain (Optional)

1. Firebase Console > Hosting > **Add custom domain**
2. Enter your domain (e.g., `pulsetrack.com`)
3. Follow DNS configuration instructions:
   - Add A records or CNAME records as specified
4. Wait for SSL certificate provisioning (~24 hours)

---

## CI/CD with GitHub Actions (Optional)

Create `.github/workflows/firebase-deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Build
        run: cd frontend && npm run build
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: your-project-id
```

**Setup**:
1. Generate service account key:
   - Firebase Console > Project Settings > Service Accounts
   - Generate new private key
2. Add to GitHub Secrets as `FIREBASE_SERVICE_ACCOUNT`

---

## Rollback

If deployment fails or breaks production:

### Hosting Rollback

```bash
# List previous versions
firebase hosting:channel:list

# Clone previous version to live
firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live
```

### Functions Rollback

```bash
# Checkout previous commit
git checkout <previous-commit-hash>

# Redeploy functions
firebase deploy --only functions

# Return to latest
git checkout main
```

---

## Deployment Checklist

Before deploying to production, verify:

- [ ] All environment variables are set correctly in `frontend/.env.local`
- [ ] Frontend builds without errors (`npm run build`)
- [ ] Static files exist in `frontend/public/snapstats/`
- [ ] Firestore security rules are production-ready
- [ ] Cloud Functions pass local testing
- [ ] Service account JSON is present (for seeding)
- [ ] Database is seeded with initial data
- [ ] Firebase project is on Blaze plan (for Cloud Functions)
- [ ] Custom domain DNS is configured (if applicable)

After deployment:

- [ ] Visit live URL and test all pages
- [ ] Submit test opinion via form
- [ ] Check Firestore for new data
- [ ] Verify Cloud Function logs show no errors
- [ ] Test Snapstats page loads map correctly
- [ ] Check browser console for any errors
- [ ] Monitor Firebase usage for first 24 hours

---

## Support Resources

- **Firebase Documentation**: https://firebase.google.com/docs
- **Firestore Best Practices**: https://firebase.google.com/docs/firestore/best-practices
- **Cloud Functions Docs**: https://firebase.google.com/docs/functions
- **Firebase CLI Reference**: https://firebase.google.com/docs/cli

---

**Need help?** Check the [main README](./README.md) or open an issue on GitHub.

