#!/bin/bash
set -e

cd /Users/ndmx0/DEV/PulseTrack

echo "Checking git status..."

# Check if git repo exists
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
    git remote add origin https://github.com/ndmx/PulseTrack.git
fi

# Check current branch
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [ -z "$BRANCH" ]; then
    echo "Creating main branch..."
    git checkout -b main
fi

# Add all files
echo "Staging all files..."
git add -A

# Show status
echo "Git status:"
git status --short

# Commit
echo "Committing changes..."
git commit -m "Major updates: Firebase migration, UI improvements, demographics seeding

- Migrated frontend from Supabase to Firebase (Firestore)
- Migrated backend to Firebase Cloud Functions (Python)
- Fixed approval ratings data (corrected ETL overwriting seeded data)
- Updated state demographics with all 37 Nigerian states
- Fixed party colors (APC=Red, PDP=Green, LP=Crimson, NNPP=Blue)
- Enhanced interactive map tooltips with demographics and political data
- Improved Submit Opinion form UI (modern design, better UX)
- Seeded all candidates: Tinubu, Obi, Atiku with historical data
- Deployed to Firebase Hosting
" || echo "Nothing to commit or commit failed"

# Push to GitHub
echo "Pushing to GitHub..."
git push -u origin main --force

echo "Done! Check https://github.com/ndmx/PulseTrack"


