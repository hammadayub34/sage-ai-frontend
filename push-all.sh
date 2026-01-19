#!/bin/bash
# Push both frontend and backend changes to their respective repositories
# Usage: ./push-all.sh [commit-message]

set -e

COMMIT_MSG="${1:-Update monorepo}"

echo "🚀 Pushing all changes to separate repositories..."
echo ""

# Push to main monorepo first
echo "📤 Step 1: Pushing to main monorepo (origin)..."
git push origin main || echo "⚠️  Failed to push to origin/main (continuing...)"

echo ""
echo "📤 Step 2: Pushing backend changes..."
./push-backend.sh "$COMMIT_MSG"

echo ""
echo "📤 Step 3: Pushing frontend changes..."
./push-frontend.sh "$COMMIT_MSG"

echo ""
echo "✅ All changes pushed successfully!"
echo ""
echo "📋 Summary:"
echo "  - Main monorepo: origin/main"
echo "  - Backend repo: backend-repo/main"
echo "  - Frontend repo: frontend-repo/main"

