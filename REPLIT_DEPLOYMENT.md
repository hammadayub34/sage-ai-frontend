# Replit Deployment Guide

## Can We Deploy on Replit? ✅ YES!

Replit can host this project, but with some considerations. Here are the options:

---

## Option 1: Single Repl with Multiple Processes (Recommended)

Run all services in one Repl using a process manager.

### Architecture:

```
Single Replit Repl
├── MQTT Broker (Mosquitto) - Process 1
├── InfluxDB - Process 2
├── InfluxDB Writer - Process 3 (Python)
├── Mock PLC Agent - Process 4 (Python)
└── Frontend - Process 5 (Next.js)
```

### Setup Steps:

#### 1. Create New Repl

1. Go to https://replit.com
2. Click "Create Repl"
3. Choose "Python" template
4. Name it: `mqtt-ot-network`

#### 2. Upload Project Files

Upload all your project files to the Repl:
- `mock_plc_agent/`
- `influxdb_writer/`
- `frontend/`
- `mosquitto/config/`
- `requirements.txt`
- etc.

#### 3. Create Startup Script (`main.py`)

```python
#!/usr/bin/env python3
"""
Replit startup script - runs all services
"""
import subprocess
import time
import os
import signal
import sys

processes = []

def start_service(name, command, env=None):
    """Start a service as a subprocess"""
    print(f"🚀 Starting {name}...")
    env_vars = os.environ.copy()
    if env:
        env_vars.update(env)
    
    process = subprocess.Popen(
        command,
        shell=True,
        env=env_vars,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
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

# Set environment variables
os.environ.setdefault("MQTT_BROKER_HOST", "localhost")
os.environ.setdefault("MQTT_BROKER_PORT", "1883")  # Use 1883 for Replit (no TLS needed internally)
os.environ.setdefault("INFLUXDB_URL", "http://localhost:8086")
os.environ.setdefault("INFLUXDB_TOKEN", "my-super-secret-auth-token")
os.environ.setdefault("INFLUXDB_ORG", "myorg")
os.environ.setdefault("INFLUXDB_BUCKET", "plc_data_new")
os.environ.setdefault("MACHINE_ID", "machine-01")

print("=" * 60)
print("🚀 Starting MQTT OT Network on Replit")
print("=" * 60)

# Start MQTT Broker (if Mosquitto is installed)
# Note: You may need to use a different MQTT broker or external service
# For Replit, consider using a cloud MQTT service like HiveMQ Cloud

# Start InfluxDB (if available)
# Note: InfluxDB might be too heavy for Replit free tier
# Consider using InfluxDB Cloud or Replit Database

# Start InfluxDB Writer
start_service(
    "InfluxDB Writer",
    "python3 influxdb_writer/influxdb_writer_production.py",
    {
        "MQTT_BROKER_HOST": "localhost",
        "MQTT_BROKER_PORT": "1883",
        "MQTT_TLS_ENABLED": "false",  # Disable TLS for Replit
    }
)

# Start Mock PLC Agent
start_service(
    "Mock PLC Agent",
    "python3 mock_plc_agent/mock_plc_agent.py",
    {
        "MQTT_BROKER_HOST": "localhost",
        "MQTT_BROKER_PORT": "1883",
        "MQTT_TLS_ENABLED": "false",
        "MACHINE_ID": "machine-01",
        "PUBLISH_INTERVAL": "2.0",
    }
)

# Start Frontend (Next.js)
start_service(
    "Frontend",
    "cd frontend && npm run dev",
    {
        "PORT": "3005",
        "NEXT_PUBLIC_INFLUXDB_URL": "http://localhost:8086",
    }
)

print("\n" + "=" * 60)
print("✅ All services started!")
print("=" * 60)
print("\n📊 Services running:")
for name, process in processes:
    status = "🟢 Running" if process.poll() is None else "🔴 Stopped"
    print(f"   {status} - {name}")

print("\n💡 Access your app at the Replit URL")
print("🛑 Press Ctrl+C to stop all services\n")

# Keep script running
try:
    while True:
        time.sleep(1)
        # Check if any process died
        for name, process in processes:
            if process.poll() is not None:
                print(f"⚠️ {name} stopped unexpectedly (exit code: {process.returncode})")
except KeyboardInterrupt:
    pass
finally:
    cleanup()
```

