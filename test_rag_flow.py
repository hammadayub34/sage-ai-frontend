#!/usr/bin/env python3
"""
Test script to measure RAG API response time and trace the flow
"""
import time
import requests
import json
from datetime import datetime

API_URL = "http://localhost:3005/api/alarms/rag"

def test_rag_flow():
    """Test the complete RAG flow and measure timings"""
    print("=" * 60)
    print("🧪 Testing RAG Instructions Flow")
    print("=" * 60)
    print()
    
    # Test case 1: Bottle Filler alarm
    test_cases = [
        {
            "name": "Bottle Filler - LowProductLevel (RAISED)",
            "body": {
                "alarm_type": "AlarmLowProductLevel",
                "machine_type": "bottlefiller",
                "state": "RAISED",
                "machine_id": "machine-01"
            }
        },
        {
            "name": "Lathe - CoolantLow (RAISED)",
            "body": {
                "alarm_type": "AlarmCoolantLow",
                "machine_type": "lathe",
                "state": "RAISED",
                "machine_id": "lathe01"
            }
        }
    ]
    
    for test_case in test_cases:
        print(f"\n📋 Test: {test_case['name']}")
        print("-" * 60)
        
        # Measure total time
        start_time = time.time()
        
        try:
            # Step 1: Make API request
            print("1️⃣  Making POST request to /api/alarms/rag...")
            request_start = time.time()
            
            response = requests.post(
                API_URL,
                json=test_case['body'],
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            request_time = time.time() - request_start
            print(f"   ⏱️  Request completed in {request_time:.2f}s")
            
            if response.status_code != 200:
                print(f"   ❌ Error: {response.status_code}")
                print(f"   Response: {response.text}")
                continue
            
            # Parse response
            result = response.json()
            total_time = time.time() - start_time
            
            # Display results
            print(f"\n2️⃣  Response received:")
            print(f"   ⏱️  Total time: {total_time:.2f}s")
            print(f"   📊 Chunks found: {len(result.get('chunks', []))}")
            
            if result.get('chunks'):
                print(f"   📈 Top chunk score: {result['chunks'][0].get('score', 'N/A')}")
            
            instructions = result.get('instructions', '')
            instruction_length = len(instructions)
            print(f"   📝 Instructions length: {instruction_length} characters")
            
            # Show first 200 chars of instructions
            if instructions:
                print(f"\n3️⃣  Instructions preview (first 200 chars):")
                print(f"   {instructions[:200]}...")
            
            # Breakdown timing from API response
            print(f"\n⏱️  Detailed Timing Breakdown:")
            if result.get('timings'):
                timings = result['timings']
                print(f"   📊 Server-side breakdown:")
                print(f"      - Embedding creation: {timings.get('embedding', 0)}ms")
                print(f"      - Pinecone query: {timings.get('pinecone', 0)}ms")
                print(f"      - LLM generation: {timings.get('llm', 0)}ms ({timings.get('llm', 0)/1000:.2f}s)")
                print(f"      - Server total: {timings.get('total', 0)}ms ({timings.get('total', 0)/1000:.2f}s)")
                print(f"   🌐 Client-side:")
                print(f"      - Network + overhead: {((request_time * 1000) - timings.get('total', 0)):.0f}ms")
                print(f"      - Total end-to-end: {request_time:.2f}s")
                
                # Identify bottleneck
                llm_time = timings.get('llm', 0) / 1000
                if llm_time > 8:
                    print(f"\n   🔴 BOTTLENECK: LLM generation ({llm_time:.2f}s) is the slowest step")
                elif timings.get('pinecone', 0) > 2000:
                    print(f"\n   🟡 BOTTLENECK: Pinecone query ({timings.get('pinecone', 0)}ms) is slow")
                elif timings.get('embedding', 0) > 1000:
                    print(f"\n   🟡 BOTTLENECK: Embedding creation ({timings.get('embedding', 0)}ms) is slow")
            else:
                print(f"   - Network + API processing: {request_time:.2f}s")
                print(f"   - Total end-to-end: {total_time:.2f}s")
            
            if total_time > 5:
                print(f"\n⚠️  WARNING: Response time is slow (>5s)")
                print(f"   Possible causes:")
                print(f"   - OpenAI API latency (most likely)")
                print(f"   - Pinecone query latency")
                print(f"   - Network issues")
            
        except requests.exceptions.Timeout:
            print(f"   ❌ Request timed out after 30s")
        except requests.exceptions.ConnectionError:
            print(f"   ❌ Could not connect to API")
            print(f"   Make sure frontend is running on port 3005")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        print()

if __name__ == "__main__":
    test_rag_flow()

