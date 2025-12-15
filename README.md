# MQTT OT Network - Industrial Monitoring & AI Platform

A comprehensive industrial IoT platform for real-time monitoring, data visualization, and AI-powered maintenance recommendations for PLC-based manufacturing systems. Supports bottle filler and CNC lathe machines with MQTT pub/sub architecture, time-series data storage, and intelligent workflow automation.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OT Network (Operational Technology)              │
│                                                                           │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐          │
│  │ Mock PLC     │      │ CNC Lathe    │      │ Modbus      │          │
│  │ Agent        │      │ Simulator    │      │ Server      │          │
│  │ (Bottle      │      │              │      │             │          │
│  │  Filler)     │      │              │      │             │          │
│  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘          │
│         │                      │                     │                   │
│         └──────────────────────┼─────────────────────┘                   │
│                                 │                                         │
│                          ┌──────▼───────┐                                │
│                          │ MQTT Broker  │                                │
│                          │ (Mosquitto)  │                                │
│                          │ Port: 1883   │                                │
│                          │ Port: 9001   │                                │
│                          └──────┬───────┘                                │
└─────────────────────────────────┼─────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼─────────────────────────────────────────┐
│                         IT Network (Information Technology)               │
│                                  │                                         │
│                          ┌──────▼───────┐                                │
│                          │ InfluxDB     │                                │
│                          │ Writer       │                                │
│                          │ (Python)     │                                │
│                          └──────┬───────┘                                │
│                                  │                                         │
│                          ┌──────▼───────┐                                │
│                          │ InfluxDB 2.7 │                                │
│                          │ (Time-Series)│                                │
│                          │ Port: 8086   │                                │
│                          └──────┬───────┘                                │
│                                  │                                         │
│  ┌───────────────────────────────┼───────────────────────────────┐      │
│  │                               │                               │      │
│  ┌──────▼───────┐      ┌─────────▼────────┐      ┌──────────────▼──┐  │
│  │ Next.js      │      │ Alarm Monitor    │      │ Grafana         │  │
│  │ Frontend     │      │ (Real-time)      │      │ (Dashboards)    │  │
│  │ Port: 3005   │      │                  │      │ Port: 3003      │  │
│  └──────┬───────┘      └──────────────────┘      └──────────────────┘  │
│         │                                                               │
│  ┌──────▼──────────────────────────────────────────────────────────┐  │
│  │ AI Services                                                       │  │
│  │  - Pinecone (Vector DB) - RAG for maintenance docs              │  │
│  │  - OpenAI GPT - Chat interface & workflow automation            │  │
│  │  - LangGraph - Visual workflow builder                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Key Features

### Real-Time Monitoring & Data Collection
- **Live PLC Data Visualization**: Real-time charts, gauges, and status panels for production metrics
- **Multi-Machine Support**: Monitor multiple bottle filler (machine-01, machine-02, machine-03) and CNC lathe machines simultaneously
- **WebSocket Real-Time Updates**: Instant data updates via WebSocket connections (port 8765)
- **Tag Value Monitoring**: View all 18+ PLC tag values in real-time with automatic refresh
- **Production Metrics**: Track bottles filled, production rates, spindle speeds, and conveyor speeds
- **Status Indicators**: Monitor system running state, fault conditions, and ready states

### Time-Series Data & Analytics
- **InfluxDB Integration**: Historical data storage in InfluxDB 2.7 with configurable retention
- **Queryable Time Ranges**: Flexible time range queries (-5m, -1h, -24h, -7d, custom)
- **Historical Trend Analysis**: View production trends, alarm patterns, and performance over time
- **Data Export**: Export historical data for analysis and reporting
- **Flux Query Support**: Execute custom Flux queries for advanced analytics

### Alarm Management System
- **Real-Time Alarm Monitoring**: WebSocket-based alarm event detection and broadcasting
- **Alarm State Transitions**: Track alarm RAISED and CLEARED events with timestamps
- **Alarm Events History**: Complete chronological history of all alarm events
- **AI-Powered Alarm Analysis**: RAG-based recommendations for alarm response procedures
- **Alarm Threshold Detection**: Automatic work order generation when thresholds are breached
- **Multi-Alarm Support**: Monitor 5+ alarm types per machine (LowProductLevel, Overfill, Underfill, CapMissing, Fault, etc.)
- **Alarm Notifications**: Real-time popup notifications for critical alarms