#### 4. Create `.replit` Configuration

Create `.replit` file:

```toml
language = "python3"

[deploy]
run = ["python3", "main.py"]

[env]
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=my-super-secret-auth-token
INFLUXDB_ORG=myorg
INFLUXDB_BUCKET=plc_data_new
MACHINE_ID=machine-01
```

#### 5. Install Dependencies

Create `replit.nix` for system packages:

```nix
{ pkgs }: {
  deps = [
    pkgs.mosquitto
    pkgs.influxdb2
    pkgs.nodejs-18_x
    pkgs.python311
    pkgs.python311Packages.pip
  ];
}
```

Or use `packages.txt`:
```
mosquitto
nodejs
python3
```

---

## Option 2: Use External Services (Easier)

Instead of running everything in Replit, use cloud services:

### Architecture:

```
Replit Repl
├── InfluxDB Writer (Python) - connects to external MQTT
├── Mock PLC Agent (Python) - connects to external MQTT
└── Frontend (Next.js) - connects to external InfluxDB

External Services:
├── MQTT: HiveMQ Cloud (free tier) or CloudMQTT
├── InfluxDB: InfluxDB Cloud (free tier)
└── Grafana: Grafana Cloud (optional)
```

### Benefits:
- ✅ Lighter on Replit resources
- ✅ More reliable (managed services)
- ✅ Free tiers available
- ✅ Easier to set up

### Setup:

#### 1. Get Free MQTT Broker

**Option A: HiveMQ Cloud** (Recommended)
1. Sign up: https://www.hivemq.com/mqtt-cloud-broker/
2. Create free cluster
3. Get connection details:
   - Host: `your-cluster.hivemq.cloud`
   - Port: `8883` (TLS) or `1883` (non-TLS)
   - Username/Password: From dashboard

**Option B: CloudMQTT**
1. Sign up: https://www.cloudmqtt.com/
2. Create instance (free tier: 10 connections)
3. Get connection details

#### 2. Get Free InfluxDB

1. Sign up: https://www.influxdata.com/products/influxdb-cloud/
2. Create free account
3. Create bucket: `plc_data_new`
4. Get token and org details

#### 3. Update Environment Variables in Replit

In Replit Secrets (🔒 icon):

```
MQTT_BROKER_HOST=your-hivemq-cluster.hivemq.cloud
MQTT_BROKER_PORT=8883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password
MQTT_TLS_ENABLED=true

INFLUXDB_URL=https://us-east-1-1.aws.cloud2.influxdata.com
INFLUXDB_TOKEN=your-token
INFLUXDB_ORG=your-org
INFLUXDB_BUCKET=plc_data_new
```

#### 4. Create Simple Startup Script

```python
# main.py
import subprocess
import os

# Start InfluxDB Writer
subprocess.Popen([
    "python3", "influxdb_writer/influxdb_writer_production.py"
], env=os.environ)

# Start Mock PLC Agent
subprocess.Popen([
    "python3", "mock_plc_agent/mock_plc_agent.py"
], env=os.environ)

# Start Frontend
subprocess.Popen([
    "npm", "run", "dev"
], cwd="frontend", env=os.environ)

print("✅ All services started!")
print("🌐 Frontend: Check Replit webview")
```

---

## Option 3: Hybrid Approach (Best for Replit)

Run lightweight services in Replit, use external for heavy ones:

```
Replit Repl:
├── Mock PLC Agent (Python) ✅
├── InfluxDB Writer (Python) ✅
└── Frontend (Next.js) ✅

External Services:
├── MQTT: HiveMQ Cloud (free) ✅
└── InfluxDB: InfluxDB Cloud (free) ✅
```

