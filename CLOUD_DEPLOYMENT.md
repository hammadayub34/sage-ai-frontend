# Cloud Deployment Guide

This guide provides multiple options for deploying the MQTT OT Network application to the cloud.

## Current Architecture Summary

**Docker Services:**
- MQTT Broker (Mosquitto) - Port 8883 (TLS)
- InfluxDB 2.7 - Port 8086
- Grafana - Port 3004

**Python Services:**
- InfluxDB Writer (subscribes MQTT → writes InfluxDB)
- Mock PLC Agent (publishes to MQTT)
- Alarm Monitor (optional)

**Frontend:**
- Next.js 14 app - Port 3005

---

## Deployment Options

### Option 1: AWS (Amazon Web Services) ⭐ Recommended for Enterprise

#### Architecture:
```
┌─────────────────────────────────────────────────┐
│ AWS Cloud                                        │
│                                                  │
│ ┌──────────────┐  ┌──────────────┐             │
│ │ AWS IoT Core │  │ InfluxDB     │             │
│ │ (MQTT)       │  │ Cloud        │             │
│ └──────┬───────┘  └──────┬───────┘             │
│        │                  │                      │
│        │                  │                      │
│ ┌──────▼─────────────────▼───────┐             │
│ │ ECS/EKS (Containers)            │             │
│ │  - InfluxDB Writer              │             │
│ │  - Mock PLC Agent               │             │
│ │  - Grafana                      │             │
│ └──────────────────────────────────┘             │
│                                                  │
│ ┌──────────────────────────────────┐            │
│ │ Vercel / Amplify (Frontend)      │            │
│ │  - Next.js App                   │            │
│ └──────────────────────────────────┘            │
└─────────────────────────────────────────────────┘
```

#### Services to Use:

1. **MQTT Broker**: AWS IoT Core
   - Managed MQTT broker
   - Built-in TLS/SSL
   - Device management
   - Rules engine for data routing
   - Cost: ~$0.08 per million messages

2. **Time-Series Database**: InfluxDB Cloud
   - Managed InfluxDB 2.x
   - Auto-scaling
   - Backup included
   - Cost: ~$25/month starter plan

3. **Container Orchestration**: AWS ECS (Fargate) or EKS
   - InfluxDB Writer service
   - Mock PLC Agent service
   - Grafana (or use Grafana Cloud)
   - Cost: ECS Fargate ~$0.04/vCPU-hour

4. **Frontend**: Vercel or AWS Amplify
   - Next.js optimized
   - Auto-deploy from Git
   - CDN included
   - Cost: Free tier available

5. **Monitoring**: CloudWatch
   - Logs, metrics, alarms

#### Estimated Monthly Cost:
- Small scale: ~$50-100/month
- Medium scale: ~$200-500/month
- Large scale: ~$1000+/month

#### Deployment Steps:

```bash
# 1. Setup AWS IoT Core
# - Create thing/policy for devices
# - Configure certificates
# - Set up rules to forward to InfluxDB

# 2. Deploy InfluxDB Writer to ECS
# Create Dockerfile for writer service
# Push to ECR
# Deploy via ECS task definition

# 3. Deploy Frontend to Vercel
cd frontend
vercel deploy
```

---

### Option 2: Azure ⭐ Good for Microsoft Ecosystem

#### Services to Use:

1. **MQTT Broker**: Azure IoT Hub
   - Managed IoT platform
   - MQTT support
   - Device twins
   - Cost: ~$10/month + per message

2. **Time-Series Database**: Azure Time Series Insights or InfluxDB Cloud
   - Azure TSI: Native Azure service
   - InfluxDB Cloud: Third-party option

3. **Container Orchestration**: Azure Container Instances (ACI) or AKS
   - Simple: ACI for single containers
   - Complex: AKS for Kubernetes

4. **Frontend**: Azure Static Web Apps or Vercel
   - Azure SWA: Integrated with Azure ecosystem
   - Vercel: Better Next.js support

#### Estimated Monthly Cost:
- Small scale: ~$50-150/month
- Medium scale: ~$300-600/month

---

### Option 3: Google Cloud Platform (GCP)

#### Services to Use:

1. **MQTT Broker**: Google Cloud IoT Core (deprecated) → Use HiveMQ Cloud or Cloud Pub/Sub
   - Cloud Pub/Sub: Alternative messaging
   - HiveMQ Cloud: Managed MQTT

2. **Time-Series Database**: InfluxDB Cloud or Google Cloud Monitoring
   - InfluxDB Cloud: Best option
   - Cloud Monitoring: Limited for custom metrics

