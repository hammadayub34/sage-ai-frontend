# Pinecone Deployment Guide for Replit

## Overview
Pinecone is a **managed cloud vector database service** - you don't run it in Docker or locally. It's accessed via API from anywhere.

## Best Practices for Replit Deployment

### 1. Set Environment Variables in Replit

In your Replit project, add these **Secrets** (environment variables):

1. Go to **Secrets** tab in Replit (lock icon in left sidebar)
2. Add the following secrets:

```
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=alarm-manual
OPENAI_API_KEY=your_openai_api_key_here
```

**Important Notes:**
- These are **secrets** - they won't be visible in your code
- They're automatically available as environment variables
- Use the same values for both frontend and backend if needed

### 2. Pinecone Account Setup

1. **Sign up** at https://www.pinecone.io/
2. **Get your API key** from the dashboard
3. **Create an index** (or use existing `alarm-manual`):
   - Index name: `alarm-manual`
   - Dimensions: `1536` (for `text-embedding-3-small`)
   - Metric: `cosine`
   - Pod type: `s1.x1` (or `p1.x1` for production)

### 3. Embed Your Documents (One-Time Setup)

Before deploying, embed your documents into Pinecone:

**Option A: Run locally before deploying**
```bash
# Embed alarm manual
python3 scripts/embed_alarm_manual.py

# Embed maintenance manual
python3 scripts/embed_maintenance_manual.py

# Embed work orders history (if you have work orders)
python3 scripts/embed_work_orders_history.py
```

**Option B: Run in Replit after deployment**
- Add these scripts to your Replit project
- Run them once to populate Pinecone
- They only need to run when you update the documents

### 4. Verify Pinecone Connection

Test that your Replit app can connect to Pinecone:

```python
# Test script (run once in Replit)
import os
from pinecone import Pinecone

api_key = os.getenv("PINECONE_API_KEY")
if api_key:
    pc = Pinecone(api_key=api_key)
    indexes = pc.list_indexes()
    print(f"Connected! Available indexes: {indexes}")
else:
    print("PINECONE_API_KEY not set!")
```

### 5. Code Configuration

Your code already uses environment variables correctly:

**Python scripts:**
```python
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "alarm-manual")
```

**Next.js/TypeScript:**
```typescript
const apiKey = process.env.PINECONE_API_KEY;
```

**For Next.js API routes**, you may need to add `NEXT_PUBLIC_` prefix or use server-side env vars:
- Server-side (API routes): `process.env.PINECONE_API_KEY` ✅
- Client-side: `process.env.NEXT_PUBLIC_PINECONE_API_KEY` (not recommended for API keys)

### 6. Replit-Specific Considerations

**For Next.js on Replit:**
- Environment variables set in Secrets are automatically available
- No need for `.env` files
- API routes can access `process.env.PINECONE_API_KEY` directly

**For Python scripts:**
- Use `os.getenv()` to access Replit secrets
- No need for `.env` files or `python-dotenv` in production

### 7. Cost Considerations

**Pinecone Pricing:**
- **Free tier**: Limited queries/month (good for development)
- **Paid plans**: Based on pod size and queries
- **Recommendation**: Start with free tier, upgrade when needed

**Optimization Tips:**
- Use `text-embedding-3-small` (cheaper than `text-embedding-ada-002`)
- Cache query results when possible
- Use appropriate pod sizes (don't over-provision)

### 8. Security Best Practices

✅ **DO:**
- Store API keys in Replit Secrets (not in code)
- Use different API keys for dev/prod if possible
- Rotate keys periodically
- Monitor usage in Pinecone dashboard

❌ **DON'T:**
- Commit API keys to git
- Hardcode keys in source files
- Share API keys publicly
- Use production keys in development

### 9. Troubleshooting

**Issue: "PINECONE_API_KEY not set"**
- Check Replit Secrets are set correctly
- Restart Replit after adding secrets
- Verify secret names match exactly (case-sensitive)

**Issue: "Index not found"**
- Create the index in Pinecone dashboard first
- Or run embedding scripts to create it automatically
- Check `PINECONE_INDEX_NAME` matches your index name

**Issue: "Connection timeout"**
- Check internet connectivity
- Verify API key is valid
- Check Pinecone service status

### 10. Deployment Checklist

- [ ] Pinecone account created
- [ ] API key obtained
- [ ] Index created (`alarm-manual`)
- [ ] Environment variables set in Replit Secrets
- [ ] Documents embedded into Pinecone
- [ ] Test connection from Replit
- [ ] Verify API routes can access Pinecone
- [ ] Test chat/RAG functionality

## Summary

**Pinecone is a cloud service - no Docker needed!**

1. Get API key from Pinecone dashboard
2. Set it as a Replit Secret
3. Your code already uses it via `process.env.PINECONE_API_KEY`
4. Embed documents once (scripts handle this)
5. Done! Your app will query Pinecone via API

No infrastructure to manage - Pinecone handles everything! 🚀

