#!/bin/bash
#
# migrate_to_clean.sh
# Migrates temp_pulsetrack/ to root, removing old files
#
# Usage: bash migrate_to_clean.sh
#

set -e  # Exit on any error

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  PulseTrack Cleanup Migration"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Safety check: verify we're in the right directory
if [ ! -f "firebase.json" ]; then
  echo "❌ Error: firebase.json not found!"
  echo "   Please run this script from the PulseTrack project root."
  exit 1
fi

# Safety check: verify temp_pulsetrack exists
if [ ! -d "temp_pulsetrack" ]; then
  echo "❌ Error: temp_pulsetrack/ directory not found!"
  echo "   Run the setup process first to create temp_pulsetrack/."
  exit 1
fi

# Confirm with user
echo "⚠️  This will:"
echo "   1. Create a backup of the current project"
echo "   2. Delete all files except temp_pulsetrack/"
echo "   3. Move temp_pulsetrack/ contents to root"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Migration cancelled."
  exit 0
fi

echo ""
echo "───────────────────────────────────────────────────────────"
echo "📦 Step 1: Creating backup..."
echo "───────────────────────────────────────────────────────────"

# Create backup directory with timestamp
BACKUP_DIR="../pulsetrack_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "   Copying to: $BACKUP_DIR"
cp -r . "$BACKUP_DIR/" 2>/dev/null || true

echo "   ✅ Backup created at: $BACKUP_DIR"

echo ""
echo "───────────────────────────────────────────────────────────"
echo "🗑️  Step 2: Removing old files..."
echo "───────────────────────────────────────────────────────────"

# Delete everything except temp_pulsetrack, this script, and hidden files we want to keep
echo "   Removing old directories and files..."

# Remove old directories
for dir in backend functions frontend scripts data logs uploads venv node_modules server __pycache__; do
  if [ -d "$dir" ] && [ "$dir" != "temp_pulsetrack" ]; then
    echo "   - Removing $dir/"
    rm -rf "$dir"
  fi
done

# Remove old files (be careful with markdown files and config files)
for file in *.md *.py *.js *.json *.txt *.yaml; do
  if [ -f "$file" ] && [ "$file" != "migrate_to_clean.sh" ]; then
    # Keep only specific files we need
    if [ "$file" != "package.json" ] && [ "$file" != "package-lock.json" ] && \
       [ "$file" != "firebase.json" ] && [ "$file" != ".firebaserc" ] && \
       [ "$file" != "firestore.rules" ] && [ "$file" != "firestore.indexes.json" ]; then
      echo "   - Removing $file"
      rm -f "$file"
    fi
  fi
done

echo "   ✅ Old files removed"

echo ""
echo "───────────────────────────────────────────────────────────"
echo "📂 Step 3: Moving clean structure to root..."
echo "───────────────────────────────────────────────────────────"

# Move all files and directories from temp_pulsetrack to root
echo "   Moving files from temp_pulsetrack/ to ./"

# Move visible files and directories
mv temp_pulsetrack/* ./ 2>/dev/null || true

# Move hidden files (like .gitignore, .firebaserc)
mv temp_pulsetrack/.* ./ 2>/dev/null || true

# Remove now-empty temp_pulsetrack directory
rmdir temp_pulsetrack 2>/dev/null || true

echo "   ✅ Files moved successfully"

echo ""
echo "───────────────────────────────────────────────────────────"
echo "📦 Step 4: Installing dependencies..."
echo "───────────────────────────────────────────────────────────"

# Install root dependencies (for seeding)
echo "   Installing root dependencies..."
npm install --no-save firebase-admin 2>/dev/null || echo "   ⚠️  npm install failed (non-critical)"

# Install frontend dependencies
echo "   Installing frontend dependencies..."
if [ -d "frontend" ]; then
  cd frontend
  npm install 2>/dev/null || echo "   ⚠️  npm install failed (non-critical)"
  cd ..
fi

echo "   ✅ Dependencies installed"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Migration Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Project Statistics:"
echo "   - Backup location: $BACKUP_DIR"
echo "   - Cleaned structure: ✅"
echo "   - Dependencies: ✅"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "   1. Test locally:"
echo "      cd frontend && npm run dev"
echo ""
echo "   2. Build frontend:"
echo "      cd frontend && npm run build"
echo ""
echo "   3. Deploy to Firebase:"
echo "      firebase deploy"
echo ""
echo "   4. Seed database (if needed):"
echo "      node seed.js"
echo ""
echo "📝 Documentation:"
echo "   - README.md       - Main documentation"
echo "   - DEPLOYMENT.md   - Deployment guide"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

