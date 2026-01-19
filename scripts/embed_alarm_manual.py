#!/usr/bin/env python3
"""
Script to process ALARM_RESPONSE_MANUAL.md and embed it into Pinecone
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

def parse_markdown_manual(file_path: str) -> List[Dict]:
    """Parse the markdown manual and extract alarm sections"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    chunks = []
    current_section = None
    current_content = []
    current_metadata = {}
    current_machine_type = None  # Track machine type across sections
    
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        # Detect machine type from section headers FIRST (before alarm sections)
        if line.startswith('## Bottle Filler Machine Alarms'):
            current_machine_type = 'bottlefiller'
            continue
        elif line.startswith('## CNC Lathe Machine Alarms'):
            current_machine_type = 'lathe'
            continue
        
        # Detect alarm section headers
        if line.startswith('### Alarm:'):
            # Save previous section if exists and has valid machine_type
            if current_section and current_content and current_metadata.get('machine_type'):
                chunks.append({
                    'content': '\n'.join(current_content),
                    'metadata': current_metadata.copy()
                })
            
            # Start new section
            alarm_name = line.replace('### Alarm:', '').strip()
            current_section = alarm_name
            current_content = [line]
            current_metadata = {
                'alarm_name': alarm_name,
                'machine_type': current_machine_type,  # Use tracked machine type
                'alarm_type': '',
                'severity': ''
            }
        
        # Extract alarm metadata
        elif line.startswith('**Alarm Type:**'):
            current_metadata['alarm_type'] = line.replace('**Alarm Type:**', '').strip()
        elif line.startswith('**Severity:**'):
            current_metadata['severity'] = line.replace('**Severity:**', '').strip()
        elif line.startswith('**Alarm Field:**'):
            alarm_field = line.replace('**Alarm Field:**', '').strip().replace('`', '')
            # Extract alarm name from field if not already set
            if not current_metadata.get('alarm_name'):
                current_metadata['alarm_name'] = alarm_field.replace('Alarm', '').strip()
        
        # Collect content
        if current_section:
            current_content.append(line)
    
    # Add last section if it has valid machine_type
    if current_section and current_content and current_metadata.get('machine_type'):
        chunks.append({
            'content': '\n'.join(current_content),
            'metadata': current_metadata.copy()
        })
    
    return chunks

def create_embeddings(text: str) -> List[float]:
    """Create embeddings using OpenAI"""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

def normalize_alarm_name(alarm_name: str) -> str:
    """Normalize alarm name to match alarm_type format"""
    # Remove "Alarm" prefix if present
    name = alarm_name.replace('Alarm', '').strip()
    # Convert to match alarm_type format (e.g., "LowProductLevel" -> "AlarmLowProductLevel")
    if not name.startswith('Alarm'):
        name = f"Alarm{name}"
    return name

def main():
    # Get manual file path
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    manual_path = project_root / "ALARM_RESPONSE_MANUAL.md"
    
    if not manual_path.exists():
        print(f"❌ Manual file not found: {manual_path}")
        return
    
    print(f"📖 Processing manual: {manual_path}")
    
    # Parse manual
    chunks = parse_markdown_manual(str(manual_path))
    print(f"✅ Parsed {len(chunks)} alarm sections")
    
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
    print(f"\n📤 Uploading {len(chunks)} chunks to Pinecone...")
    
    vectors_to_upsert = []
    for i, chunk in enumerate(chunks):
        content = chunk['content']
        metadata = chunk['metadata']
        
        # Create embedding
        embedding = create_embeddings(content)
        
        # Normalize alarm name
        alarm_name = normalize_alarm_name(metadata.get('alarm_name', ''))
        
        # Create vector ID
        vector_id = f"{metadata.get('machine_type', 'unknown')}_{alarm_name}_{i}"
        
        # Prepare metadata - default to 'bottlefiller' if machine_type is null/empty
        machine_type = metadata.get('machine_type')
        if not machine_type or machine_type == 'None' or machine_type is None:
            machine_type = 'bottlefiller'
        
        vector_metadata = {
            'alarm_name': str(alarm_name) if alarm_name else '',
            'machine_type': str(machine_type),
            'alarm_type': str(metadata.get('alarm_type', '')),
            'severity': str(metadata.get('severity', '')),
            'document_type': 'alarm_response_manual',
            'content': str(content[:1000])  # Store first 1000 chars for reference
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
    index.upsert(vectors=vectors_to_upsert)
    
    print(f"✅ Successfully uploaded {len(vectors_to_upsert)} vectors to Pinecone!")
    print(f"📊 Index: {PINECONE_INDEX_NAME}")
    print(f"🔍 You can now query the index for alarm responses")

if __name__ == "__main__":
    main()

