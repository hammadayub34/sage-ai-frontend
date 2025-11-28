# Chat Endpoint Setup Guide

## Overview

The chat endpoint allows users to ask questions about alarm procedures and machine operations. It uses RAG (Retrieval-Augmented Generation) with Pinecone and OpenAI to provide answers based on the alarm response manual.

## Backend Requirements

### 1. Environment Variables

Add these environment variables to your `.env` file in the **frontend directory** (or `.env.local`):

```bash
# OpenAI API Key (required)
OPENAI_API_KEY=your-openai-api-key-here

# Pinecone API Key (required)
PINECONE_API_KEY=your-pinecone-api-key-here

# Pinecone Index Name (optional, defaults to 'alarm-manual')
PINECONE_INDEX_NAME=alarm-manual
```

**Note**: In Next.js, environment variables used in API routes (server-side) don't need the `NEXT_PUBLIC_` prefix. They're automatically available in server components and API routes.

### 2. Pinecone Index Setup

The Pinecone index must already exist and contain the embedded alarm manual. If you haven't set it up yet:

1. **Run the embedding script** to populate Pinecone:
   ```bash
   python scripts/embed_alarm_manual.py
   ```

2. **Verify the index exists**:
   - Check your Pinecone dashboard
   - Index name should be `alarm-manual` (or whatever you set in `PINECONE_INDEX_NAME`)

### 3. Dependencies

All required dependencies are already in `package.json`:
- `@pinecone-database/pinecone` - Pinecone client
- `openai` - OpenAI API client

Install if needed:
```bash
cd frontend
npm install
```

## Frontend Requirements

### 1. API Route

The chat API route is located at:
- **File**: `frontend/app/api/chat/route.ts`
- **Endpoint**: `/api/chat`
- **Method**: POST

### 2. ChatBot Component

The ChatBot component is already set up at:
- **File**: `frontend/components/ChatBot.tsx`
- **Page**: `frontend/app/chat/page.tsx`

The component now makes API calls to `/api/chat` when a message is sent.

### 3. Library Files

These utility files are already in place:
- `frontend/lib/pinecone.ts` - Pinecone client initialization
- `frontend/lib/embeddings.ts` - OpenAI embedding creation

## How It Works

1. **User sends a message** via the ChatBot component
2. **Frontend** calls `/api/chat` with the message
3. **Backend**:
   - Creates an embedding of the user's message using OpenAI
   - Queries Pinecone to find relevant chunks from the alarm manual
   - Checks relevance score (threshold: 0.5)
   - If relevant, generates a response using GPT-3.5-turbo with context
   - Returns the response to the frontend
4. **Frontend** displays the response in the chat interface

## Testing

### 1. Check Environment Variables

Make sure your `.env` or `.env.local` file in the `frontend` directory has:
```bash
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=alarm-manual
```

### 2. Verify Pinecone Index

Ensure the Pinecone index exists and has data:
```bash
python scripts/embed_alarm_manual.py
```

### 3. Test the Chat Endpoint

1. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

2. Navigate to `/chat` page

3. Try asking questions like:
   - "What should I do when AlarmLowProductLevel is raised?"
   - "How do I troubleshoot a coolant low alarm?"
   - "What are the steps to resolve a door open alarm?"

### 4. Check Console Logs

If there are errors, check:
- Browser console (frontend errors)
- Terminal where `npm run dev` is running (backend/API errors)

## Troubleshooting

### Error: "PINECONE_API_KEY environment variable is not set"

**Solution**: Add `PINECONE_API_KEY` to your `.env` or `.env.local` file in the `frontend` directory.

### Error: "OPENAI_API_KEY environment variable is not set"

**Solution**: Add `OPENAI_API_KEY` to your `.env` or `.env.local` file in the `frontend` directory.

### Error: "Index not found" or "Index does not exist"

**Solution**: 
1. Create the index in Pinecone dashboard, OR
2. Run `python scripts/embed_alarm_manual.py` which will create it automatically

### Chat returns "not related to the manual"

**Solution**: This means the relevance score is below 0.5. The query might be too generic or not related to alarm procedures. Try asking more specific questions about alarms or machine operations.

### No response or timeout

**Solution**: 
1. Check that OpenAI API key is valid
2. Check that Pinecone API key is valid
3. Check network connectivity
4. Check browser console for errors

## API Endpoint Details

### Request

**POST** `/api/chat`

**Body**:
```json
{
  "message": "What should I do when AlarmLowProductLevel is raised?",
  "machine_type": "bottlefiller" // optional
}
```

### Response

**Success** (200):
```json
{
  "response": "When AlarmLowProductLevel is raised...",
  "relevant": true,
  "score": 0.85,
  "sources": [
    {
      "alarm_name": "AlarmLowProductLevel",
      "machine_type": "bottlefiller",
      "score": 0.85
    }
  ]
}
```

**Not Relevant** (200):
```json
{
  "response": "I'm sorry, but your question doesn't seem to be related to the alarm response manual...",
  "relevant": false,
  "score": 0.3
}
```

**Error** (400/500):
```json
{
  "error": "Error message here"
}
```

## Files Involved

### Backend (API Routes)
- `frontend/app/api/chat/route.ts` - Chat API endpoint

### Frontend (Components)
- `frontend/components/ChatBot.tsx` - Chat UI component
- `frontend/app/chat/page.tsx` - Chat page

### Utilities
- `frontend/lib/pinecone.ts` - Pinecone client
- `frontend/lib/embeddings.ts` - OpenAI embeddings

### Scripts
- `scripts/embed_alarm_manual.py` - Populate Pinecone index

---

**Last Updated**: January 2025  
**Version**: 1.0


