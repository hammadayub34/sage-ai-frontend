#!/usr/bin/env python3
"""
Script to check Pinecone index statistics including vector count
"""
import os
from pinecone import Pinecone
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Pinecone
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "alarm-manual")

if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY environment variable is required")

pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)

def check_pinecone_stats():
    """Get and display Pinecone index statistics"""
    print(f"🔍 Checking Pinecone index: {PINECONE_INDEX_NAME}\n")
    
    try:
        # Get index stats
        stats = index.describe_index_stats()
        
        print(f"📊 Index Statistics:")
        print(f"   Index Name: {PINECONE_INDEX_NAME}")
        print(f"   Total Vectors: {stats.get('total_vector_count', 'N/A')}")
        print(f"   Dimension: {stats.get('dimension', 'N/A')}")
        print(f"   Index Fullness: {stats.get('index_fullness', 'N/A')}")
        
        # Namespaces (if using namespaces)
        if 'namespaces' in stats:
            print(f"\n📁 Namespaces:")
            for namespace, ns_stats in stats['namespaces'].items():
                print(f"   {namespace}: {ns_stats.get('vector_count', 0)} vectors")
        
        # Note about tokens
        print(f"\nℹ️  Note: Pinecone stores vectors (embeddings), not tokens.")
        print(f"   Each vector represents a chunk of text that was embedded.")
        print(f"   The number of vectors = number of text chunks stored.")
        
        return stats
        
    except Exception as e:
        print(f"❌ Error getting index stats: {e}")
        return None

if __name__ == "__main__":
    check_pinecone_stats()

