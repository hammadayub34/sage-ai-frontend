#!/usr/bin/env python3
"""
Script to embed WORK_ORDERS_HISTORY.md into Pinecone
"""
import os
import re
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

def create_embeddings(text: str) -> List[float]:
    """Create embeddings using OpenAI"""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

def parse_work_orders_markdown(file_path: str) -> List[Dict]:
    """Parse the work orders history markdown and extract work order sections"""
    if not os.path.exists(file_path):
        print(f"⚠️  File not found: {file_path}")
        return []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    chunks = []
    
    # Split by work order sections (## Work Order:)
    work_order_pattern = r'^## Work Order: (.+)$'
    sections = re.split(work_order_pattern, content, flags=re.MULTILINE)
    
    # Skip the header (first section before first work order)
    if len(sections) > 1:
        # Process each work order section
        for i in range(1, len(sections), 2):
            if i + 1 < len(sections):
                work_order_no = sections[i].strip()
                work_order_content = sections[i + 1].strip()
                
                # Extract metadata from the content
                metadata = {
                    'work_order_no': work_order_no,
                    'document_type': 'work_order_history',
                }
                
                # Extract key fields using regex
                created_match = re.search(r'\*\*Created:\*\* (.+)', work_order_content)
                if created_match:
                    metadata['created_at'] = created_match.group(1).strip()
                
                status_match = re.search(r'\*\*Status:\*\* (.+)', work_order_content)
                if status_match:
                    metadata['status'] = status_match.group(1).strip()
                
                priority_match = re.search(r'\*\*Priority:\*\* (.+)', work_order_content)
                if priority_match:
                    metadata['priority'] = priority_match.group(1).strip()
                
                machine_id_match = re.search(r'\*\*Machine ID:\*\* (.+)', work_order_content)
                if machine_id_match:
                    metadata['machine_id'] = machine_id_match.group(1).strip()
                
                machine_type_match = re.search(r'\*\*Machine Type:\*\* (.+)', work_order_content)
                if machine_type_match:
                    metadata['machine_type'] = machine_type_match.group(1).strip()
                
                alarm_type_match = re.search(r'\*\*Alarm Type:\*\* (.+)', work_order_content)
                if alarm_type_match:
                    metadata['alarm_type'] = alarm_type_match.group(1).strip()
                
                # Store full content (limit to 30KB for Pinecone metadata)
                content_clean = work_order_content.encode('utf-8', errors='ignore').decode('utf-8')
                if len(content_clean.encode('utf-8')) > 30000:
                    content_clean = content_clean[:30000].encode('utf-8', errors='ignore').decode('utf-8')
                
                chunks.append({
                    'content': content_clean,
                    'metadata': metadata
                })
    
    return chunks

def main():
    # Get work orders history file path
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    work_orders_file = project_root / "WORK_ORDERS_HISTORY.md"
    
    if not work_orders_file.exists():
        print(f"⚠️  Work orders history file not found: {work_orders_file}")
        print("   Creating empty file...")
        work_orders_file.write_text("""# Work Orders History
## MQTT-OT Network Production System

**Document Type:** Work Order Archive  
**Last Updated:** 2025-01-01 00:00:00

This document contains a chronological record of all generated work orders.

---
""", encoding='utf-8')
        print("✅ Created empty work orders history file")
        return
    
    print(f"📖 Processing work orders history: {work_orders_file}")
    
    # Parse the markdown file
    chunks = parse_work_orders_markdown(str(work_orders_file))
    
    if not chunks:
        print("⚠️  No work orders found in the history file")
        return
    
    print(f"✅ Parsed {len(chunks)} work order sections")
    
    # Get or create Pinecone index
    try:
        index = pc.Index(PINECONE_INDEX_NAME)
        print(f"✅ Index exists: {PINECONE_INDEX_NAME}")
    except Exception as e:
        print(f"❌ Error accessing index: {e}")
        return
    
    # Create embeddings and prepare vectors
    print(f"\n📤 Uploading {len(chunks)} chunks to Pinecone...")
    vectors_to_upsert = []
    
    for i, chunk in enumerate(chunks):
        content = chunk['content']
        metadata = chunk['metadata']
        
        # Create embedding
        embedding = create_embeddings(content)
        
        # Create vector ID
        work_order_no = metadata.get('work_order_no', f'unknown_{i}')
        vector_id = f"workorder_history_{work_order_no}_{i}"
        
        # Prepare metadata
        vector_metadata = {
            'work_order_no': str(metadata.get('work_order_no', '')),
            'document_type': 'work_order_history',
            'status': str(metadata.get('status', '')),
            'priority': str(metadata.get('priority', '')),
            'machine_id': str(metadata.get('machine_id', '')),
            'machine_type': str(metadata.get('machine_type', '')),
            'alarm_type': str(metadata.get('alarm_type', '')),
            'created_at': str(metadata.get('created_at', '')),
            'content': content[:1000]  # Store first 1000 chars for reference
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
        print(f"🔍 You can now query the index for work order history")
    except Exception as e:
        print(f"❌ Error uploading to Pinecone: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