### AI & Machine Learning Features
- **RAG-Powered Chat Assistant**: Context-aware chat using Retrieval-Augmented Generation
- **Pinecone Vector Database**: Semantic search across maintenance manuals and documentation
- **OpenAI GPT Integration**: Intelligent responses for alarm procedures and troubleshooting
- **Multi-Document RAG**: Access to Alarm Response Manual, Maintenance Work Order Manual, and Work Order History
- **Conversation History**: Maintains context across chat sessions with FIFO queue
- **AI Auto-Fill Work Orders**: Automatically populate work order details from maintenance manuals
- **Intelligent Workflow Automation**: LangGraph-based visual workflow builder

### Work Order Management
- **Automatic Work Order Generation**: Create work orders when alarm thresholds are exceeded
- **Calendar View**: Google Calendar-style interface with time slots and scheduling
- **List View**: Detailed list of all work orders with filtering and sorting
- **Work Order Details**: Complete information including task numbers, parts lists, materials, and procedures
- **Priority Management**: Automatic priority assignment based on alarm severity
- **Work Order History**: Track all generated work orders with status and completion information
- **Threshold-Based Triggers**: Configurable thresholds for automatic work order creation (e.g., 3-10 occurrences in 24h)

### Workflow Automation
- **Visual Workflow Builder**: Drag-and-drop interface for creating workflows
- **Node-Based Architecture**: Create workflows with agent, monitor, and action nodes
- **LangGraph Integration**: Execute complex multi-step workflows automatically
- **Workflow Scheduling**: Schedule workflows to run at specific times or intervals
- **Workflow Execution**: Real-time workflow execution with status tracking
- **Workflow Library**: Save and load reusable workflow templates

### Machine-Specific Features

#### Bottle Filler Machines
- **Production Counters**: Bottles filled, rejected, and bottles per minute
- **Tank Monitoring**: Fill level, temperature, pressure, and flow rate
- **Conveyor Control**: Speed monitoring and control
- **Filling Status**: Real-time filling state and valve positions
- **Cap Detection**: Monitor cap presence and capping operations

#### CNC Lathe Machines
- **Vibration Analysis**: Real-time vibration monitoring with anomaly detection
- **Spindle Monitoring**: Speed, load, and temperature tracking
- **Chuck Status**: Clamp detection and chuck position monitoring
- **Tool Management**: Tool wear detection and tool change operations
- **Coolant System**: Level, temperature, and flow monitoring
- **Door Safety**: Safety door interlock monitoring

### Downtime & Performance Analytics
- **Downtime Calculation**: Automatic detection and calculation of machine downtime
- **Uptime Percentage**: Real-time uptime/downtime statistics
- **Incident Tracking**: Count and duration of downtime incidents
- **Average Downtime**: Statistical analysis of downtime patterns
- **Downtime Periods**: Detailed breakdown of each downtime event with start/end times
- **Performance Metrics**: OEE (Overall Equipment Effectiveness) calculations

### Service Management
- **Service Control API**: Start/stop services via REST API
- **Service Status Monitoring**: Real-time status of all services (InfluxDB writer, mock PLC agents, alarm monitor)
- **Service Logs**: View logs for each service in real-time
- **Multi-Instance Support**: Run multiple instances of mock PLC agents for different machines
- **Health Checks**: Automatic health monitoring and status reporting

### Security & Network
- **OT/IT Network Separation**: Secure separation between operational and information technology networks
- **TLS Encryption**: MQTT over TLS (port 8883) for secure communication
- **MQTT Authentication**: Username/password authentication with ACL-based access control
- **Certificate Management**: TLS certificate generation and management
- **Firewall Configuration**: Production-ready firewall rules for network isolation
- **Secure API Keys**: Environment variable-based secure storage for API keys

