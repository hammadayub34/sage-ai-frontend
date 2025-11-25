# Railway Deployment Guide - Complete Setup

## How Railway Works with Mock Data

Railway runs **all services as containers** that stay running. The mock PLC agent runs as a **background worker** that continuously publishes data to MQTT every 2 seconds.

## Architecture on Railway

```
Railway Project
├── MQTT Broker (Mosquitto)
│   └── Port: 8883 (public or private)
│
├── InfluxDB
│   └── Port: 8086 (private)
│
├── Grafana (optional)
│   └── Port: 3004 (public)
│
├── InfluxDB Writer (Background Worker)
│   └── Continuously subscribes to MQTT → writes to InfluxDB
│
├── Mock PLC Agent (Background Worker)
│   └── Continuously publishes mock data every 2 seconds
│
└── Frontend (Web Service)
    └── Port: 3005 (public)
```

## Key Points

1. **Mock PLC Agent runs continuously** - It's a long-running process (not a one-time job)
2. **Railway keeps containers alive** - Background workers stay running 24/7
3. **All services communicate** - They use Railway's internal networking
4. **Data flows automatically** - Mock PLC → MQTT → InfluxDB Writer → InfluxDB → Frontend

---

## Step-by-Step Deployment

### Option 1: Using Railway CLI (Recommended)

#### 1. Install Railway CLI

```bash
npm i -g @railway/cli
```

#### 2. Login to Railway

```bash
railway login
```

#### 3. Create New Project

```bash
railway init
# Follow prompts to create new project
```

#### 4. Add Services from Docker Compose

Railway can auto-detect services from `docker-compose.cloud.yml`:

```bash
# Deploy all services at once
railway up --detach

# Or deploy services individually
railway service create mqtt-broker
railway service create influxdb
railway service create grafana
railway service create influxdb-writer
railway service create mock-plc
railway service create frontend
```

#### 5. Configure Each Service

For each service, set environment variables:

**MQTT Broker Service:**
```bash
railway variables set MQTT_PORT=8883 --service mqtt-broker
```

**InfluxDB Service:**
```bash
railway variables set \
  DOCKER_INFLUXDB_INIT_MODE=setup \
  DOCKER_INFLUXDB_INIT_USERNAME=admin \
  DOCKER_INFLUXDB_INIT_PASSWORD=your-secure-password \
  DOCKER_INFLUXDB_INIT_ORG=myorg \
  DOCKER_INFLUXDB_INIT_BUCKET=plc_data_new \
  DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=your-secure-token \
  --service influxdb
```

**InfluxDB Writer Service:**
```bash
railway variables set \
  MQTT_BROKER_HOST=mqtt-broker \
  MQTT_BROKER_PORT=8883 \
  MQTT_USERNAME=influxdb_writer \
  MQTT_PASSWORD=influxdb_writer_pass \
  MQTT_TLS_ENABLED=true \
  INFLUXDB_URL=http://influxdb:8086 \
  INFLUXDB_TOKEN=your-secure-token \
  INFLUXDB_ORG=myorg \
  INFLUXDB_BUCKET=plc_data_new \
  --service influxdb-writer
```

**Mock PLC Agent Service:**
```bash
railway variables set \
  MQTT_BROKER_HOST=mqtt-broker \
  MQTT_BROKER_PORT=8883 \
  MQTT_USERNAME=edge_gateway \
  MQTT_PASSWORD=edge_gateway_pass \
  MQTT_TLS_ENABLED=true \
  MACHINE_ID=machine-01 \
  PUBLISH_INTERVAL=2.0 \
  --service mock-plc
```

**Frontend Service:**
```bash
railway variables set \
  NEXT_PUBLIC_INFLUXDB_URL=http://influxdb:8086 \
  NEXT_PUBLIC_INFLUXDB_TOKEN=your-secure-token \
  NEXT_PUBLIC_INFLUXDB_ORG=myorg \
  NEXT_PUBLIC_INFLUXDB_BUCKET=plc_data_new \
  --service frontend
```

#### 6. Deploy Services

```bash
# Deploy all services
railway up

# Or deploy specific service
railway up --service mock-plc
```

---

### Option 2: Using Railway Web UI (Easier)

#### 1. Go to Railway Dashboard

Visit: https://railway.app

