# Railway Quick Start - Deploy Everything to Cloud

## ✅ What You'll Get

After deployment, you'll have:
- 🌐 **Public Frontend URL** - Share with clients: `https://your-app.railway.app`
- 📊 **Public Grafana URL** (optional) - Advanced dashboards
- 🔒 **Private Services** - MQTT, InfluxDB (internal only, secure)
- 🤖 **Mock Data Running 24/7** - Automatically generates data
- 📈 **Real-time Dashboard** - Live updates every 2 seconds

**Everything runs in the cloud - no local setup needed!**

---

## 🚀 Step-by-Step Deployment

### Method 1: Railway Web UI (Easiest - Recommended)

#### Step 1: Prepare Your Repository

Make sure your code is on GitHub/GitLab/Bitbucket:
```bash
# If not already on GitHub, push your code:
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

#### Step 2: Go to Railway

1. Visit: https://railway.app
2. Click **"Start a New Project"**
3. Click **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub
5. Select your `mqtt-ot-network` repository

#### Step 3: Railway Auto-Detects Services

Railway will detect `docker-compose.cloud.yml` and create services automatically!

If it doesn't auto-detect, manually add services:

**Add MQTT Broker:**
- Click **"+ New"** → **"Empty Service"**
- Name: `mqtt-broker`
- Source: Connect to your repo
- Root Directory: `/`
- Dockerfile Path: (leave empty, we'll use docker-compose)

**Add InfluxDB:**
- Click **"+ New"** → **"Empty Service"**
- Name: `influxdb`
- Source: Connect to your repo

**Add Frontend:**
- Click **"+ New"** → **"Empty Service"**
- Name: `frontend`
- Source: Connect to your repo
- Root Directory: `/frontend`
- Dockerfile Path: `Dockerfile`

**Add InfluxDB Writer:**
- Click **"+ New"** → **"Empty Service"**
- Name: `influxdb-writer`
- Source: Connect to your repo
- Dockerfile Path: `Dockerfile.influxdb-writer`

**Add Mock PLC Agent:**
- Click **"+ New"** → **"Empty Service"**
- Name: `mock-plc`
- Source: Connect to your repo
- Dockerfile Path: `Dockerfile.mock-plc`

#### Step 4: Configure Environment Variables

For each service, click **"Variables"** tab and add:

**MQTT Broker:**
```
MQTT_PORT=8883
```

**InfluxDB:**
```
DOCKER_INFLUXDB_INIT_MODE=setup
DOCKER_INFLUXDB_INIT_USERNAME=admin
DOCKER_INFLUXDB_INIT_PASSWORD=your-secure-password-here
DOCKER_INFLUXDB_INIT_ORG=myorg
DOCKER_INFLUXDB_INIT_BUCKET=plc_data_new
DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=your-secure-token-here
```

**InfluxDB Writer:**
```
MQTT_BROKER_HOST=mqtt-broker
MQTT_BROKER_PORT=8883
MQTT_USERNAME=influxdb_writer
MQTT_PASSWORD=influxdb_writer_pass
MQTT_TLS_ENABLED=false
INFLUXDB_URL=http://influxdb:8086
INFLUXDB_TOKEN=your-secure-token-here
INFLUXDB_ORG=myorg
INFLUXDB_BUCKET=plc_data_new
```

**Mock PLC Agent:**
```
MQTT_BROKER_HOST=mqtt-broker
MQTT_BROKER_PORT=8883
MQTT_USERNAME=edge_gateway
MQTT_PASSWORD=edge_gateway_pass
MQTT_TLS_ENABLED=false
MACHINE_ID=machine-01
PUBLISH_INTERVAL=2.0
```

**Frontend:**
```
NEXT_PUBLIC_INFLUXDB_URL=http://influxdb:8086
NEXT_PUBLIC_INFLUXDB_TOKEN=your-secure-token-here
NEXT_PUBLIC_INFLUXDB_ORG=myorg
NEXT_PUBLIC_INFLUXDB_BUCKET=plc_data_new
PORT=3005
```

#### Step 5: Generate Public URLs

For **Frontend** service:
1. Click on `frontend` service
2. Go to **"Settings"** tab
3. Under **"Networking"**, click **"Generate Domain"**
4. Copy the URL (e.g., `https://frontend-production-xxxx.up.railway.app`)

For **Grafana** (optional):
1. Click on `grafana` service
2. Generate domain the same way

#### Step 6: Deploy!

1. Click **"Deploy"** button (or Railway auto-deploys on git push)
2. Watch the logs - you'll see services starting
3. Wait 2-3 minutes for everything to start
4. Visit your frontend URL!

---

### Method 2: Railway CLI (For Developers)

#### Step 1: Install Railway CLI

```bash
npm i -g @railway/cli
```

#### Step 2: Login

```bash
railway login
```

#### Step 3: Initialize Project

```bash
cd /Users/khanhamza/mqtt-ot-network
railway init
```

#### Step 4: Link to Existing Project (or create new)

```bash
# If you created project in web UI, link it:
railway link

# Or create new project:
railway init --name mqtt-ot-network
```

#### Step 5: Deploy Services

Railway can deploy from docker-compose:

```bash
# Deploy all services from docker-compose
railway up
```

Or deploy services individually:

```bash
# Create services
railway service create mqtt-broker
railway service create influxdb
railway service create grafana
railway service create influxdb-writer
railway service create mock-plc
railway service create frontend
```

#### Step 6: Set Environment Variables

