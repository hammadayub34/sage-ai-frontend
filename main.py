#!/usr/bin/env python3
"""
Replit startup script - runs all services
"""
import subprocess
import os
import time
import signal
import sys

# Load .env file if it exists (fallback for Replit secrets)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed, skip

processes = []

def start_service(name, command, cwd=None):
    """Start a service as a subprocess"""
    print(f"🚀 Starting {name}...")
    env = os.environ.copy()
    
    process = subprocess.Popen(
        command,
        shell=True,
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    processes.append((name, process))
    print(f"✅ {name} started (PID: {process.pid})")
    return process

def cleanup():
    """Stop all processes"""
    print("\n🛑 Stopping all services...")
    for name, process in processes:
        try:
            process.terminate()
            process.wait(timeout=5)
            print(f"✅ {name} stopped")
        except:
            process.kill()
            print(f"⚠️ {name} force-killed")

# Register cleanup handler
signal.signal(signal.SIGINT, lambda s, f: (cleanup(), sys.exit(0)))
signal.signal(signal.SIGTERM, lambda s, f: (cleanup(), sys.exit(0)))

print("=" * 60)
print("🚀 MQTT OT Network - Starting on Replit")
print("=" * 60)

# Check if dependencies are installed
if not os.path.exists("frontend/node_modules"):
    print("⚠️ Frontend dependencies not installed.")
    print("   Run: cd frontend && npm install")
    print("   Then restart this script.\n")

# Start InfluxDB Writer
print("\n📝 Starting InfluxDB Writer...")
start_service(
    "InfluxDB Writer",
    "python3 influxdb_writer/influxdb_writer_production.py"
)

# Wait a moment for writer to initialize
time.sleep(2)

# Start Mock PLC Agent
print("\n🤖 Starting Mock PLC Agent...")
start_service(
    "Mock PLC Agent",
    "python3 mock_plc_agent/mock_plc_agent.py"
)

# Start Frontend (if node_modules exists)
if os.path.exists("frontend/node_modules"):
    print("\n🌐 Starting Frontend...")
    start_service(
        "Frontend",
        "npm run dev",
        cwd="frontend"
    )
else:
    print("\n⚠️ Frontend not starting - dependencies missing")
    print("   Install with: cd frontend && npm install")

print("\n" + "=" * 60)
print("✅ All services started!")
print("=" * 60)
print("\n📊 Services Status:")
for name, process in processes:
    status = "🟢 Running" if process.poll() is None else "🔴 Stopped"
    print(f"   {status} - {name}")

print("\n💡 Check Replit webview for frontend")
print("📝 Check console output for service logs")
print("🛑 Press Ctrl+C to stop\n")

# Keep script running and monitor processes
try:
    while True:
        time.sleep(5)
        # Check if any process died
        for name, process in processes:
            if process.poll() is not None:
                exit_code = process.returncode
                print(f"\n⚠️ {name} stopped unexpectedly (exit code: {exit_code})")
                # Try to restart
                print(f"🔄 Attempting to restart {name}...")
                if name == "InfluxDB Writer":
                    start_service(name, "python3 influxdb_writer/influxdb_writer_production.py")
                elif name == "Mock PLC Agent":
                    start_service(name, "python3 mock_plc_agent/mock_plc_agent.py")
                elif name == "Frontend":
                    if os.path.exists("frontend/node_modules"):
                        start_service(name, "npm run dev", cwd="frontend")
except KeyboardInterrupt:
    print("\n")
    pass
finally:
    cleanup()