### Visualization & Dashboards
- **Grafana Integration**: Pre-configured Grafana dashboards for advanced visualization
- **Custom Charts**: Recharts-based interactive charts and graphs
- **Real-Time Gauges**: Visual gauges for analog values (temperature, pressure, speed)
- **Status Panels**: Color-coded status indicators for system health
- **Time Series Charts**: Historical trend visualization with zoom and pan
- **Alarm History Charts**: Visual representation of alarm frequency and patterns

### Deployment & Infrastructure
- **Docker Compose**: Easy local development with docker-compose.yml
- **Production Deployment**: Production-ready docker-compose.production.yml
- **Cloud Deployment Options**: Support for AWS, Azure, GCP, Railway, Render, DigitalOcean, Fly.io, Replit
- **Multi-Environment Support**: Development, staging, and production configurations
- **Container Orchestration**: Ready for Kubernetes, ECS, and other orchestration platforms
- **Auto-Scaling**: Support for horizontal scaling of services

### API & Integration
- **RESTful API**: Comprehensive REST API for data access and service control
- **WebSocket API**: Real-time data streaming via WebSocket
- **InfluxDB API**: Direct InfluxDB query support
- **Modbus Support**: Modbus TCP server and client for PLC integration
- **MQTT Pub/Sub**: Full MQTT publish/subscribe support with multiple topics
- **API Documentation**: Complete API endpoint documentation

### Data Management
- **Multi-Bucket Support**: Organize data across multiple InfluxDB buckets
- **Tag-Based Organization**: Machine ID, line, and location tagging
- **Measurement Structure**: Optimized measurement structure for time-series data
- **Data Retention**: Configurable data retention policies
- **Backfill Support**: Tools for backfilling historical alarm events
- **Data Validation**: Automatic data validation and error handling

## 📋 Prerequisites

- **Docker & Docker Compose** - For running MQTT broker, InfluxDB, and Grafana
- **Python 3.7+** - For Python services (InfluxDB writer, mock PLC agents, alarm monitor)
- **Node.js 18+** - For Next.js frontend
- **npm or yarn** - Package manager for frontend dependencies

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/hamzakhan3/mqtt-ot-network.git
cd mqtt-ot-network
```

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Set Up Environment Variables

Create a `.env.local` file in the `frontend` directory:

```bash
cd frontend
cat > .env.local << EOF
# InfluxDB Configuration
NEXT_PUBLIC_INFLUXDB_URL=http://localhost:8086
NEXT_PUBLIC_INFLUXDB_TOKEN=my-super-secret-auth-token
NEXT_PUBLIC_INFLUXDB_ORG=myorg
NEXT_PUBLIC_INFLUXDB_BUCKET=plc_data

# Pinecone Configuration (for AI features)
NEXT_PUBLIC_PINECONE_API_KEY=your-pinecone-api-key
NEXT_PUBLIC_PINECONE_ENVIRONMENT=your-pinecone-environment
NEXT_PUBLIC_PINECONE_INDEX=your-index-name

# OpenAI Configuration (for AI features)
OPENAI_API_KEY=your-openai-api-key
EOF
```

## 🚦 Starting the Project

### Step 1: Start Docker Services

Start MQTT broker, InfluxDB, and Grafana:

```bash
docker-compose up -d
```

Verify services are running:
```bash
docker ps
```

You should see:
- `mqtt-broker` (ports 1883, 9001)
- `influxdb` (port 8086)
- `grafana` (port 3003)

### Step 2: Start InfluxDB Writer

The writer subscribes to MQTT and stores data in InfluxDB:

```bash
./start_influxdb_writer.sh
```

Or manually:
```bash
export MQTT_BROKER_HOST=localhost
export MQTT_BROKER_PORT=1883
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_TOKEN=my-super-secret-auth-token
export INFLUXDB_ORG=myorg
export INFLUXDB_BUCKET=plc_data

python3 influxdb_writer/influxdb_writer_production.py
```

### Step 3: Start Mock PLC Agents

**For Bottle Filler Machines:**

```bash
# Machine 01
./start_mock_plc.sh machine-01

# Machine 02 (in another terminal)
./start_mock_plc.sh machine-02

# Machine 03 (in another terminal)
./start_mock_plc.sh machine-03

