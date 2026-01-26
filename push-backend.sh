#!/bin/bash
# Push backend changes to backend repository (everything except frontend/)
# Usage: ./push-backend.sh [commit-message]

set -e

echo "🔄 Pushing backend changes to backend repository..."

# Get commit message from argument or use default
COMMIT_MSG="${1:-Update backend}"

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

# Create or update split-backend branch
echo "📦 Updating split-backend branch..."
if git show-ref --verify --quiet refs/heads/split-backend; then
    # Branch exists, switch to it and merge main
    git checkout split-backend
    git merge main -m "Merge main into split-backend: $COMMIT_MSG" || {
        echo "⚠️  Merge conflict detected. Resolving by keeping backend files..."
        # If frontend exists, remove it
        if [ -d "frontend" ]; then
            git rm -r frontend/ 2>/dev/null || rm -rf frontend/
            git commit -m "Remove frontend from backend branch" || true
        fi
    }
else
    # Create branch from main
    git checkout -b split-backend main
    # Remove frontend if it exists
    if [ -d "frontend" ]; then
        git rm -r frontend/ 2>/dev/null || rm -rf frontend/
        git commit -m "Initial backend branch (frontend excluded)" || true
    fi
fi

# Ensure frontend is removed
if [ -d "frontend" ]; then
    echo "🧹 Removing frontend directory from backend branch..."
    git rm -r frontend/ 2>/dev/null || rm -rf frontend/
    git add -A
    git commit -m "Remove frontend: $COMMIT_MSG" || true
fi

# Push to backend repo
echo "📤 Pushing to backend-repo..."
git push backend-repo split-backend:main --force || {
    echo "❌ Push failed!"
    git checkout main
    exit 1
}

# Switch back to main
git checkout main

echo "✅ Backend changes pushed to backend-repo/main"

