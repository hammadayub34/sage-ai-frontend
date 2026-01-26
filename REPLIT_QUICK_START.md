# Replit Deployment - Free Alternative to Railway

## 💰 Cost Comparison

**Railway**: $5/service = ~$30/month for 6 services  
**Replit**: **FREE** (with some limitations)

---

## ✅ What Works on Replit

### Services That Work Great:
- ✅ **Mock PLC Agent** (Python) - Perfect!
- ✅ **InfluxDB Writer** (Python) - Perfect!
- ✅ **Frontend** (Next.js) - Works great!

### Services That Need Alternatives:
- ⚠️ **MQTT Broker** - Use **HiveMQ Cloud** (free tier)
- ⚠️ **InfluxDB** - Use **InfluxDB Cloud** (free tier)
- ⚠️ **Grafana** - Optional, use **Grafana Cloud** (free tier)

---

## 🚀 Quick Setup (15 Minutes)

### Step 1: Get Free Cloud Services

#### A. HiveMQ Cloud (MQTT Broker) - FREE

1. Go to: https://www.hivemq.com/mqtt-cloud-broker/
2. Click "Start Free"
3. Sign up (free account)
4. Create a cluster (free tier: 2 connections)
5. **Copy connection details:**
   - Host: `your-cluster.hivemq.cloud`
   - Port: `8883` (TLS) or `1883` (non-TLS)
   - Username: (from dashboard)
   - Password: (from dashboard)

#### B. InfluxDB Cloud (Database) - FREE

1. Go to: https://www.influxdata.com/products/influxdb-cloud/
2. Click "Get Started Free"
3. Sign up (free tier: 10MB/month)
4. Create a bucket: `plc_data_new`
5. **Copy connection details:**
   - URL: `https://us-east-1-1.aws.cloud2.influxdata.com` (or your region)
   - Token: (generate API token)
   - Org: (your org name)
   - Bucket: `plc_data_new`

---

### Step 2: Create Replit Project

1. Go to: https://replit.com
2. Click "Create Repl"
3. Choose **"Python"** template
4. Name: `mqtt-ot-network`
5. Click "Create Repl"

---

### Step 3: Upload Your Code

#### Option A: Git Clone (Easiest)

In Replit shell:
```bash
git clone https://github.com/hamzakhan3/mqtt-ot-network.git .
```

#### Option B: Upload Files

1. Click "Files" in sidebar
2. Click "Upload file" or drag & drop
3. Upload these directories:
   - `mock_plc_agent/`
   - `influxdb_writer/`
   - `frontend/`
   - `requirements.txt`

---

### Step 4: Install Dependencies

In Replit shell:

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Node.js for frontend
npm install -g npm@latest

# Install frontend dependencies
cd frontend
npm install
cd ..
```

---

### Step 5: Set Up Environment Variables

In Replit, click the **🔒 Secrets** tab (lock icon) and add:

```
MQTT_BROKER_HOST=your-cluster.hivemq.cloud
MQTT_BROKER_PORT=8883
MQTT_USERNAME=your-hivemq-username
MQTT_PASSWORD=your-hivemq-password
MQTT_TLS_ENABLED=true

INFLUXDB_URL=https://us-east-1-1.aws.cloud2.influxdata.com
INFLUXDB_TOKEN=your-influxdb-token
INFLUXDB_ORG=your-org-name
INFLUXDB_BUCKET=plc_data_new

MACHINE_ID=machine-01
PUBLISH_INTERVAL=2.0

NEXT_PUBLIC_INFLUXDB_URL=https://us-east-1-1.aws.cloud2.influxdata.com
NEXT_PUBLIC_INFLUXDB_TOKEN=your-influxdb-token
NEXT_PUBLIC_INFLUXDB_ORG=your-org-name
NEXT_PUBLIC_INFLUXDB_BUCKET=plc_data_new
```

---

### Step 6: Create Startup Script

Create `main.py` in Replit:

```python
#!/usr/bin/env python3
"""
Replit startup script - runs all services
"""
import subprocess
import os
import time
import signal
import sys

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

# Start Frontend (if node_modules exists)
if os.path.exists("frontend/node_modules"):
    start_service(
        "Frontend",
        "npm run dev",
        cwd="frontend"
    )
else:
    print("⚠️ Frontend dependencies not installed. Run: cd frontend && npm install")

print("\n" + "=" * 60)
print("✅ All services running!")
print("=" * 60)
print("\n📊 Services:")
for name, process in processes:
    status = "🟢 Running" if process.poll() is None else "🔴 Stopped"
    print(f"   {status} - {name}")

print("\n💡 Check Replit webview for frontend")
print("🛑 Press Ctrl+C to stop\n")

# Keep script running and show output
try:
    while True:
        time.sleep(1)
        # Check if any process died
        for name, process in processes:
            if process.poll() is not None:
                print(f"⚠️ {name} stopped (exit code: {process.returncode})")
                # Try to restart
                if name == "InfluxDB Writer":
                    start_service(name, "python3 influxdb_writer/influxdb_writer_production.py")
                elif name == "Mock PLC Agent":
                    start_service(name, "python3 mock_plc_agent/mock_plc_agent.py")
except KeyboardInterrupt:
    pass
finally:
    cleanup()
```

---

### Step 7: Configure Replit

Create `.replit` file:

```toml
language = "python3"

[deploy]
run = ["python3", "main.py"]