3. **Container Orchestration**: Cloud Run or GKE
   - Cloud Run: Serverless containers (easiest)
   - GKE: Kubernetes for complex setups

4. **Frontend**: Cloud Run or Firebase Hosting
   - Cloud Run: Containerized Next.js
   - Firebase: Static hosting

#### Estimated Monthly Cost:
- Small scale: ~$40-100/month
- Medium scale: ~$200-400/month

---

### Option 4: Railway.app ⭐ Easiest for Quick Deploy

**Best for**: Fast deployment, all-in-one platform

#### Architecture:
```
Railway.app
├── MQTT Broker (Mosquitto container)
├── InfluxDB (container)
├── Grafana (container)
├── InfluxDB Writer (Python service)
├── Mock PLC Agent (Python service)
└── Frontend (Next.js)
```

#### Pros:
- ✅ Simple deployment (Git push)
- ✅ All services in one place
- ✅ Built-in PostgreSQL (can use for other data)
- ✅ Free tier available
- ✅ Automatic HTTPS

#### Cons:
- ❌ Less control over infrastructure
- ❌ Can be expensive at scale
- ❌ Limited networking options

#### Estimated Monthly Cost:
- Free tier: $5 credit/month
- Paid: ~$20-100/month depending on usage

#### Deployment Steps:

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Add services
railway add  # Add each service (MQTT, InfluxDB, etc.)

# 5. Deploy
railway up
```

---

### Option 5: Render.com ⭐ Good Balance

**Best for**: Docker-based deployments, easy scaling

#### Architecture:
```
Render.com
├── Web Service: Frontend (Next.js)
├── Background Worker: InfluxDB Writer
├── Background Worker: Mock PLC Agent
├── Private Service: MQTT Broker
├── Private Service: InfluxDB
└── Private Service: Grafana
```

#### Pros:
- ✅ Docker support
- ✅ Free tier for static sites
- ✅ Easy environment variables
- ✅ Auto-deploy from Git
- ✅ Private services (internal networking)

#### Cons:
- ❌ Free tier limited
- ❌ Can be slow on free tier

#### Estimated Monthly Cost:
- Free tier: Limited
- Paid: ~$25-150/month

---

### Option 6: Fly.io ⭐ Great for Global Distribution

**Best for**: Global edge deployment, low latency

#### Pros:
- ✅ Edge deployment (low latency)
- ✅ Docker support
- ✅ Free tier generous
- ✅ Global distribution
- ✅ Built-in metrics

#### Cons:
- ❌ Learning curve
- ❌ Less managed services

#### Estimated Monthly Cost:
- Free tier: 3 shared VMs
- Paid: ~$10-200/month

---

### Option 7: DigitalOcean ⭐ Cost-Effective

**Best for**: Budget-conscious, full control

#### Architecture:
```
DigitalOcean Droplet (or App Platform)
├── Docker Compose stack
│   ├── MQTT Broker
│   ├── InfluxDB
│   ├── Grafana
│   └── Python services
└── Frontend (separate or same droplet)
```

#### Pros:
- ✅ Very affordable
- ✅ Full control
- ✅ Simple pricing
- ✅ App Platform for easier deployment

#### Cons:
- ❌ More manual setup
- ❌ No managed MQTT/IoT service

#### Estimated Monthly Cost:
- Droplet: $12-48/month
- App Platform: ~$12-60/month

---

## Recommended Approach by Use Case

### 🚀 Quick Prototype / MVP
**Use**: Railway.app or Render.com
- Fastest to deploy
- All services together
- Good for demos

### 💼 Production / Enterprise
**Use**: AWS (ECS + IoT Core + InfluxDB Cloud)
- Most scalable
- Best managed services
- Enterprise support

### 💰 Budget-Conscious
**Use**: DigitalOcean App Platform
- Lowest cost
- Good performance
- Full control

### 🌍 Global / Low Latency
**Use**: Fly.io
- Edge deployment
- Fast worldwide
- Good free tier

---

## Step-by-Step: Railway Deployment (Easiest)

### 1. Prepare for Deployment

```bash
# Create railway.json for service configuration
# Create Dockerfiles for each service
# Set up environment variables
```

### 2. Deploy Services

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Create new project
railway init

# Add each service
railway add --name mqtt-broker
railway add --name influxdb
railway add --name grafana
railway add --name influxdb-writer
railway add --name frontend
```

### 3. Configure Environment Variables

Set in Railway dashboard:
- `MQTT_BROKER_HOST`
- `INFLUXDB_URL`
- `INFLUXDB_TOKEN`
- etc.

### 4. Deploy

