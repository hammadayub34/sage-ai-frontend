# AWS EC2 Deployment Guide

This guide walks you through deploying the MQTT OT Network application to AWS EC2 using Docker and GitHub Actions for automated deployments.

## 📋 Prerequisites

1. **AWS Account** with EC2 access
2. **EC2 Instance** running (Amazon Linux 2 or Ubuntu 20.04+)
3. **Security Group** configured with required ports
4. **GitHub Repository** with Actions enabled
5. **AWS IAM User** with ECR and EC2 permissions

---

## 🚀 Step 1: Launch EC2 Instance

### Instance Configuration:
- **AMI**: Amazon Linux 2 AMI or Ubuntu 20.04 LTS
- **Instance Type**: `t3.medium` (minimum) or larger
  - For production: `t3.large` or `m5.large` recommended
- **Storage**: 20GB+ (SSD)
- **Security Group**: Configure the following ports:

| Port | Protocol | Source | Description |
|------|----------|--------|-------------|
| 22 | TCP | Your IP | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP (if using reverse proxy) |
| 443 | TCP | 0.0.0.0/0 | HTTPS (if using reverse proxy) |
| 1883 | TCP | 0.0.0.0/0 | MQTT |
| 8086 | TCP | 0.0.0.0/0 | InfluxDB |
| 3005 | TCP | 0.0.0.0/0 | Frontend |

### Launch Steps:
1. Go to AWS Console → EC2 → Launch Instance
2. Select Amazon Linux 2 or Ubuntu
3. Choose instance type (t3.medium minimum)
4. Configure security group with ports above
5. Create/select key pair for SSH access
6. Launch instance

---

## 🔧 Step 2: Initial EC2 Setup

### Connect to your EC2 instance:

```bash
ssh -i your-key.pem ec2-user@your-ec2-public-ip
# For Ubuntu, use: ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

### Run the setup script:

```bash
# Clone the repository first
git clone <your-repo-url> mqtt-ot-network
cd mqtt-ot-network

# Make setup script executable
chmod +x scripts/setup-ec2.sh

# Run setup
./scripts/setup-ec2.sh
```

This will install:
- Docker
- Docker Compose
- Git
- AWS CLI

### Create environment file:

```bash
# Copy example file
cp .env.example .env

# Edit with your values
nano .env
```

**Important variables to set:**
- `MQTT_BROKER_HOST`: Your MQTT broker hostname/IP
- `INFLUXDB_TOKEN`: Generate a secure token
- `NEXT_PUBLIC_INFLUXDB_URL`: Use your EC2 public IP
- `PINECONE_API_KEY`: If using Pinecone
- `OPENAI_API_KEY`: If using OpenAI

---

## ☁️ Step 3: Configure AWS ECR

### Create ECR Repositories:

```bash
# Set your AWS region
export AWS_REGION=us-east-1

# Create repositories
aws ecr create-repository --repository-name mqtt-ot-network/influxdb-writer --region $AWS_REGION
aws ecr create-repository --repository-name mqtt-ot-network/mock-plc --region $AWS_REGION
aws ecr create-repository --repository-name mqtt-ot-network/frontend --region $AWS_REGION
```

### Get ECR Login Command:

```bash
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin <account-id>.dkr.ecr.$AWS_REGION.amazonaws.com
```

---

## 🔐 Step 4: Configure GitHub Secrets

Go to your GitHub repository: **Settings → Secrets and variables → Actions**

Add the following secrets:

| Secret Name | Description | Example |
|------------|------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS IAM user access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM user secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `EC2_HOST` | EC2 public IP or domain | `54.123.45.67` or `app.example.com` |
| `EC2_USERNAME` | EC2 SSH username | `ec2-user` (Amazon Linux) or `ubuntu` (Ubuntu) |
| `EC2_SSH_KEY` | Private SSH key content | Full content of your `.pem` file |

### How to get AWS credentials:

1. Go to AWS Console → IAM → Users
2. Create a new user or select existing
3. Attach policies:
   - `AmazonEC2ContainerRegistryFullAccess` (for ECR)
   - `AmazonEC2FullAccess` (optional, for EC2 management)
4. Create access key → Download credentials

### How to add SSH key to GitHub:

```bash
# Copy your private key content
cat your-key.pem
# Copy the entire output and paste into GitHub secret EC2_SSH_KEY
```

---

## 🚢 Step 5: Initial Manual Deployment

Before automated deployments work, do an initial manual deployment:

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Navigate to app directory
cd /home/ec2-user/mqtt-ot-network  # or /home/ubuntu/mqtt-ot-network for Ubuntu

# Pull latest code
git pull origin main

# Start services
docker-compose -f docker-compose.cloud.yml up -d

# Check status
docker-compose -f docker-compose.cloud.yml ps

# View logs
docker-compose -f docker-compose.cloud.yml logs -f
```