### Why This Works Best:

1. **Python services** run perfectly in Replit
2. **Next.js frontend** works in Replit
3. **MQTT broker** - use cloud service (easier than installing Mosquitto)
4. **InfluxDB** - use cloud service (too heavy for Replit free tier)
5. **Grafana** - optional, use Grafana Cloud if needed

---

## Step-by-Step: Hybrid Deployment

### 1. Create Repl

1. Go to https://replit.com
2. Create new Repl → Python
3. Name: `mqtt-ot-network`

### 2. Upload Files

Upload these directories:
- `mock_plc_agent/`
- `influxdb_writer/`
- `frontend/`
- `requirements.txt`

### 3. Set Up External Services

#### A. HiveMQ Cloud (MQTT)

1. Sign up: https://www.hivemq.com/mqtt-cloud-broker/
2. Create cluster
3. Note connection details

#### B. InfluxDB Cloud

1. Sign up: https://www.influxdata.com/products/influxdb-cloud/
2. Create bucket: `plc_data_new`
3. Generate API token
4. Note org name

### 4. Configure Replit Secrets

Click 🔒 icon → Add secrets:

```
MQTT_BROKER_HOST=your-cluster.hivemq.cloud
MQTT_BROKER_PORT=8883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password
MQTT_TLS_ENABLED=true

INFLUXDB_URL=https://us-east-1-1.aws.cloud2.influxdata.com
INFLUXDB_TOKEN=your-token-here
INFLUXDB_ORG=your-org-name
INFLUXDB_BUCKET=plc_data_new

MACHINE_ID=machine-01
```

### 5. Create `main.py`

```python
#!/usr/bin/env python3
import subprocess
import os
import time
import signal
import sys

processes = []

def start_service(name, cmd, cwd=None):
    """Start a service"""
    print(f"🚀 Starting {name}...")
    env = os.environ.copy()
    process = subprocess.Popen(
        cmd,
        shell=True,
        cwd=cwd,
        env=env
    )
    processes.append((name, process))
    print(f"✅ {name} started (PID: {process.pid})")
    return process

def cleanup():
    """Stop all services"""
    print("\n🛑 Stopping services...")
    for name, process in processes:
        process.terminate()
    print("✅ Stopped")

signal.signal(signal.SIGINT, lambda s, f: (cleanup(), sys.exit(0)))

print("=" * 60)
print("🚀 MQTT OT Network - Starting on Replit")
print("=" * 60)

# Start InfluxDB Writer
start_service(
    "InfluxDB Writer",
    "python3 influxdb_writer/influxdb_writer_production.py"
)

# Start Mock PLC Agent
start_service(
    "Mock PLC Agent",
    "python3 mock_plc_agent/mock_plc_agent.py"
)

# Install frontend deps if needed
if not os.path.exists("frontend/node_modules"):
    print("📦 Installing frontend dependencies...")
    subprocess.run(["npm", "install"], cwd="frontend", check=True)

# Start Frontend
start_service(
    "Frontend",
    "npm run dev",
    cwd="frontend"
)

print("\n" + "=" * 60)
print("✅ All services running!")
print("🌐 Frontend: Check Replit webview")
print("🛑 Press Ctrl+C to stop")
print("=" * 60)

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    cleanup()
```

### 6. Create `.replit`

```toml
language = "python3"

[deploy]
run = ["python3", "main.py"]

[packager]
language = "python3"
ignoredPackages = ["unit_tests"]

[interpreter]
command = ["python3", "-u", "main.py"]
```

### 7. Install Python Dependencies

Create `requirements.txt` in root:

```
paho-mqtt==1.6.1
influxdb-client==1.38.0
```

Run in Replit shell:
```bash
pip install -r requirements.txt
```

### 8. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 9. Run!

Click "Run" button in Replit. All services start automatically!

---

## Replit-Specific Considerations

### ✅ What Works Well:

1. **Python services** - Perfect for Replit
2. **Next.js frontend** - Works great
3. **Background processes** - Supported
4. **Environment variables** - Use Secrets
5. **Persistent storage** - Available

### ⚠️ Limitations:

1. **Docker containers** - Not available on free tier
2. **Heavy services** (InfluxDB, Mosquitto) - Use cloud alternatives
3. **Port management** - Replit assigns ports automatically
4. **Resource limits** - Free tier has CPU/memory limits
5. **Uptime** - Free tier may sleep after inactivity

### 💡 Solutions:

1. **Use cloud MQTT** instead of self-hosted
2. **Use InfluxDB Cloud** instead of self-hosted
3. **Keep Repl active** - Use UptimeRobot or similar to ping
4. **Upgrade to paid** - For better resources and uptime

---

## Cost Comparison

### Replit Free Tier:
- ✅ Free forever
- ⚠️ Limited resources
- ⚠️ May sleep after inactivity
- ⚠️ No Docker support

### Replit Core ($7/month):
- ✅ Better resources
- ✅ Always-on option
- ✅ More storage

### External Services (Free Tiers):
- **HiveMQ Cloud**: Free tier available
- **InfluxDB Cloud**: Free tier (generous)
- **Grafana Cloud**: Free tier available

**Total Cost**: $0-7/month (depending on Replit plan)

---

## Quick Start Commands

### In Replit Shell:

```bash
# Install Python deps
pip install -r requirements.txt

# Install frontend deps
cd frontend && npm install && cd ..

# Run everything
python3 main.py
```

---

## Troubleshooting

### Services Not Starting

**Check:**
1. Dependencies installed: `pip list`
2. Environment variables set: Check Secrets
3. Ports available: Replit auto-assigns

**Fix:**
```bash
# Check what's running
ps aux

# Check logs
# Look at Replit console output
```

### Mock PLC Not Publishing

**Check:**
1. MQTT broker connection: Test with `mosquitto_pub` (if available)
2. Environment variables: `echo $MQTT_BROKER_HOST`
3. Network connectivity: Replit can access external services

**Fix:**
```bash
# Test MQTT connection
python3 -c "
import paho.mqtt.client as mqtt
client = mqtt.Client()
client.connect('your-broker', 8883)
print('Connected!')
"
```

### Frontend Not Loading

**Check:**
1. Frontend dependencies: `cd frontend && npm list`
2. Port assignment: Check Replit webview URL
3. Build errors: Check console output

**Fix:**
```bash
# Rebuild frontend
cd frontend
rm -rf .next node_modules
npm install
npm run build
```

---

## Pro Tips

1. **Use Replit Secrets** for sensitive data (passwords, tokens)
2. **Keep Repl active** - Set up a ping service to prevent sleep
3. **Monitor resources** - Check Replit dashboard for usage
4. **Use external services** - Easier than self-hosting on Replit
5. **Test locally first** - Make sure everything works before deploying

---

## Alternative: Replit + Railway Hybrid

Deploy heavy services on Railway, lightweight on Replit:

```
Railway:
├── MQTT Broker
├── InfluxDB
└── Grafana

Replit:
├── Mock PLC Agent (connects to Railway MQTT)
├── InfluxDB Writer (connects to Railway MQTT/InfluxDB)
└── Frontend (connects to Railway InfluxDB)
```

This gives you:
- ✅ Free Replit for Python/Node services
- ✅ Railway for infrastructure (or use free cloud services)
- ✅ Best of both worlds

---

## Next Steps

1. **Choose approach**: Hybrid (recommended) or all-in-Replit
2. **Set up external services**: HiveMQ Cloud + InfluxDB Cloud
3. **Create Repl**: Upload code and configure
4. **Set secrets**: Add environment variables
5. **Run**: Click Run button!

---

## Support

- Replit Docs: https://docs.replit.com
- Replit Community: https://replit.com/talk
- Check console output for errors

Good luck! 🚀