# Or start all at once (macOS)
./start_all_machines.sh
```

**For CNC Lathe Machines:**

```bash
./start_lathe_sim.sh lathe01
```

### Step 4: Start Alarm Monitor (Optional)

For real-time alarm monitoring:

```bash
./start_alarm_monitor.sh
```

### Step 5: Start Frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:3005`

## 📁 Project Structure

```
mqtt-ot-network/
├── frontend/                    # Next.js frontend application
│   ├── app/                     # Next.js app router pages
│   │   ├── page.tsx            # Main dashboard
│   │   ├── chat/               # AI chat interface
│   │   ├── work-orders/        # Work order management
│   │   ├── alarm-events/       # Alarm events history
│   │   └── workflows/          # Visual workflow builder
│   ├── components/             # React components
│   ├── lib/                    # Utility libraries
│   └── hooks/                  # Custom React hooks
│
├── mock_plc_agent/            # Mock PLC agent (bottle filler)
├── lathe_sim/                  # CNC lathe simulator
├── influxdb_writer/            # MQTT to InfluxDB writer
├── alarm_monitor/             # Real-time alarm monitor
├── modbus_server/             # Modbus TCP server
├── modbus_reader/             # Modbus client
│
├── mosquitto/                  # MQTT broker configuration
├── influxdb/                   # InfluxDB data and config
├── grafana/                    # Grafana dashboards
│
├── docker-compose.yml          # Docker services configuration
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

## 🔧 Configuration

### InfluxDB Setup

Default credentials (change in production):
- **URL**: `http://localhost:8086`
- **Username**: `admin`
- **Password**: `admin123`
- **Organization**: `myorg`
- **Bucket**: `plc_data`
- **Token**: `my-super-secret-auth-token`

### MQTT Configuration

- **Port 1883**: Non-TLS MQTT (development)
- **Port 8883**: TLS MQTT (production)
- **Port 9001**: WebSocket

### Frontend Ports

- **Next.js**: `3005`
- **Grafana**: `3003`
- **InfluxDB**: `8086`

## 🎯 Usage

### Main Dashboard

Access the main dashboard at `http://localhost:3005`:

- **Service Controls**: Start/stop InfluxDB writer and mock PLC agents with real-time status
- **Machine Selection**: Switch between bottle filler and CNC lathe machines via dropdown
- **Real-time Charts**: Interactive charts for production rates, spindle speed, vibration data, and more
- **Alarm Events Panel**: Real-time alarm monitoring with WebSocket updates and AI-powered recommendations
- **Tag Values Table**: Complete view of all PLC tag values with automatic refresh
- **Status Panels**: Visual indicators for system running, faults, and ready states
- **Production Metrics**: Live counters for bottles filled, production rates, and efficiency
- **Tank Status**: Real-time monitoring of fill levels, temperature, and pressure
- **Downtime Statistics**: View uptime percentage, downtime incidents, and average downtime duration

### Alarm Events Page (`/alarm-events`)

- **Real-Time Alarm Stream**: Live WebSocket feed of all alarm events (RAISED/CLEARED)
- **Alarm History**: Chronological list of all alarm events with timestamps
- **Alarm Filtering**: Filter by machine ID, alarm type, or state
- **AI Recommendations**: Click any alarm to get AI-powered response procedures
- **Alarm Statistics**: View alarm frequency, patterns, and trends
- **Popup Notifications**: Browser notifications for critical alarms

### Work Orders Page (`/work-orders`)

- **Generate Work Orders**: Automatically create work orders when alarm thresholds are exceeded
- **Calendar View**: Google Calendar-style interface with time slots, drag-and-drop scheduling
- **List View**: Detailed table of all work orders with filtering, sorting, and search
- **Work Order Details**: Complete information including:
  - Task numbers and frequencies
  - Parts lists with stock locations
  - Materials and quantities
  - Standard and overtime hours
  - Special instructions
  - Priority levels
- **AI Auto-Fill**: Automatically populate work order details from maintenance manuals using RAG
- **Threshold Management**: Configure alarm thresholds for automatic work order generation
- **Work Order History**: Track all work orders with status, completion, and history

### AI Chat Interface (`/chat`)

