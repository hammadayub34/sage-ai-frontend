#!/usr/bin/env python3
"""
Script to chunk and embed a markdown document (from PDF) into Pinecone
Usage: python3 embed_pdf_document.py <input.md> [document_type] [document_name]
"""
import os
import re
import sys
from pathlib import Path
from typing import List, Dict
from pinecone import Pinecone
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize clients
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "alarm-manual")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY environment variable is required")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required")

# Initialize Pinecone (v8 API)
pc = Pinecone(api_key=PINECONE_API_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

def chunk_markdown(file_path: str, chunk_size: int = 1000, overlap: int = 200) -> List[Dict]:
    """
    Chunk markdown document into smaller pieces for embedding
    Tries to split at paragraph boundaries when possible
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by double newlines (paragraphs) first
    paragraphs = content.split('\n\n')
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for para in paragraphs:
        para_length = len(para)
        
        # If adding this paragraph would exceed chunk_size, save current chunk
        if current_length + para_length > chunk_size and current_chunk:
            chunk_text = '\n\n'.join(current_chunk)
            chunks.append({
                'content': chunk_text,
                'metadata': {
                    'source': Path(file_path).name,
                    'chunk_index': len(chunks)
                }
            })
            
            # Start new chunk with overlap (last few paragraphs)
            overlap_paras = []
            overlap_length = 0
            for p in reversed(current_chunk):
                if overlap_length + len(p) <= overlap:
                    overlap_paras.insert(0, p)
                    overlap_length += len(p)
                else:
                    break
            
            current_chunk = overlap_paras + [para]
            current_length = overlap_length + para_length
        else:
            current_chunk.append(para)
            current_length += para_length
    
    # Add final chunk
    if current_chunk:
        chunk_text = '\n\n'.join(current_chunk)
        chunks.append({
            'content': chunk_text,
            'metadata': {
                'source': Path(file_path).name,
                'chunk_index': len(chunks)
            }
        })
    
    return chunks

def create_embeddings(text: str) -> List[float]:
    """Create embeddings using OpenAI"""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 embed_pdf_document.py <input.md> [document_type] [document_name]")
        print("Example: python3 embed_pdf_document.py document.md pdf_document PDF-DOC")
        sys.exit(1)
    
    md_path = sys.argv[1]
    document_type = sys.argv[2] if len(sys.argv) > 2 else "pdf_document"
    document_name = sys.argv[3] if len(sys.argv) > 3 else Path(md_path).stem
    
    if not os.path.exists(md_path):
        print(f"❌ Markdown file not found: {md_path}")
        sys.exit(1)
    
    print(f"📖 Processing markdown document: {md_path}")
    print(f"📋 Document type: {document_type}")
    print(f"📝 Document name: {document_name}")
    
    # Chunk the document
    print(f"\n🔪 Chunking document...")
    chunks = chunk_markdown(md_path, chunk_size=1000, overlap=200)
    print(f"✅ Created {len(chunks)} chunks")
    
    # Create or connect to Pinecone index
    existing_indexes = [idx.name for idx in pc.list_indexes()]
    
    if PINECONE_INDEX_NAME in existing_indexes:
        print(f"✅ Index exists: {PINECONE_INDEX_NAME}")
        index = pc.Index(PINECONE_INDEX_NAME)
    else:
        print(f"📦 Creating new index: {PINECONE_INDEX_NAME}")
        try:
            from pinecone import ServerlessSpec
            pc.create_index(
                name=PINECONE_INDEX_NAME,
                dimension=1536,  # text-embedding-3-small dimension
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region="us-east-1"
                )
            )
            # Wait a moment for index to be ready
            import time
            time.sleep(2)
            index = pc.Index(PINECONE_INDEX_NAME)
            print(f"✅ Created index: {PINECONE_INDEX_NAME}")
        except Exception as e:
            print(f"⚠️  Error creating index: {e}")
            print("   Trying to connect to existing index...")
            index = pc.Index(PINECONE_INDEX_NAME)
    
    # Embed and upload chunks
    print(f"\n📤 Embedding and uploading {len(chunks)} chunks to Pinecone...")
    
    vectors_to_upsert = []
    for i, chunk in enumerate(chunks):
        content = chunk['content']
        metadata = chunk['metadata']
        
        # Create embedding
        embedding = create_embeddings(content)
        
        # Create vector ID
        vector_id = f"{document_type}_{document_name}_{i}"
        
        # Clean and limit content size for Pinecone metadata
        try:
            content_bytes = content.encode('utf-8')
            # Limit to 30KB to be safe (Pinecone metadata limit is ~40KB total per vector)
            if len(content_bytes) > 30000:
                # Truncate intelligently
                content_truncated = content[:30000].encode('utf-8', errors='ignore').decode('utf-8')
                # Try to end at a sentence or newline
                last_period = content_truncated.rfind('.')
                last_newline = content_truncated.rfind('\n')
                cutoff = max(last_period, last_newline)
                if cutoff > 25000:
                    content_clean = content_truncated[:cutoff + 1]
                else:
                    content_clean = content_truncated
            else:
                content_clean = content.encode('utf-8', errors='ignore').decode('utf-8')
        except Exception as e:
            print(f"⚠️  Warning: Error processing content for chunk {i}: {e}")
            content_clean = content[:1000]  # Fallback to first 1000 chars
        
        vector_metadata = {
            'document_type': document_type,
            'document_name': document_name,
            'source': str(metadata.get('source', '')),
            'chunk_index': str(metadata.get('chunk_index', i)),
            'content': content_clean
        }
        
        vectors_to_upsert.append({
            'id': vector_id,
            'values': embedding,
            'metadata': vector_metadata
        })
        
        if (i + 1) % 10 == 0:
            print(f"  Processed {i + 1}/{len(chunks)} chunks...")
    
    # Batch upsert
    print(f"\n📤 Uploading to Pinecone...")
    try:
        index.upsert(vectors=vectors_to_upsert)
        print(f"✅ Successfully uploaded {len(vectors_to_upsert)} vectors to Pinecone!")
        print(f"📊 Index: {PINECONE_INDEX_NAME}")
        print(f"🔍 Document type: {document_type}")
        print(f"📝 Document name: {document_name}")
        print(f"🎉 You can now query the index for this document")
    except Exception as e:
        print(f"❌ Error uploading to Pinecone: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

