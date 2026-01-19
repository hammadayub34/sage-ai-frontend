# RAG System Setup Guide

## Overview
This system uses Retrieval-Augmented Generation (RAG) with Pinecone to provide intelligent alarm response instructions based on the Alarm Response Manual.

## Prerequisites

1. **Pinecone Account**
   - Sign up at https://www.pinecone.io/
   - Get your API key from the dashboard

2. **OpenAI Account**
   - Sign up at https://platform.openai.com/
   - Get your API key
   - Ensure you have credits for embeddings and GPT-4o-mini

## Setup Steps

### 1. Set Environment Variables

Add to your `.env` file (project root):

```bash
# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=alarm-manual

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
```

For frontend (Next.js), also add to `.env.local` in the `frontend/` directory:

```bash
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=alarm-manual
OPENAI_API_KEY=your_openai_api_key_here
```

### 2. Embed the Alarm Manual

Run the embedding script to process and upload the manual to Pinecone:

```bash
python3 scripts/embed_alarm_manual.py
```

This script will:
- Parse `ALARM_RESPONSE_MANUAL.md`
- Split it into chunks by alarm section
- Generate embeddings using OpenAI
- Upload to Pinecone index

**Expected output:**
```
📖 Processing manual: /path/to/ALARM_RESPONSE_MANUAL.md
✅ Parsed 10 alarm sections
📦 Creating new index: alarm-manual
✅ Created index: alarm-manual
📤 Uploading 10 chunks to Pinecone...
  Processed 10/10 chunks...
📤 Uploading to Pinecone...
✅ Successfully uploaded 10 vectors to Pinecone!
```

### 3. Verify Setup

Check that the index was created in Pinecone dashboard:
- Go to https://app.pinecone.io/
- Verify index `alarm-manual` exists
- Check that it has vectors (should show ~10 vectors)

### 4. Test the RAG System

1. Start your services (if not already running):
   ```bash
   ./start_influxdb_writer.sh
   ./start_mock_plc.sh machine-01
   ./start_lathe_sim.sh lathe01
   ./start_alarm_monitor.sh
   ```

2. Trigger an alarm (or wait for one to occur naturally)

3. In the frontend:
   - Go to Alarm Events section
   - Click "📖 Instructions" button on any alarm
   - You should see a modal with RAG-generated instructions

## How It Works

### Flow:
1. **Alarm Received** → WebSocket message arrives
2. **User Clicks Instructions** → Frontend calls `/api/alarms/rag`
3. **RAG API**:
   - Creates query embedding: `"[alarm_type] alarm for [machine_type] machine [state]"`
   - Queries Pinecone (top 3 chunks)
   - Generates response using GPT-4o-mini with retrieved context
4. **Display** → Instructions shown in modal

### Query Example:
- Alarm: `AlarmLowProductLevel`
- Machine: `bottlefiller`
- State: `RAISED`
- Query: `"AlarmLowProductLevel alarm for bottlefiller machine RAISED"`

## Troubleshooting

### "PINECONE_API_KEY environment variable is not set"
- Ensure `.env` file exists in project root
- Check that variable name is exactly `PINECONE_API_KEY`
- Restart your terminal/IDE after adding to `.env`

### "OPENAI_API_KEY environment variable is not set"
- Same as above, but for `OPENAI_API_KEY`

### "Index not found" or "Index already exists"
- Check Pinecone dashboard for index status
- Delete and recreate if needed:
  ```python
  # In Python console
  from pinecone import Pinecone
  pc = Pinecone(api_key="your_key")
  pc.delete_index("alarm-manual")
  # Then run embed script again
  ```

### "No chunks found" when querying
- Verify embeddings were uploaded successfully
- Check that alarm name matches exactly (case-sensitive)
- Ensure machine_type filter matches (bottlefiller vs lathe)

### Frontend API errors
- Check browser console for detailed errors
- Verify environment variables are set in `.env.local`
- Restart Next.js dev server after adding env vars

## Cost Estimation

**Pinecone:**
- Free tier: 1 index, 100K vectors
- Our usage: ~10-20 vectors (very minimal)

**OpenAI:**
- Embeddings: ~$0.02 per 1M tokens (text-embedding-3-small)
- GPT-4o-mini: ~$0.15 per 1M input tokens, $0.60 per 1M output tokens
- Estimated cost per alarm query: < $0.001

## Maintenance

### Re-embedding the Manual
If you update `ALARM_RESPONSE_MANUAL.md`:
1. Delete existing index (optional, or just upsert new vectors)
2. Run embedding script again:
   ```bash
   python3 scripts/embed_alarm_manual.py
   ```

### Updating Index
The script uses `upsert`, so running it again will update existing vectors with new embeddings.

## Files Created

- `scripts/embed_alarm_manual.py` - Embedding script
- `frontend/lib/pinecone.ts` - Pinecone client
- `frontend/lib/embeddings.ts` - OpenAI embeddings
- `frontend/app/api/alarms/rag/route.ts` - RAG API endpoint
- `frontend/components/AlarmInstructions.tsx` - Instructions UI component

## Next Steps

1. Set your API keys in `.env` files
2. Run the embedding script
3. Test with a real alarm
4. Customize the prompt in `route.ts` if needed