- **Ask Questions**: Get intelligent answers about alarm procedures, troubleshooting, and maintenance
- **Context-Aware Responses**: Maintains conversation history for coherent multi-turn conversations
- **RAG-Powered**: Retrieves relevant information from:
  - Alarm Response Manual (alarm procedures and troubleshooting)
  - Maintenance Work Order Manual (parts, materials, procedures)
  - Work Order History (existing work orders and status)
- **Multi-Document Search**: Automatically determines which knowledge base to query
- **Conversation History**: FIFO queue maintains last 10 messages for context
- **Machine-Specific Answers**: Specify machine type for targeted responses

### Workflows Page (`/workflows`)

- **Visual Workflow Builder**: Drag-and-drop interface for creating automation workflows
- **Node Types**: 
  - Agent nodes (AI-powered decision making)
  - Monitor nodes (data monitoring and triggers)
  - Action nodes (automated actions)
- **Workflow Execution**: Real-time execution with status tracking
- **Workflow Scheduling**: Schedule workflows to run at specific times or intervals
- **Workflow Library**: Save, load, and share workflow templates
- **LangGraph Integration**: Execute complex multi-step workflows automatically
- **Workflow History**: Track execution history and results

### API Endpoints

#### Data Endpoints
- `GET /api/influxdb/latest` - Get latest tag values for a machine
- `GET /api/influxdb/downtime` - Calculate downtime statistics
- `GET /api/influxdb/vibration` - Get vibration data for CNC lathe
- `POST /api/influxdb/query` - Execute custom Flux queries

#### Alarm Endpoints
- `GET /api/alarm-events` - Get alarm events history
- `POST /api/alarms/rag` - Get AI-powered alarm response recommendations

#### Work Order Endpoints
- `GET /api/work-orders` - List all work orders
- `POST /api/work-order` - Create new work order
- `GET /api/work-orders/[workOrderNo]` - Get specific work order
- `POST /api/work-order/autofill` - AI auto-fill work order details
- `POST /api/work-order/pinecone-fill` - Fill from Pinecone vector database

#### Service Control Endpoints
- `GET /api/services/status` - Check service status
- `POST /api/services/start` - Start a service
- `POST /api/services/stop` - Stop a service
- `GET /api/services/logs` - Get service logs

#### Workflow Endpoints
- `GET /api/workflows/list` - List all workflows
- `POST /api/workflows/save` - Save a workflow
- `POST /api/workflows/load` - Load a workflow
- `POST /api/workflows/execute` - Execute a workflow
- `POST /api/workflows/scheduler/init` - Initialize workflow scheduler

## 🔐 Security Notes

⚠️ **For Production Deployment:**

1. **Change Default Passwords**: Update InfluxDB and Grafana default credentials
2. **Enable MQTT Authentication**: Configure username/password in Mosquitto
3. **Use TLS**: Enable TLS on MQTT port 8883
4. **Secure API Keys**: Store Pinecone and OpenAI keys securely (use environment variables)
5. **Network Isolation**: Deploy OT and IT networks separately

## 🧪 Testing

### Verify MQTT Connection

```bash
# Subscribe to MQTT topics
mosquitto_sub -h localhost -t "plc/+/bottlefiller/data" -v
```

### Check InfluxDB Data

```bash
python3 check_influxdb_data.py
```

### Test API Endpoints

```bash
# Test latest data endpoint
python3 test_api_latest.py machine-01

# Test work orders API
curl http://localhost:3005/api/work-orders
```

## 🐛 Troubleshooting

### MQTT Connection Issues

- **Check broker is running**: `docker ps | grep mqtt`
- **Verify port**: Should be 1883 (dev) or 8883 (prod)
- **Check network**: Ensure services are on the same Docker network

### No Data in Frontend

- **Click Refresh**: Use the refresh button on the dashboard
- **Check InfluxDB writer**: Ensure it's running and connected
- **Verify bucket name**: Should match configuration
- **Check browser console**: Look for API errors

### Frontend Not Loading

- **Check Node.js version**: Requires Node.js 18+
- **Reinstall dependencies**: `cd frontend && rm -rf node_modules && npm install`
- **Check port 3005**: Ensure it's not in use

