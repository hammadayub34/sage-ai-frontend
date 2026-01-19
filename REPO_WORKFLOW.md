# 🔄 Repository Workflow Guide

This project uses a **monorepo workflow** where you work on `main` branch and push changes to separate frontend and backend repositories.

## 📁 Repository Structure

- **Main Monorepo** (`origin`): Contains both frontend and backend
- **Backend Repo** (`backend-repo`): Contains everything except `frontend/`
- **Frontend Repo** (`frontend-repo`): Contains only `frontend/` directory

## 🚀 Daily Workflow

### 1. Work on Main Branch

```bash
# Make sure you're on main
git checkout main

# Make your changes (frontend, backend, or both)
# ... edit files ...

# Commit changes
git add .
git commit -m "Your commit message"
```

### 2. Push Changes

#### Option A: Push Everything (Recommended)
```bash
# Push to main monorepo AND both separate repos
./push-all.sh "Your commit message"
```

#### Option B: Push Individually
```bash
# Push only backend changes
./push-backend.sh "Update backend features"

# Push only frontend changes
./push-frontend.sh "Update frontend UI"
```

#### Option C: Push to Main Only
```bash
# Just push to the monorepo (if you're not ready to sync to separate repos)
git push origin main
```

## 📝 How It Works

The push scripts use `git subtree` to:
1. Split the relevant directory from `main` branch
2. Push it to the corresponding repository
3. Preserve git history

## ⚠️ Important Notes

1. **Always work on `main` branch** - This is your source of truth
2. **Commit before pushing** - The scripts check for uncommitted changes
3. **Backend repo excludes `frontend/`** - Everything else goes to backend
4. **Frontend repo is just `frontend/`** - Only the frontend directory

## 🔍 Checking Status

```bash
# See all remotes
git remote -v

# Check which branch you're on
git branch --show-current

# See uncommitted changes
git status
```

## 🐛 Troubleshooting

### "Push failed" error
- Make sure you've committed all changes first
- Check that remotes are configured: `git remote -v`
- Try pushing manually: `git push backend-repo main` or `git push frontend-repo main`

### "Frontend directory not found"
- Make sure you're on `main` branch: `git checkout main`

### "You have uncommitted changes"
- Commit your changes: `git add . && git commit -m "message"`
- Or stash them: `git stash`

## 📚 Quick Reference

```bash
# Switch to main
git checkout main

# Make changes and commit
git add .
git commit -m "Description"

# Push everything
./push-all.sh "Description"

# Or push individually
./push-backend.sh "Backend update"
./push-frontend.sh "Frontend update"
```