### Verify services are running:

```bash
# Check containers
docker ps

# Test InfluxDB
curl http://localhost:8086/health

# Test Frontend (from your browser)
http://your-ec2-ip:3005
```

---

## 🔄 Step 6: Automated Deployments

Once everything is set up, **every push to `main` branch** will automatically:

1. ✅ Build Docker images
2. ✅ Push images to AWS ECR
3. ✅ SSH into EC2
4. ✅ Pull latest code
5. ✅ Restart containers with new images

### Manual deployment trigger:

You can also trigger deployments manually:
- Go to GitHub → Actions → "Deploy to AWS EC2" → Run workflow

---

## 🛠️ Troubleshooting

### Check service logs:

```bash
# All services
docker-compose -f docker-compose.cloud.yml logs -f

# Specific service
docker-compose -f docker-compose.cloud.yml logs -f influxdb-writer
docker-compose -f docker-compose.cloud.yml logs -f frontend
```

### Restart services:

```bash
docker-compose -f docker-compose.cloud.yml restart
```

### Stop all services:

```bash
docker-compose -f docker-compose.cloud.yml down
```

### View running containers:

```bash
docker ps
docker-compose -f docker-compose.cloud.yml ps
```

### Check GitHub Actions logs:

1. Go to GitHub → Actions
2. Click on the latest workflow run
3. Check each step for errors

### Common issues:

**Issue**: "Permission denied" when SSHing
- **Fix**: Ensure your SSH key has correct permissions: `chmod 400 your-key.pem`

**Issue**: "Cannot connect to Docker daemon"
- **Fix**: Add user to docker group: `sudo usermod -aG docker $USER` (then logout/login)

**Issue**: "ECR login failed"
- **Fix**: Check AWS credentials in GitHub secrets, ensure IAM user has ECR permissions

**Issue**: "Port already in use"
- **Fix**: Stop existing containers: `docker-compose down` or change ports in `docker-compose.cloud.yml`

**Issue**: "Environment variables not working"
- **Fix**: Ensure `.env` file exists and has correct values, restart containers after changes

---

## 📊 Monitoring

### View resource usage:

```bash
# Docker stats
docker stats

# Disk usage
df -h

# Memory usage
free -h
```

### Set up CloudWatch monitoring (optional):

1. Install CloudWatch agent on EC2
2. Configure metrics collection
3. Set up alarms for CPU, memory, disk

---

## 🔒 Security Best Practices

1. **Use HTTPS**: Set up reverse proxy (Nginx/Traefik) with SSL certificate
2. **Restrict Security Groups**: Only open necessary ports
3. **Rotate Credentials**: Regularly update passwords and tokens
4. **Use IAM Roles**: Instead of access keys when possible
5. **Enable MQTT TLS**: Set `MQTT_TLS_ENABLED=true` in production
6. **Backup Data**: Regularly backup InfluxDB data volumes
7. **Monitor Logs**: Set up log aggregation (CloudWatch, ELK, etc.)

---

## 💰 Cost Estimation

**EC2 Instance (t3.medium):**
- ~$30/month (on-demand)
- ~$15/month (reserved 1-year)

**ECR Storage:**
- ~$0.10/GB/month (first 500GB free)

**Data Transfer:**
- First 100GB free, then ~$0.09/GB

**Total Estimated Cost:**
- Small scale: ~$30-50/month
- Medium scale: ~$50-100/month

---

## 📝 Next Steps

1. ✅ Set up domain name and DNS
2. ✅ Configure SSL certificate (Let's Encrypt)
3. ✅ Set up reverse proxy (Nginx)
4. ✅ Configure automated backups
5. ✅ Set up monitoring and alerts
6. ✅ Scale horizontally (multiple instances) if needed

---

## 🆘 Support

If you encounter issues:
1. Check GitHub Actions logs
2. Check Docker container logs
3. Verify all environment variables are set
4. Ensure security groups allow required ports
5. Check EC2 instance status in AWS Console

---

**Happy Deploying! 🚀**

