#!/bin/bash
# EC2 Setup Script for MQTT OT Network

set -e

echo "🚀 Setting up EC2 instance for MQTT OT Network..."

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ Cannot detect OS"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
if [ "$OS" = "amzn" ] || [ "$OS" = "rhel" ] || [ "$OS" = "centos" ]; then
    sudo yum update -y
    sudo yum install -y git
elif [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    sudo apt-get update -y
    sudo apt-get install -y git
fi

# Install Docker
echo "🐳 Installing Docker..."
if [ "$OS" = "amzn" ] || [ "$OS" = "rhel" ] || [ "$OS" = "centos" ]; then
    sudo yum install -y docker
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker ec2-user
elif [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    sudo apt-get install -y docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker ubuntu
fi

# Install Docker Compose
echo "🔧 Installing Docker Compose..."
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install AWS CLI (for ECR login)
echo "☁️  Installing AWS CLI..."
if [ "$OS" = "amzn" ] || [ "$OS" = "rhel" ] || [ "$OS" = "centos" ]; then
    sudo yum install -y aws-cli
elif [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    sudo apt-get install -y awscli
fi

# Create app directory
APP_DIR="/home/ec2-user/mqtt-ot-network"
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    APP_DIR="/home/ubuntu/mqtt-ot-network"
fi

mkdir -p $APP_DIR

echo ""
echo "✅ Setup complete!"
echo ""
echo "📁 Directory created: $APP_DIR"
echo ""
echo "Next steps:"
echo "1. Clone your repository:"
echo "   cd $APP_DIR"
echo "   git clone <your-repo-url> ."
echo ""
echo "2. Create .env file with environment variables:"
echo "   cp .env.example .env"
echo "   nano .env  # Edit with your values"
echo ""
echo "3. Run:"
echo "   docker-compose -f docker-compose.cloud.yml up -d"
echo ""
echo "4. Check status:"
echo "   docker-compose -f docker-compose.cloud.yml ps"
echo ""