[env]
PORT=3005
```

---

### Step 8: Run!

Click the **"Run"** button in Replit!

---

## 🌐 Access Your App

### Frontend URL

Replit provides a webview URL:
1. Click the webview panel (or "Open in new tab")
2. URL looks like: `https://mqtt-ot-network.your-username.repl.co`
3. **Share this URL with clients!**

---

## 📊 What Runs Where

```
┌─────────────────────────────────────────┐
│         Replit (FREE)                  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ Mock PLC Agent (Python)          │  │
│  │ - Publishes every 2 seconds     │  │
│  └───────────┬──────────────────────┘  │
│              │                          │
│  ┌───────────▼──────────────────────┐  │
│  │ InfluxDB Writer (Python)         │  │
│  │ - Subscribes & writes            │  │
│  └───────────┬──────────────────────┘  │
│              │                          │
│  ┌───────────▼──────────────────────┐  │
│  │ Frontend (Next.js)                │  │
│  │ - Public URL                      │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
              │
              │ (Internet)
              ▼
┌─────────────────────────────────────────┐
│      HiveMQ Cloud (FREE)                │
│      - MQTT Broker                     │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│      InfluxDB Cloud (FREE)              │
│      - Time-series database             │
└─────────────────────────────────────────┘
```

---

## 💰 Cost Breakdown

| Service | Platform | Cost |
|---------|----------|------|
| Mock PLC Agent | Replit | **FREE** |
| InfluxDB Writer | Replit | **FREE** |
| Frontend | Replit | **FREE** |
| MQTT Broker | HiveMQ Cloud | **FREE** (2 connections) |
| InfluxDB | InfluxDB Cloud | **FREE** (10MB/month) |
| **Total** | | **$0/month** |

---

## ⚠️ Replit Limitations (Free Tier)

1. **May sleep after inactivity**
   - Solution: Use UptimeRobot to ping your Repl
   - Or upgrade to Core ($7/month) for always-on

2. **Resource limits**
   - CPU: Shared
   - Memory: 512MB-1GB
   - Storage: 1GB

3. **No Docker support**
   - Can't run Mosquitto/InfluxDB directly
   - Use cloud services instead (free!)

---

## 🔧 Troubleshooting

### Services Not Starting

**Check:**
1. Dependencies installed: `pip list`
2. Environment variables set: Check Secrets tab
3. Logs: Check Replit console

**Fix:**
```bash
# Reinstall dependencies
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

### Mock PLC Not Publishing

**Check:**
1. HiveMQ connection: Test with `mosquitto_pub` (if available)
2. Environment variables: `echo $MQTT_BROKER_HOST`
3. Network: Replit can access external services

**Fix:**
```bash
# Test MQTT connection
python3 -c "
import paho.mqtt.client as mqtt
client = mqtt.Client()
client.username_pw_set('$MQTT_USERNAME', '$MQTT_PASSWORD')
client.connect('$MQTT_BROKER_HOST', 8883)
print('Connected!')
"
```

### Frontend Not Loading

**Check:**
1. Dependencies: `cd frontend && npm list`
2. Port: Replit auto-assigns, check webview URL
3. Build: `cd frontend && npm run build`

---

## 🎯 Keep Repl Alive (Free Tier)

Replit free tier may sleep after inactivity. Keep it awake:

### Option 1: UptimeRobot (Free)

1. Go to: https://uptimerobot.com
2. Create account (free)
3. Add monitor:
   - Type: HTTP(s)
   - URL: Your Replit webview URL
   - Interval: 5 minutes
4. UptimeRobot will ping your Repl every 5 minutes

### Option 2: Replit Core ($7/month)

- Always-on option
- Better resources
- No sleep

---

## ✅ Deployment Checklist

- [ ] HiveMQ Cloud account created
- [ ] InfluxDB Cloud account created
- [ ] Replit project created
- [ ] Code uploaded to Replit
- [ ] Dependencies installed
- [ ] Environment variables set (Secrets)
- [ ] `main.py` created
- [ ] Services running
- [ ] Frontend accessible
- [ ] UptimeRobot set up (optional)

---

## 🚀 Quick Commands

```bash
# Install everything
pip install -r requirements.txt
cd frontend && npm install && cd ..

# Run services
python3 main.py

# Check if services are running
ps aux | grep python
```

---

## 📚 Next Steps

1. **Deploy to Replit** using steps above
2. **Set up UptimeRobot** to keep Repl awake
3. **Test everything** works
4. **Share frontend URL** with clients!

---

## 💡 Pro Tips

1. **Use Replit Secrets** for sensitive data (passwords, tokens)
2. **Monitor usage** - Check Replit dashboard
3. **Keep logs open** - Watch for errors
4. **Test locally first** - Make sure code works
5. **Backup your code** - Push to GitHub regularly

---

## 🎉 You're Done!

**Total Cost: $0/month** (completely free!)

Everything runs:
- ✅ Mock PLC Agent → Replit (free)
- ✅ InfluxDB Writer → Replit (free)
- ✅ Frontend → Replit (free)
- ✅ MQTT Broker → HiveMQ Cloud (free)
- ✅ Database → InfluxDB Cloud (free)

**Share your Replit webview URL with clients!** 🚀

---

## Support

- Replit Docs: https://docs.replit.com
- HiveMQ Docs: https://www.hivemq.com/docs/
- InfluxDB Docs: https://docs.influxdata.com/

Good luck! 🎉

