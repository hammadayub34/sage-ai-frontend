#!/usr/bin/env python3
"""
Script to check what data is stored in Pinecone
"""
import os
from pinecone import Pinecone
from dotenv import load_dotenv
from collections import defaultdict

# Load environment variables
load_dotenv()

# Initialize Pinecone
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "alarm-manual")

if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY environment variable is required")

pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)

def check_pinecone_contents():
    """Query Pinecone to see what document types and data are stored"""
    print(f"🔍 Checking Pinecone index: {PINECONE_INDEX_NAME}\n")
    
    # Get index stats
    try:
        stats = index.describe_index_stats()
        print(f"📊 Index Statistics:")
        print(f"   Total vectors: {stats.get('total_vector_count', 'N/A')}")
        print(f"   Dimension: {stats.get('dimension', 'N/A')}")
        print(f"   Index fullness: {stats.get('index_fullness', 'N/A')}")
        print()
    except Exception as e:
        print(f"⚠️  Could not get index stats: {e}\n")
    
    # Query with a dummy vector to get some sample data
    # We'll use a zero vector of the right dimension
    try:
        stats = index.describe_index_stats()
        dimension = stats.get('dimension', 1536)  # Default OpenAI embedding dimension
    except:
        dimension = 1536
    
    # Create a dummy query vector (all zeros)
    dummy_vector = [0.0] * dimension
    
    # Query to get sample vectors
    print("📋 Sampling vectors from index...\n")
    try:
        # Query without filter to get samples
        sample_query = index.query(
            vector=dummy_vector,
            top_k=100,  # Get up to 100 samples
            include_metadata=True
        )
        
        # Group by document_type
        by_document_type = defaultdict(list)
        by_machine_type = defaultdict(int)
        alarm_names = set()
        unique_vectors = set()
        
        for match in sample_query.matches:
            metadata = match.metadata or {}
            doc_type = metadata.get('document_type', 'unknown')
            machine_type = metadata.get('machine_type', 'unknown')
            alarm_name = metadata.get('alarm_name', '')
            
            by_document_type[doc_type].append({
                'id': match.id,
                'score': match.score,
                'machine_type': machine_type,
                'alarm_name': alarm_name,
                'metadata_keys': list(metadata.keys())
            })
            
            by_machine_type[machine_type] += 1
            if alarm_name:
                alarm_names.add(alarm_name)
            unique_vectors.add(match.id)
        
        print(f"📚 Document Types Found:")
        for doc_type, vectors in by_document_type.items():
            print(f"   {doc_type}: {len(vectors)} vectors")
        print()
        
        print(f"🏭 Machine Types Found:")
        for machine_type, count in sorted(by_machine_type.items()):
            print(f"   {machine_type}: {count} vectors")
        print()
        
        print(f"⚠️  Alarm Names Found ({len(alarm_names)} unique):")
        for alarm in sorted(alarm_names)[:20]:  # Show first 20
            print(f"   - {alarm}")
        if len(alarm_names) > 20:
            print(f"   ... and {len(alarm_names) - 20} more")
        print()
        
        print(f"📊 Summary:")
        print(f"   Total unique vectors sampled: {len(unique_vectors)}")
        print(f"   Document types: {len(by_document_type)}")
        print(f"   Machine types: {len(by_machine_type)}")
        print(f"   Unique alarm names: {len(alarm_names)}")
        print()
        
        # Show sample metadata for each document type
        print("📄 Sample Metadata by Document Type:")
        for doc_type, vectors in by_document_type.items():
            if vectors:
                sample = vectors[0]
                print(f"\n   {doc_type}:")
                print(f"      Vector ID: {sample['id']}")
                print(f"      Machine Type: {sample['machine_type']}")
                print(f"      Alarm Name: {sample['alarm_name']}")
                print(f"      Metadata Keys: {', '.join(sample['metadata_keys'])}")
        
    except Exception as e:
        print(f"❌ Error querying Pinecone: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_pinecone_contents()

