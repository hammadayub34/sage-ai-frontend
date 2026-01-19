#!/usr/bin/env python3
"""
Mock Modbus TCP Server - Simulates PLC with bottle filler data
"""
from pymodbus.server import StartTcpServer
from pymodbus.device import ModbusDeviceIdentification
from pymodbus.datastore import ModbusSequentialDataBlock, ModbusSlaveContext, ModbusServerContext
import random
import time
import threading
import signal
import sys

# Global variables
running = True
server = None

# Create data blocks for holding registers
# Register 0: BottleCount (INT)
# Register 1: FillerSpeed (REAL * 100, so 75.5 = 7550)
# Register 2: FillerSpeed low word (for 32-bit, not used in simple version)
# Register 3: LineRunning (BOOL: 0 or 1)

def update_registers(store):
    """Update register values to simulate changing PLC data"""
    global running
    bottle_count = 0
    line_running = 1
    
    # Wait a bit for server to initialize
    time.sleep(2)
    
    while running:
        # Simulate bottle filling
        if random.random() > 0.7:  # 30% chance of incrementing
            bottle_count += 1
        
        # Simulate filler speed (50-100, stored as integer * 100)
        filler_speed = random.randint(5000, 10000)  # 50.00 to 100.00
        
        # Line running (randomly toggle)
        if random.random() > 0.9:  # 10% chance of toggling
            line_running = 1 - line_running
        
        try:
            # Update holding registers directly on the store
            store.setValues(3, 0, [bottle_count])  # Holding register 0
            store.setValues(3, 1, [filler_speed])  # Holding register 1
            store.setValues(3, 2, [0])  # Holding register 2 (unused)
            store.setValues(3, 3, [line_running])  # Holding register 3
            
            print(f"📊 Updated: Bottles={bottle_count}, Speed={filler_speed/100:.2f}, Running={line_running}")
        except Exception as e:
            print(f"⚠️  Error updating registers: {e}")
        
        time.sleep(1)

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    global running, server
    print("\n🛑 Stopping Modbus server...")
    running = False
    if server:
        server.server_close()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

# Create data store
store = ModbusSlaveContext(
    di=ModbusSequentialDataBlock(0, [0]*100),  # Discrete Inputs
    co=ModbusSequentialDataBlock(0, [0]*100),  # Coils
    hr=ModbusSequentialDataBlock(0, [0]*100),  # Holding Registers
    ir=ModbusSequentialDataBlock(0, [0]*100)   # Input Registers
)

# Create server context (single=False means multiple unit IDs supported)
server_context = ModbusServerContext(slaves={1: store}, single=False)

# Device identification
identity = ModbusDeviceIdentification()
identity.VendorName = 'Mock PLC'
identity.ProductCode = 'BottleFiller'
identity.VendorUrl = 'http://github.com'
identity.ProductName = 'Mock Bottle Filler PLC'
identity.ModelName = 'Simulator'
identity.MajorMinorRevision = '1.0.0'

print("🚀 Starting Mock Modbus TCP Server...")
print("📡 Listening on 0.0.0.0:1502")
print("📊 Simulating bottle filler PLC data")
print("   Register 0: BottleCount")
print("   Register 1: FillerSpeed (×100)")
print("   Register 3: LineRunning (0/1)")
print("\nPress Ctrl+C to stop\n")

# Start background thread to update registers
update_thread = threading.Thread(target=update_registers, args=(store,), daemon=True)
update_thread.start()

# Start Modbus TCP server using StartTcpServer
# Note: StartTcpServer blocks, so we need to run it in the main thread
try:
    print("✅ Starting server...")
    StartTcpServer(
        context=server_context,
        identity=identity,
        address=("0.0.0.0", 1502)
    )
except KeyboardInterrupt:
    running = False
    print("\n✅ Server stopped")
except Exception as e:
    print(f"\n❌ Server error: {e}")
    import traceback
    traceback.print_exc()
    running = False
