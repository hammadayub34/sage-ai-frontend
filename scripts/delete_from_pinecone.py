#!/usr/bin/env python3
"""
Delete a specific work order from Pinecone
"""
import os
import sys
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "alarm-manual")

if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY environment variable is required")

pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)

work_order_no = sys.argv[1] if len(sys.argv) > 1 else None

if not work_order_no:
    print("Usage: python3 delete_from_pinecone.py <work_order_no>")
    sys.exit(1)

print(f"🔍 Searching for work order {work_order_no} in Pinecone...")

# Query to find the vector
dummy_vector = [0.0] * 1536
result = index.query(
    vector=dummy_vector,
    top_k=200,
    include_metadata=True,
    filter={
        'document_type': {'$eq': 'work_order_history'},
        'work_order_no': {'$eq': work_order_no}
    }
)

if result.matches:
    vector_ids = [match.id for match in result.matches]
    print(f"✅ Found {len(vector_ids)} vector(s) to delete: {vector_ids}")
    
    # Delete the vectors
    index.delete(ids=vector_ids)
    print(f"✅ Deleted {len(vector_ids)} vector(s) from Pinecone")
else:
    print(f"❌ Work order {work_order_no} not found in Pinecone")

