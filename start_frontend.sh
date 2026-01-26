#!/bin/bash
# Start the frontend development server

cd "$(dirname "$0")/frontend"

echo "🚀 Starting PLC Monitoring Frontend..."
echo "📦 Installing dependencies (if needed)..."
npm install

echo ""
echo "✅ Starting Next.js development server on port 3005..."
echo "🌐 Open http://localhost:3005 in your browser"
echo ""

npm run dev

