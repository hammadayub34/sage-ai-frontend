#!/usr/bin/env python3
"""
Delete all work orders from Pinecone
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

print("🔍 Searching for all work orders in Pinecone...")

# Query to find all work order vectors
dummy_vector = [0.0] * 1536
result = index.query(
    vector=dummy_vector,
    top_k=1000,
    include_metadata=True,
    filter={
        'document_type': {'$eq': 'work_order_history'}
    }
)

if result.matches:
    work_orders = set()
    vector_ids = []
    
    for match in result.matches:
        wo_no = match.metadata.get('work_order_no', 'Unknown')
        work_orders.add(wo_no)
        vector_ids.append(match.id)
    
    print(f"\n✅ Found {len(work_orders)} unique work order(s) with {len(vector_ids)} total vector(s) in Pinecone:")
    for wo in sorted(work_orders):
        count = sum(1 for m in result.matches if m.metadata.get('work_order_no') == wo)
        print(f"   - {wo} ({count} vector(s))")
    
    # Confirm deletion
    print(f"\n⚠️  This will delete {len(vector_ids)} vector(s) from Pinecone")
    confirm = input("Are you sure you want to continue? (yes/no): ")
    if confirm.lower() != 'yes':
        print("❌ Deletion cancelled")
        exit(0)
    
    # Delete all vectors
    print(f"\n🗑️  Deleting {len(vector_ids)} vector(s) from Pinecone...")
    index.delete(ids=vector_ids)
    print(f"✅ Successfully deleted {len(vector_ids)} vector(s) from Pinecone")
    
    # Verify deletion
    print("\n🔍 Verifying deletion...")
    verify_result = index.query(
        vector=dummy_vector,
        top_k=1000,
        include_metadata=True,
        filter={
            'document_type': {'$eq': 'work_order_history'}
        }
    )
    
    if verify_result.matches:
        print(f"⚠️  Warning: Still found {len(verify_result.matches)} vector(s) in Pinecone")
    else:
        print("✅ Confirmed: All work orders deleted from Pinecone")
else:
    print("\n❌ No work orders found in Pinecone")