## ☁️ Deployment Options

The platform supports multiple deployment options for different use cases:

### Local Development
- **Docker Compose**: Quick setup with `docker-compose up -d`
- **Manual Services**: Run services individually for debugging

### Cloud Deployment
- **Railway.app**: ⭐ Easiest - All-in-one platform with Git integration
- **Render.com**: Good balance of features and simplicity
- **AWS**: Enterprise-grade with ECS, IoT Core, and InfluxDB Cloud
- **Azure**: Microsoft cloud with IoT Hub and Time Series Insights
- **Google Cloud**: GCP with Cloud Run and InfluxDB Cloud
- **DigitalOcean**: Cost-effective with App Platform or Droplets
- **Fly.io**: Global edge deployment for low latency
- **Replit**: Quick prototyping and development

### Production Deployment
- **OT/IT Network Separation**: Secure network isolation
- **TLS Encryption**: MQTT over TLS (port 8883)
- **Authentication**: MQTT username/password with ACL
- **Container Orchestration**: Kubernetes, ECS, or Docker Swarm ready
- **Auto-Scaling**: Horizontal scaling support for high availability

See [Cloud Deployment Guide](./CLOUD_DEPLOYMENT.md) for detailed instructions.

## 📚 Additional Documentation

### Getting Started
- [Quick Start Guide](./QUICK_START.md) - Fast setup instructions
- [Start Steps](./START_STEPS.md) - Detailed startup sequence
- [Production Quick Start](./PRODUCTION-QUICKSTART.md) - Production deployment

### Architecture & Design
- [Architecture Details](./ARCHITECTURE_DETAILED.md) - Complete system architecture
- [Data Write Flow](./DATA_WRITE_FLOW.md) - How data flows through the system
- [Workflow Execution Flow](./WORKFLOW_EXECUTION_FLOW.md) - Workflow automation details

### Features & Functionality
- [API Endpoints](./API_ENDPOINTS.md) - Complete API reference
- [Work Orders Documentation](./MAINTENANCE_WORK_ORDERS.md) - Work order procedures and parts
- [Alarm Mocking Flow](./ALARM_MOCKING_FLOW.md) - How alarms are generated and processed
- [Downtime Calculation](./DOWNTIME_CALCULATION.md) - Downtime detection and statistics
- [WebSocket Verification](./WEBSOCKET_VERIFICATION.md) - Real-time WebSocket setup

### AI & RAG Setup
- [Chat Setup](./CHAT_SETUP.md) - AI chat interface configuration
- [RAG Setup](./RAG_SETUP.md) - Retrieval-Augmented Generation configuration
- [Deployment Pinecone](./DEPLOYMENT_PINECONE.md) - Pinecone vector database setup

### Data & Queries
- [InfluxDB Query Guide](./INFLUXDB_QUERY_GUIDE.md) - Query examples and patterns
- [InfluxDB Web UI Guide](./INFLUXDB_WEB_UI_GUIDE.md) - Using InfluxDB interface
- [Grafana Queries](./GRAFANA_QUERIES.md) - Grafana dashboard queries
- [Console Query Guide](./CONSOLE_QUERY_GUIDE.md) - Browser console query examples
- [Tags Documentation](./TAGS_DOCUMENTATION.md) - PLC tag reference
- [Bucket vs Measurement](./BUCKET_VS_MEASUREMENT.md) - Data organization guide

### Deployment Guides
- [Cloud Deployment](./CLOUD_DEPLOYMENT.md) - Multi-cloud deployment options
- [Quick Cloud Deploy](./QUICK_CLOUD_DEPLOY.md) - Fastest deployment methods
- [Railway Deployment](./RAILWAY_DEPLOYMENT.md) - Railway.app specific guide
- [Railway Quick Start](./RAILWAY_QUICK_START.md) - Quick Railway setup
- [Replit Deployment](./REPLIT_DEPLOYMENT.md) - Replit deployment guide
- [Replit Quick Start](./REPLIT_QUICK_START.md) - Quick Replit setup
- [AWS EC2 Deployment](./AWS_EC2_DEPLOYMENT.md) - AWS EC2 deployment
- [Production Deployment](./PRODUCTION-DEPLOYMENT.md) - Production setup guide
- [Deploy Now](./DEPLOY_NOW.md) - Immediate deployment steps

