# Quick Cloud Deployment Guide

## 🚀 Fastest Options (Choose One)

### Option 1: Railway.app (Recommended for Quick Start)

**Time to deploy**: ~15 minutes

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Deploy all services
railway up --service mqtt-broker
railway up --service influxdb
railway up --service grafana
railway up --service influxdb-writer
railway up --service frontend
```

**Or use Railway's web UI:**
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your repo
5. Railway auto-detects Dockerfiles and docker-compose.yml

---

### Option 2: Render.com

**Time to deploy**: ~20 minutes

1. **Go to**: https://render.com
2. **Create account** (free tier available)
3. **New → Blueprint** (for docker-compose)
   - Connect GitHub repo
   - Select `docker-compose.cloud.yml`
   - Render auto-deploys

**Or deploy services individually:**
- **Web Service**: Frontend (Next.js)
- **Background Worker**: InfluxDB Writer
- **Background Worker**: Mock PLC Agent
- **Private Service**: MQTT Broker
- **Private Service**: InfluxDB
- **Private Service**: Grafana

---

### Option 3: DigitalOcean App Platform

**Time to deploy**: ~25 minutes

1. **Go to**: https://cloud.digitalocean.com/apps
2. **Create App** → **GitHub**
3. **Select repo** and branch
4. **Configure**:
   - Auto-detect Dockerfiles
   - Set environment variables
   - Configure ports

**Cost**: ~$12-48/month

---

## 📋 Pre-Deployment Checklist

Before deploying, make sure:

- [ ] **Environment variables** are set (see below)
- [ ] **TLS certificates** are generated (for MQTT)
- [ ] **MQTT authentication** is configured
- [ ] **Git repository** is up to date
- [ ] **Dockerfiles** are tested locally

---

## 🔐 Required Environment Variables

Set these in your cloud platform:

### MQTT Broker
```
MQTT_BROKER_HOST=your-mqtt-host
MQTT_BROKER_PORT=8883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password
MQTT_TLS_ENABLED=true
CA_CERT_PATH=/path/to/ca.crt
```

### InfluxDB
```
INFLUXDB_URL=http://influxdb:8086
INFLUXDB_TOKEN=your-token
INFLUXDB_ORG=myorg
INFLUXDB_BUCKET=plc_data_new
```

### Frontend
```
NEXT_PUBLIC_INFLUXDB_URL=http://your-influxdb-url:8086
NEXT_PUBLIC_INFLUXDB_TOKEN=your-token
NEXT_PUBLIC_INFLUXDB_ORG=myorg
NEXT_PUBLIC_INFLUXDB_BUCKET=plc_data_new
```

---

## 🧪 Test Locally First

Before deploying to cloud, test with cloud compose:

```bash
# Build and test locally
docker-compose -f docker-compose.cloud.yml up --build

# Test services
curl http://localhost:3005  # Frontend
curl http://localhost:8086/health  # InfluxDB
```

---

## 📦 What Gets Deployed

### Services:
1. **MQTT Broker** (Mosquitto) - Port 8883
2. **InfluxDB** - Port 8086
3. **Grafana** - Port 3004
4. **InfluxDB Writer** - Background service
5. **Mock PLC Agent** - Background service (optional)
6. **Frontend** (Next.js) - Port 3005

### Data Persistence:
- InfluxDB data: `./influxdb/data/`
- Grafana data: `./grafana/data/`
- MQTT data: `./mosquitto/data/`

**⚠️ Important**: In cloud, use volumes/persistent storage for these directories!

---

## 🎯 Platform-Specific Notes

### Railway
- ✅ Auto-detects docker-compose.yml
- ✅ Free $5 credit/month
- ✅ Simple environment variables
- ⚠️ Use `railway variables` to set secrets

### Render
- ✅ Great Docker support
- ✅ Private services for internal networking
- ⚠️ Free tier has limitations
- ⚠️ Set environment variables in dashboard

### DigitalOcean
- ✅ Very affordable
- ✅ Full control
- ⚠️ More manual setup
- ⚠️ Need to configure networking

---

## 🔄 After Deployment

1. **Verify services are running**
2. **Test MQTT connection**
3. **Check InfluxDB has data**
4. **Access frontend** at your cloud URL
5. **Set up monitoring/alerts**

---

## 💡 Pro Tips

1. **Use managed services** when possible:
   - AWS IoT Core (instead of self-hosted MQTT)
   - InfluxDB Cloud (instead of self-hosted)
   - Grafana Cloud (instead of self-hosted)

2. **Separate concerns**:
   - Frontend: Vercel/Netlify (free, optimized for Next.js)
   - Backend services: Railway/Render
   - Database: Managed InfluxDB Cloud

3. **Cost optimization**:
   - Start with free tiers
   - Use spot instances for non-critical services
   - Monitor usage and scale down when possible

---

## 🆘 Troubleshooting

### Services won't start
- Check environment variables are set
- Verify Dockerfiles build correctly
- Check logs: `railway logs` or platform logs

### No data in InfluxDB
- Verify MQTT broker is accessible
- Check InfluxDB Writer logs
- Test MQTT connection manually

### Frontend shows errors
- Check InfluxDB URL is correct
- Verify CORS settings
- Check browser console for errors

---

## 📚 Next Steps

1. **Read full guide**: See `CLOUD_DEPLOYMENT.md` for detailed options
2. **Choose platform**: Based on your needs (cost, scale, features)
3. **Deploy**: Follow platform-specific instructions
4. **Monitor**: Set up logging and alerts
5. **Scale**: Add more services as needed

---

## 🎉 You're Ready!

Pick a platform and start deploying. The easiest path:
1. **Railway** for all-in-one deployment
2. **Vercel** for frontend (free, optimized)
3. **InfluxDB Cloud** for managed database

Good luck! 🚀

