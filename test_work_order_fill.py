#!/usr/bin/env python3
"""
Test script to measure work order fill API performance
"""
import requests
import json
import time
import sys

# Configuration - try different ports
PORTS = [3000, 3005]  # Common Next.js ports

def test_work_order_fill(machine_id="machine-01", alarm_type="AlarmLowProductLevel", machine_type="bottlefiller", port=None):
    """Test the work order fill API and measure performance"""
    
    print(f"🧪 Testing Work Order Fill API")
    print(f"   Machine ID: {machine_id}")
    print(f"   Alarm Type: {alarm_type}")
    print(f"   Machine Type: {machine_type}")
    print()
    
    payload = {
        "machineId": machine_id,
        "alarmType": alarm_type,
        "machineType": machine_type
    }
    
    # Try different ports if not specified
    ports_to_try = [port] if port else PORTS
    
    for port_num in ports_to_try:
        api_url = f"http://localhost:{port_num}/api/work-order/pinecone-fill"
        print(f"📡 Trying port {port_num}...")
        
        # Measure total time
        start_time = time.time()
        
        try:
            response = requests.post(
                api_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=60  # 60 second timeout
            )
        
            total_time = (time.time() - start_time) * 1000  # Convert to ms
            
            print(f"✅ Response received in {total_time:.2f}ms")
            print()
            
            if response.status_code == 200:
                data = response.json()
                
                # Show timings if available
                if "timings" in data:
                    timings = data["timings"]
                    print("⏱️  Performance Breakdown:")
                    print(f"   Total Time:     {timings.get('total', 0):.2f}ms")
                    print(f"   Embedding:      {timings.get('embedding', 0):.2f}ms ({timings.get('embedding', 0) / timings.get('total', 1) * 100:.1f}%)")
                    print(f"   Pinecone Query: {timings.get('pinecone', 0):.2f}ms ({timings.get('pinecone', 0) / timings.get('total', 1) * 100:.1f}%)")
                    print(f"   LLM Completion: {timings.get('llm', 0):.2f}ms ({timings.get('llm', 0) / timings.get('total', 1) * 100:.1f}%)")
                    print()
                    
                    # Identify bottleneck
                    max_time = max(
                        timings.get('embedding', 0),
                        timings.get('pinecone', 0),
                        timings.get('llm', 0)
                    )
                    
                    if timings.get('llm', 0) == max_time:
                        print("🐌 Bottleneck: LLM Completion (this is normal - LLM calls are typically the slowest)")
                    elif timings.get('pinecone', 0) == max_time:
                        print("🐌 Bottleneck: Pinecone Query")
                    elif timings.get('embedding', 0) == max_time:
                        print("🐌 Bottleneck: Embedding Creation")
                    print()
                
                # Show success status
                if data.get("success"):
                    print("✅ Success: Work order data extracted")
                    work_order = data.get("workOrder", {})
                    
                    # Show what was extracted
                    print("\n📋 Extracted Data:")
                    if work_order.get("workDescription"):
                        desc_preview = work_order["workDescription"][:100] + "..." if len(work_order["workDescription"]) > 100 else work_order["workDescription"]
                        print(f"   Work Description: {desc_preview}")
                    
                    if work_order.get("specialInstructions"):
                        inst_preview = work_order["specialInstructions"][:100] + "..." if len(work_order["specialInstructions"]) > 100 else work_order["specialInstructions"]
                        print(f"   Special Instructions: {inst_preview}")
                    
                    if work_order.get("parts"):
                        print(f"   Parts: {len(work_order['parts'])} items")
                    
                    if work_order.get("materials"):
                        print(f"   Materials: {len(work_order['materials'])} items")
                    
                    return  # Success, exit
                else:
                    print(f"❌ Error: {data.get('error', 'Unknown error')}")
                    
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data.get('error', 'Unknown error')}")
                except:
                    print(f"   Response: {response.text[:200]}")
                    
        except requests.exceptions.Timeout:
            print(f"⏱️  Request timed out after 60 seconds on port {port_num}")
            print("   This suggests the API is taking too long to respond")
            continue
        except requests.exceptions.ConnectionError:
            print(f"❌ Connection Error: Could not connect to port {port_num}")
            continue
        except Exception as e:
            print(f"❌ Error on port {port_num}: {e}")
            continue
    
    print()
    print("❌ Could not connect to API on any port")
    print("   Make sure the frontend server is running:")
    print("   cd frontend && npm run dev")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Custom test case
        machine_id = sys.argv[1] if len(sys.argv) > 1 else "machine-01"
        alarm_type = sys.argv[2] if len(sys.argv) > 2 else "AlarmLowProductLevel"
        machine_type = sys.argv[3] if len(sys.argv) > 3 else "bottlefiller"
        port = int(sys.argv[4]) if len(sys.argv) > 4 else None
        test_work_order_fill(machine_id, alarm_type, machine_type, port)
    else:
        # Run first test case
        print("Running test with default values...")
        print("Usage: python3 test_work_order_fill.py [machine_id] [alarm_type] [machine_type] [port]")
        print()
        test_work_order_fill()
