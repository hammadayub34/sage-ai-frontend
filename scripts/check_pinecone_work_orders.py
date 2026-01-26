#!/usr/bin/env python3
"""
Check if there are any work orders in Pinecone
"""
import os
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "alarm-manual")

if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY environment variable is required")

pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)

print("🔍 Searching for work orders in Pinecone...")

# Query to find all work order vectors
dummy_vector = [0.0] * 1536
result = index.query(
    vector=dummy_vector,
    top_k=1000,  # Get up to 1000 results
    include_metadata=True,
    filter={
        'document_type': {'$eq': 'work_order_history'}
    }
)

if result.matches:
    work_orders = set()
    for match in result.matches:
        wo_no = match.metadata.get('work_order_no', 'Unknown')
        work_orders.add(wo_no)
    
    print(f"\n✅ Found {len(work_orders)} unique work order(s) in Pinecone:")
    for wo in sorted(work_orders):
        count = sum(1 for m in result.matches if m.metadata.get('work_order_no') == wo)
        print(f"   - {wo} ({count} vector(s))")
    
    print(f"\n📊 Total vectors: {len(result.matches)}")
else:
    print("\n❌ No work orders found in Pinecone")