```bash
# Set variables for each service
railway variables set MQTT_BROKER_HOST=mqtt-broker --service influxdb-writer
railway variables set MACHINE_ID=machine-01 --service mock-plc
# ... (set all variables as shown in Method 1)
```

#### Step 7: Generate Public URL

```bash
# Generate domain for frontend
railway domain --service frontend
```

---

## 🎯 What Your Clients Will See

### Frontend Dashboard (Public URL)

When clients visit your frontend URL, they'll see:
- ✅ Real-time production data
- ✅ Live charts updating every 2 seconds
- ✅ Production counters (bottles filled, rejected)
- ✅ System status indicators
- ✅ Alarm panels
- ✅ Tank status
- ✅ Complete tags table

**URL Example:** `https://mqtt-ot-network-frontend.up.railway.app`

### Data Flow (Automatic)

```
Mock PLC Agent (Cloud)
    ↓ Every 2 seconds
MQTT Broker (Cloud)
    ↓
InfluxDB Writer (Cloud)
    ↓
InfluxDB (Cloud)
    ↓
Frontend (Cloud) ← Clients see this!
```

**Everything is automatic - no manual intervention needed!**

---

## 🔐 Security Notes

### Public vs Private Services

- **Frontend**: Public (clients can access)
- **Grafana**: Public (optional, for advanced dashboards)
- **MQTT Broker**: Private (internal only)
- **InfluxDB**: Private (internal only)
- **Python Services**: Private (background workers)

### Environment Variables

Railway stores secrets securely:
- Click **"Variables"** tab in each service
- Mark sensitive variables as **"Secret"**
- They're encrypted and never exposed

---

## 📊 Monitoring Your Deployment

### Check Service Status

1. Go to Railway dashboard
2. Click on each service
3. View **"Metrics"** tab for:
   - CPU usage
   - Memory usage
   - Network traffic

### View Logs

1. Click on any service
2. Go to **"Deployments"** tab
3. Click on latest deployment
4. View **"Logs"** tab

**Or use CLI:**
```bash
railway logs --service mock-plc
railway logs --service influxdb-writer
railway logs --service frontend
```

### Verify Mock Data is Running

Check Mock PLC logs:
```bash
railway logs --service mock-plc --follow
```

You should see:
```
🚀 Mock PLC Agent started. Publishing data every 2.0 seconds...
⏰ 2025-11-25T... | [machine-01] | Bottles: 1 | Filling: True
⏰ 2025-11-25T... | [machine-01] | Bottles: 2 | Filling: False
```

---

## 🎨 Customizing for Clients

### Change Machine ID

To simulate different machines:
1. Create additional Mock PLC services
2. Set `MACHINE_ID=machine-02`, `machine-03`, etc.
3. Frontend will show dropdown to switch machines

### Customize Frontend

Edit `frontend/app/page.tsx` and push to GitHub:
- Railway auto-deploys on git push
- Changes go live in 2-3 minutes

### Add More Machines

```bash
# Create machine-02
railway service create mock-plc-02
railway variables set MACHINE_ID=machine-02 --service mock-plc-02
railway variables set MQTT_BROKER_HOST=mqtt-broker --service mock-plc-02
# ... (set other variables)
```

---

## 💰 Cost Estimate

**Railway Pricing:**
- **Free Tier**: $5 credit/month (good for testing)
- **Hobby**: $5/month per service
- **Pro**: $20/month per service

**For this project (6 services):**
- Free tier: Limited (good for demos)
- Hobby: ~$30/month (6 services × $5)
- Pro: ~$120/month (better performance)

**Recommendation**: Start with free tier for demos, upgrade if needed.

---

## 🚨 Troubleshooting

### Services Not Starting

**Check:**
1. Environment variables are set correctly
2. Dockerfiles are in correct locations
3. Service names match in environment variables

**Fix:**
```bash
# Check service status
railway status

# View logs
railway logs --service <service-name>

# Restart service
railway restart --service <service-name>
```

### Frontend Shows No Data

**Check:**
1. InfluxDB Writer is running: `railway logs --service influxdb-writer`
2. Mock PLC is publishing: `railway logs --service mock-plc`
3. Frontend environment variables are correct

**Fix:**
```bash
# Verify InfluxDB URL in frontend
railway variables --service frontend

# Should be: http://influxdb:8086 (not localhost!)
```

### Mock PLC Not Publishing

**Check:**
1. MQTT broker is running
2. Environment variables are set
3. Network connectivity (use service name `mqtt-broker`, not `localhost`)

**Fix:**
```bash
# Restart Mock PLC
railway restart --service mock-plc

# Check logs
railway logs --service mock-plc --follow
```

---

## ✅ Deployment Checklist

Before showing to clients:

- [ ] All services deployed and running
- [ ] Frontend has public URL
- [ ] Mock PLC is publishing data (check logs)
- [ ] InfluxDB Writer is receiving data (check logs)
- [ ] Frontend shows data (visit URL)
- [ ] Charts are updating
- [ ] Test on mobile device (responsive design)
- [ ] Share URL with clients!

---

## 🎉 You're Ready!

Once deployed:
1. **Share the frontend URL** with clients
2. **Everything runs automatically** - no maintenance needed
3. **Data updates in real-time** - impressive for demos!
4. **Professional cloud deployment** - looks great!

**Your clients will see:**
- Professional dashboard
- Real-time data visualization
- Production monitoring
- All running in the cloud!

---

## 📞 Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Check logs: `railway logs --service <name>`

Good luck with your client demo! 🚀

