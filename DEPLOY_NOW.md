# 🚀 Deploy to Railway - Quick Start

## ✅ What You'll Get

**After deployment:**
- 🌐 **Public Frontend URL** - Share with clients: `https://your-app.railway.app`
- 📊 **Live Dashboard** - Real-time data updating every 2 seconds
- 🤖 **Mock Data Running 24/7** - Automatically generates data
- 📈 **Professional Demo** - Ready to show clients!

**Everything runs in the cloud - no local setup needed!**

---

## 🎯 Quick Deploy (5 Minutes)

### Step 1: Push to GitHub

```bash
# Make sure your code is on GitHub
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

### Step 2: Deploy on Railway

1. **Go to**: https://railway.app
2. **Click**: "Start a New Project"
3. **Select**: "Deploy from GitHub repo"
4. **Authorize** Railway to access GitHub
5. **Choose** your `mqtt-ot-network` repository

### Step 3: Railway Auto-Setup

Railway will:
- ✅ Detect your `docker-compose.cloud.yml`
- ✅ Create services automatically
- ✅ Start deploying

**OR** if it doesn't auto-detect, add services manually:

---

## 📦 Manual Service Setup (If Needed)

### Add Services One by One:

1. **MQTT Broker**
   - Click "+ New" → "Empty Service"
   - Name: `mqtt-broker`
   - Source: Your repo
   - Image: `eclipse-mosquitto:latest`

2. **InfluxDB**
   - Click "+ New" → "Empty Service"
   - Name: `influxdb`
   - Source: Your repo
   - Image: `influxdb:2.7`

3. **Frontend** ⭐ (This is what clients see!)
   - Click "+ New" → "Empty Service"
   - Name: `frontend`
   - Source: Your repo
   - Root Directory: `/frontend`
   - Dockerfile: `Dockerfile`

4. **InfluxDB Writer**
   - Click "+ New" → "Empty Service"
   - Name: `influxdb-writer`
   - Source: Your repo
   - Dockerfile: `Dockerfile.influxdb-writer`

5. **Mock PLC Agent** (Generates data!)
   - Click "+ New" → "Empty Service"
   - Name: `mock-plc`
   - Source: Your repo
   - Dockerfile: `Dockerfile.mock-plc`

---

## 🔐 Set Environment Variables

For each service, click **"Variables"** tab:

### InfluxDB Service:
```
DOCKER_INFLUXDB_INIT_MODE=setup
DOCKER_INFLUXDB_INIT_USERNAME=admin
DOCKER_INFLUXDB_INIT_PASSWORD=ChangeThisPassword123!
DOCKER_INFLUXDB_INIT_ORG=myorg
DOCKER_INFLUXDB_INIT_BUCKET=plc_data_new
DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=ChangeThisToken123!
```

### InfluxDB Writer Service:
```
MQTT_BROKER_HOST=mqtt-broker
MQTT_BROKER_PORT=8883
MQTT_USERNAME=influxdb_writer
MQTT_PASSWORD=influxdb_writer_pass
MQTT_TLS_ENABLED=false
INFLUXDB_URL=http://influxdb:8086
INFLUXDB_TOKEN=ChangeThisToken123!
INFLUXDB_ORG=myorg
INFLUXDB_BUCKET=plc_data_new
```

### Mock PLC Service:
```
MQTT_BROKER_HOST=mqtt-broker
MQTT_BROKER_PORT=8883
MQTT_USERNAME=edge_gateway
MQTT_PASSWORD=edge_gateway_pass
MQTT_TLS_ENABLED=false
MACHINE_ID=machine-01
PUBLISH_INTERVAL=2.0
```

### Frontend Service:
```
NEXT_PUBLIC_INFLUXDB_URL=http://influxdb:8086
NEXT_PUBLIC_INFLUXDB_TOKEN=ChangeThisToken123!
NEXT_PUBLIC_INFLUXDB_ORG=myorg
NEXT_PUBLIC_INFLUXDB_BUCKET=plc_data_new
PORT=3005
```

**⚠️ Important**: Replace `ChangeThisToken123!` and `ChangeThisPassword123!` with secure values!

---

## 🌐 Get Your Public URL

### For Frontend (What Clients See):

1. Click on **`frontend`** service
2. Go to **"Settings"** tab
3. Scroll to **"Networking"** section
4. Click **"Generate Domain"**
5. **Copy the URL** - This is what you share with clients!

**Example URL**: `https://mqtt-ot-network-frontend-production.up.railway.app`

---

## ✅ Verify Everything Works

### 1. Check Services Are Running

In Railway dashboard, all services should show:
- 🟢 **Active** status
- ✅ **Deployed** status

### 2. Check Mock PLC is Publishing

1. Click on **`mock-plc`** service
2. Go to **"Deployments"** tab
3. Click latest deployment
4. View **"Logs"** tab

You should see:
```
🚀 Mock PLC Agent started. Publishing data every 2.0 seconds...
⏰ 2025-11-25T... | [machine-01] | Bottles: 1 | Filling: True
```

### 3. Check Frontend

1. Visit your frontend URL
2. You should see:
   - Real-time dashboard
   - Production counters
   - Charts updating
   - Data flowing!

---

## 🎉 You're Done!

**What you have:**
- ✅ Everything running in the cloud
- ✅ Public URL to share with clients
- ✅ Real-time data updating automatically
- ✅ Professional dashboard
- ✅ No maintenance needed!

**Share the frontend URL with clients and impress them!** 🚀

---

## 🆘 Troubleshooting

### Services Not Starting?

1. Check environment variables are set
2. Check logs: Click service → Deployments → Logs
3. Verify Dockerfiles are correct

### Frontend Shows No Data?

1. Check Mock PLC is publishing (view logs)
2. Check InfluxDB Writer is running (view logs)
3. Verify frontend environment variables

### Need Help?

- Railway Docs: https://docs.railway.app
- Check logs: Click service → View logs
- Railway Discord: https://discord.gg/railway

---

## 💰 Cost

- **Free Tier**: $5 credit/month (good for demos)
- **Hobby**: $5/service/month (~$30/month for 6 services)
- **Pro**: $20/service/month (better performance)

**Start with free tier for client demos!**

---

**Ready? Let's deploy!** 🚀

