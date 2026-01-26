#!/bin/bash
# Push frontend changes to frontend repository
# Usage: ./push-frontend.sh [commit-message]

set -e

echo "🔄 Pushing frontend changes to frontend repository..."

# Get commit message from argument or use default
COMMIT_MSG="${1:-Update frontend}"

# Make sure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Warning: You're on '$CURRENT_BRANCH', not 'main'"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    echo "❌ Frontend directory not found!"
    exit 1
fi

# Push frontend/ to frontend repo
echo "📦 Creating subtree split for frontend..."
git subtree push --prefix=frontend frontend-repo main --squash -m "$COMMIT_MSG" || {
    echo "❌ Push failed. Trying with force (if this is the first push)..."
    git push frontend-repo $(git subtree split --prefix=frontend main):main --force
}

echo "✅ Frontend changes pushed to frontend-repo/main"