#### 2. Create New Project

- Click "New Project"
- Select "Deploy from GitHub repo"
- Connect your repository
- Railway will detect `docker-compose.cloud.yml`

#### 3. Configure Services

For each service in Railway dashboard:

1. **MQTT Broker**
   - Service Type: **Private Service** (internal only)
   - Dockerfile: Use `docker-compose.cloud.yml` or create service manually
   - Port: 8883

2. **InfluxDB**
   - Service Type: **Private Service**
   - Port: 8086
   - Add environment variables (see above)

3. **Grafana** (optional)
   - Service Type: **Web Service**
   - Port: 3004
   - Generate public URL

4. **InfluxDB Writer**
   - Service Type: **Background Worker**
   - Dockerfile: `Dockerfile.influxdb-writer`
   - Add environment variables

5. **Mock PLC Agent** ⭐ **This is the key one!**
   - Service Type: **Background Worker**
   - Dockerfile: `Dockerfile.mock-plc`
   - Add environment variables:
     ```
     MQTT_BROKER_HOST=mqtt-broker
     MQTT_BROKER_PORT=8883
     MACHINE_ID=machine-01
     PUBLISH_INTERVAL=2.0
     ```
   - **This will run continuously and publish data every 2 seconds**

6. **Frontend**
   - Service Type: **Web Service**
   - Dockerfile: `frontend/Dockerfile`
   - Port: 3005
   - Generate public URL

#### 4. Set Up Service Networking

Railway automatically creates a private network. Services can reference each other by service name:

- `mqtt-broker` - MQTT broker hostname
- `influxdb` - InfluxDB hostname
- `frontend` - Frontend hostname

---

## How Mock Data Works on Railway

### The Mock PLC Agent Service

1. **Starts when Railway deploys** the service
2. **Runs continuously** in a loop:
   ```python
   while True:
       data = generate_mock_data()
       publish_to_mqtt(data)
       time.sleep(2.0)  # Wait 2 seconds
   ```
3. **Publishes to MQTT** every 2 seconds
4. **Stays alive** - Railway keeps the container running
5. **Auto-restarts** if it crashes

### Data Flow

```
Mock PLC Agent (Background Worker)
    ↓ (every 2 seconds)
    Publishes to: plc/machine-01/bottlefiller/data
    ↓
MQTT Broker (Private Service)
    ↓
InfluxDB Writer (Background Worker)
    ↓ (subscribes and writes)
InfluxDB (Private Service)
    ↓
Frontend (Web Service)
    ↓ (queries via API)
User sees real-time data!
```

---

## Multiple Mock PLC Agents

To simulate multiple machines, create **multiple Mock PLC services**:

### Machine 01
```bash
railway service create mock-plc-01
railway variables set MACHINE_ID=machine-01 --service mock-plc-01
```

### Machine 02
```bash
railway service create mock-plc-02
railway variables set MACHINE_ID=machine-02 --service mock-plc-02
```

### Machine 03
```bash
railway service create mock-plc-03
railway variables set MACHINE_ID=machine-03 --service mock-plc-03
```

Each service runs independently and publishes data for its machine.

---

## Railway-Specific Configuration

### 1. Service Discovery

Railway provides environment variables for service discovery:

```bash
# Railway automatically sets these:
RAILWAY_SERVICE_NAME=mqtt-broker
RAILWAY_ENVIRONMENT=production
RAILWAY_PROJECT_ID=xxx
```

### 2. Internal Networking

Services communicate using Railway's internal DNS:

```python
# In your Python code, use service names:
MQTT_BROKER_HOST = "mqtt-broker"  # Not localhost!
INFLUXDB_URL = "http://influxdb:8086"  # Not localhost!
```

### 3. Public vs Private Services

- **Public Services**: Get public URLs (Frontend, Grafana)
- **Private Services**: Only accessible internally (MQTT, InfluxDB)
- **Background Workers**: Run continuously, no public URL

### 4. Persistent Storage

Railway provides volumes for data persistence:

```yaml
# In docker-compose or Railway config
volumes:
  - ./influxdb/data:/var/lib/influxdb2
  - ./grafana/data:/var/lib/grafana
```

**⚠️ Important**: Railway volumes persist data, but check Railway's storage limits.

---