### Machine-Specific
- [Lathe Implementation](./LATHE_IMPLEMENTATION.md) - CNC lathe machine details
- [Lathe Sim README](./LATHE_SIM_README.md) - Lathe simulator documentation

## 🤝 Contributing

This project is actively maintained. For issues or questions, please check the documentation or open an issue on GitHub.

## 📄 License

This project is provided as-is for educational and development purposes.

## 🏭 Supported Machine Types

### Bottle Filler Machines
- **Machine IDs**: machine-01, machine-02, machine-03 (configurable)
- **Data Points**: 18+ PLC tags including status, counters, alarms, analog values, inputs, outputs
- **Alarms**: LowProductLevel, Overfill, Underfill, CapMissing, Fault
- **Metrics**: Bottles filled, production rate, fill level, temperature, pressure, flow rate
- **Controls**: Fill valve, conveyor motor, capping motor, indicator lights

### CNC Lathe Machines
- **Machine IDs**: lathe01, lathe02, etc. (configurable)
- **Data Points**: Spindle speed, vibration, chuck status, tool wear, coolant level, door status
- **Alarms**: SpindleOverload, ChuckNotClamped, DoorOpen, ToolWear, CoolantLow
- **Metrics**: Vibration analysis, spindle load, tool life, coolant temperature
- **Safety**: Door interlock, chuck clamp detection, emergency stop monitoring

### Modbus Integration
- **Modbus TCP Server**: Simulate PLC devices via Modbus protocol
- **Modbus Reader**: Read data from real Modbus devices
- **Edge Gateway**: Bridge between Modbus and MQTT for legacy PLC integration

## 🔗 Service URLs & Access

### Development Environment
- **Frontend Dashboard**: `http://localhost:3005`
- **InfluxDB UI**: `http://localhost:8086` (admin/admin123)
- **Grafana**: `http://localhost:3003` (admin/admin)
- **MQTT Broker**: `localhost:1883` (dev) or `localhost:8883` (TLS)
- **WebSocket Alarm Monitor**: `ws://localhost:8765`

### Production Environment
- **Frontend Dashboard**: Configured via deployment platform
- **InfluxDB**: Configured via deployment platform
- **Grafana**: Configured via deployment platform
- **MQTT Broker**: Port 8883 (TLS encrypted)
- **WebSocket**: Configured via deployment platform

### Default Credentials (Change in Production!)
- **InfluxDB**: Username: `admin`, Password: `admin123`, Token: `my-super-secret-auth-token`
- **Grafana**: Username: `admin`, Password: `admin`
- **MQTT**: Username: `edge_gateway`, Password: `edge_gateway_pass` (publisher)
- **MQTT**: Username: `influxdb_writer`, Password: `influxdb_writer_pass` (subscriber)

---

## 🎓 Learning Resources

### For Developers
- Explore the codebase structure in `frontend/`, `mock_plc_agent/`, `influxdb_writer/`
- Check out test scripts in the root directory for API testing
- Review component structure in `frontend/components/`
- Study API routes in `frontend/app/api/`

### For Operators
- Use the dashboard for daily monitoring
- Set up alarm thresholds for automatic work order generation
- Configure workflows for automated processes
- Review alarm history for pattern analysis

### For System Administrators
- Review security configuration in `mosquitto/config/`
- Set up production deployment following production guides
- Configure network isolation for OT/IT separation
- Set up monitoring and alerting

## 🔄 Recent Updates

- ✅ Comprehensive feature documentation
- ✅ Multi-machine support (bottle filler and CNC lathe)
- ✅ AI-powered chat with RAG
- ✅ Workflow automation with LangGraph
- ✅ Real-time WebSocket alarm monitoring
- ✅ Downtime calculation and analytics
- ✅ Vibration analysis for CNC lathe
- ✅ Multiple cloud deployment options
- ✅ Production-ready security configuration

---

**Last Updated**: 2025-01-28  
**Version**: 2.0  
**Maintainer**: Active Development