```bash
railway up
```

---

## Step-by-Step: AWS ECS Deployment

### 1. Create ECR Repositories

```bash
# For each service
aws ecr create-repository --repository-name mqtt-ot-network/influxdb-writer
aws ecr create-repository --repository-name mqtt-ot-network/frontend
```

### 2. Build and Push Images

```bash
# Build InfluxDB Writer
docker build -t influxdb-writer -f Dockerfile.writer .
docker tag influxdb-writer:latest <account>.dkr.ecr.<region>.amazonaws.com/mqtt-ot-network/influxdb-writer:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/mqtt-ot-network/influxdb-writer:latest
```

### 3. Create ECS Task Definitions

```json
{
  "family": "influxdb-writer",
  "containerDefinitions": [{
    "name": "influxdb-writer",
    "image": "<account>.dkr.ecr.<region>.amazonaws.com/mqtt-ot-network/influxdb-writer:latest",
    "environment": [
      {"name": "MQTT_BROKER_HOST", "value": "your-iot-endpoint.iot.region.amazonaws.com"}
    ]
  }]
}
```

### 4. Create ECS Service

```bash
aws ecs create-service \
  --cluster mqtt-ot-network \
  --service-name influxdb-writer \
  --task-definition influxdb-writer \
  --desired-count 1
```

---

## Step-by-Step: DigitalOcean App Platform

### 1. Create App Spec (app.yaml)

```yaml
name: mqtt-ot-network
services:
  - name: mqtt-broker
    dockerfile_path: Dockerfile.mqtt
    envs:
      - key: MQTT_PORT
        value: "8883"
  
  - name: influxdb
    dockerfile_path: Dockerfile.influxdb
    envs:
      - key: DOCKER_INFLUXDB_INIT_MODE
        value: setup
  
  - name: frontend
    dockerfile_path: frontend/Dockerfile
    envs:
      - key: NEXT_PUBLIC_INFLUXDB_URL
        value: ${influxdb.PRIVATE_IP}:8086
```

### 2. Deploy

```bash
doctl apps create --spec app.yaml
```

---

## Migration Checklist

### Pre-Deployment
- [ ] Review and update all environment variables
- [ ] Update MQTT broker hostnames/IPs
- [ ] Update InfluxDB connection strings
- [ ] Test locally with production config
- [ ] Review security settings (TLS, auth)
- [ ] Set up monitoring/logging

### Deployment
- [ ] Deploy infrastructure (containers/services)
- [ ] Configure networking (VPC, security groups)
- [ ] Set up DNS/domain names
- [ ] Configure SSL certificates
- [ ] Deploy frontend
- [ ] Test end-to-end data flow

### Post-Deployment
- [ ] Verify all services running
- [ ] Test MQTT connectivity
- [ ] Verify data in InfluxDB
- [ ] Test frontend dashboard
- [ ] Set up backups
- [ ] Configure alerts
- [ ] Document deployment

---

## Cost Comparison Table

| Platform | Small Scale | Medium Scale | Notes |
|----------|------------|--------------|-------|
| **Railway** | $20-50 | $100-300 | Easy, all-in-one |
| **Render** | $25-75 | $150-400 | Good Docker support |
| **Fly.io** | $10-30 | $50-200 | Global edge |
| **DigitalOcean** | $12-48 | $50-150 | Most affordable |
| **AWS** | $50-100 | $200-500 | Most scalable |
| **Azure** | $50-150 | $300-600 | Microsoft ecosystem |
| **GCP** | $40-100 | $200-400 | Good for ML/AI |

---

## Security Considerations

### All Platforms:
1. **Use managed MQTT** (AWS IoT Core, Azure IoT Hub) when possible
2. **Enable TLS/SSL** for all connections
3. **Use secrets management** (AWS Secrets Manager, etc.)
4. **Enable authentication** for all services
5. **Use private networking** for internal services
6. **Regular security updates** for containers
7. **Enable logging and monitoring**

### Environment Variables:
- Never commit secrets to Git
- Use platform secret management
- Rotate credentials regularly
- Use least-privilege access

---

## Next Steps

1. **Choose your platform** based on requirements
2. **Create Dockerfiles** for each service
3. **Set up CI/CD** (GitHub Actions, etc.)
4. **Test in staging** environment first
5. **Deploy to production** with monitoring
6. **Set up backups** and disaster recovery

---

## Support

For platform-specific help:
- **Railway**: https://docs.railway.app
- **Render**: https://render.com/docs
- **AWS**: https://docs.aws.amazon.com
- **DigitalOcean**: https://docs.digitalocean.com