## Environment Variables Reference

### All Services Need:

```bash
# MQTT Configuration
MQTT_BROKER_HOST=mqtt-broker  # Use service name, not localhost!
MQTT_BROKER_PORT=8883
MQTT_USERNAME=edge_gateway
MQTT_PASSWORD=your-password
MQTT_TLS_ENABLED=true

# InfluxDB Configuration
INFLUXDB_URL=http://influxdb:8086  # Use service name!
INFLUXDB_TOKEN=your-secure-token
INFLUXDB_ORG=myorg
INFLUXDB_BUCKET=plc_data_new

# Mock PLC Specific
MACHINE_ID=machine-01
PUBLISH_INTERVAL=2.0
```

---

## Testing the Deployment

### 1. Check Service Logs

```bash
# View logs for Mock PLC Agent
railway logs --service mock-plc

# View logs for InfluxDB Writer
railway logs --service influxdb-writer

# View all logs
railway logs
```

### 2. Verify Mock PLC is Publishing

You should see in logs:
```
🚀 Mock PLC Agent started. Publishing data every 2.0 seconds...
🏭 Machine ID: machine-01
📡 Topic: plc/machine-01/bottlefiller/#
⏰ 2025-11-25T... | [machine-01] | Bottles: 5 | Filling: True | Level: 45.2%
```

### 3. Verify InfluxDB Writer is Receiving

You should see:
```
✅ Connected to MQTT broker
📡 Subscribed to: plc/+/bottlefiller/data
📨 Received message on topic: plc/machine-01/bottlefiller/data
💾 Written to InfluxDB: Bottles=5, Speed=42.30, Running=True
```

### 4. Check Frontend

Visit your Railway-generated frontend URL. You should see:
- Real-time data updating
- Charts showing data
- Production counters increasing

---

## Troubleshooting

### Mock PLC Agent Not Publishing

**Check:**
1. Service is running: `railway status`
2. Logs show connection: `railway logs --service mock-plc`
3. MQTT broker is accessible: Use service name `mqtt-broker`, not `localhost`
4. Environment variables are set correctly

**Fix:**
```bash
# Restart the service
railway restart --service mock-plc

# Check environment variables
railway variables --service mock-plc
```

### No Data in InfluxDB

**Check:**
1. InfluxDB Writer is running: `railway logs --service influxdb-writer`
2. Mock PLC is publishing: `railway logs --service mock-plc`
3. MQTT broker is running: `railway status`

**Fix:**
```bash
# Restart InfluxDB Writer
railway restart --service influxdb-writer

# Verify MQTT connection
railway logs --service mock-plc | grep "Connected"
```

### Frontend Shows No Data

**Check:**
1. Frontend environment variables are set
2. InfluxDB URL uses service name: `http://influxdb:8086`
3. InfluxDB has data: Check InfluxDB logs

**Fix:**
```bash
# Update frontend environment variables
railway variables set NEXT_PUBLIC_INFLUXDB_URL=http://influxdb:8086 --service frontend

# Restart frontend
railway restart --service frontend
```

---

## Cost Estimation

Railway pricing (as of 2024):
- **Free tier**: $5 credit/month
- **Hobby**: $5/month per service
- **Pro**: $20/month per service

**For this project:**
- 6 services × $5 = **$30/month** (Hobby plan)
- Or use free tier credits (limited)

**Services:**
1. MQTT Broker
2. InfluxDB
3. Grafana (optional)
4. InfluxDB Writer
5. Mock PLC Agent
6. Frontend

---

## Pro Tips

1. **Use Railway's service templates** - Save time with pre-configured services
2. **Monitor usage** - Check Railway dashboard for resource usage
3. **Set up alerts** - Get notified if services crash
4. **Use Railway's secrets** - Store sensitive data securely
5. **Scale services** - Increase resources if needed

---

## Next Steps

1. **Deploy to Railway** using one of the methods above
2. **Monitor logs** to verify data flow
3. **Test frontend** to see real-time data
4. **Add more machines** by creating additional Mock PLC services
5. **Set up monitoring** and alerts

---

## Quick Start Command

```bash
# One-liner to get started (after railway init)
railway up && railway logs --follow
```

This deploys all services and shows logs in real-time!

---

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Check logs: `railway logs --service <service-name>`

