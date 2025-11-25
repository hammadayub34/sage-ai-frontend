# Complete System Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Details](#component-details)
4. [Network Configuration](#network-configuration)
5. [Data Structure](#data-structure)
6. [Security](#security)
7. [API Endpoints](#api-endpoints)
8. [Data Flow](#data-flow)
9. [File Structure](#file-structure)
10. [Dependencies](#dependencies)
11. [Configuration](#configuration)
12. [Deployment](#deployment)

---

## System Overview

**Purpose**: Real-time monitoring and historical storage of PLC (Programmable Logic Controller) data from bottle filler machines using MQTT pub/sub architecture with OT/IT network separation.

**Architecture Type**: Event-driven, pub/sub, microservices

**Key Features**:
- Multi-machine support (machine-01, machine-02, machine-03)
- Real-time data visualization
- Historical time-series data storage
- Secure TLS-encrypted MQTT communication
- RESTful API for data access
- Web-based dashboard (Next.js frontend)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OT NETWORK                                   │
│                    (Operational Technology)                          │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Mock PLC Agent (Python)                                      │  │
│  │  ────────────────────────────────────────────────────────────  │  │
│  │  - Simulates bottle filler PLC                                │  │
│  │  - Publishes every 2 seconds                                  │  │
│  │  - Topics: plc/{machine-id}/bottlefiller/data                 │  │
│  │  - MQTT Client ID: mock_plc_{machine-id}_{uuid}              │  │
│  │  - Port: N/A (client, connects to broker)                    │  │
│  │  - Protocol: MQTT over TLS (port 8883)                      │  │
│  │  - Authentication: Username/Password                        │  │
│  │  - Files: mock_plc_agent/mock_plc_agent.py                   │  │
│  └───────────────────────┬──────────────────────────────────────┘  │
│                          │                                          │
│                          │ MQTT Publish (TLS)                      │
│                          │ Topic: plc/+/bottlefiller/data         │
│                          │                                          │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           │ Firewall: Allow OUTBOUND 8883
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                         IT NETWORK                                    │
│                    (Information Technology)                          │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  MQTT Broker (Mosquitto - Docker)                            │  │
│  │  ────────────────────────────────────────────────────────────  │  │
│  │  - Container: mqtt-broker-production                          │  │
│  │  - Image: eclipse-mosquitto:latest                            │  │
│  │  - Port: 8883 (MQTT over TLS)                                 │  │
│  │  - Port: 1883 (MQTT plain - dev only)                        │  │
│  │  - Port: 9001 (WebSocket)                                     │  │
│  │  - Authentication: Required (username/password)              │  │
│  │  - TLS: Enabled (CA cert, server cert, server key)           │  │
│  │  - ACL: Topic-based access control                           │  │
│  │  - Config: mosquitto/config/mosquitto.production.conf        │  │
│  │  - Network: ot-network (Docker)                              │  │
│  └───────────────────────┬──────────────────────────────────────┘  │
│                          │                                          │
│                          │ MQTT Subscribe                          │
│                          │                                          │
│  ┌───────────────────────▼──────────────────────────────────────┐  │
│  │  InfluxDB Writer (Python)                                    │  │
│  │  ────────────────────────────────────────────────────────────  │  │
│  │  - Subscribes to: plc/+/bottlefiller/data                    │  │
│  │  - MQTT Client ID: influxdb_writer_it_{uuid}                │  │
│  │  - Extracts 18 critical tags                                  │  │
│  │  - Writes to InfluxDB with machine_id tag                    │  │
│  │  - Protocol: MQTT over TLS (port 8883)                      │  │
│  │  - Files: influxdb_writer/influxdb_writer_production.py     │  │
│  │  - Logs: /tmp/influxdb_writer.log                            │  │
│  └───────────────────────┬──────────────────────────────────────┘  │
│                          │                                          │
│                          │ Write API (HTTP)                        │
│                          │                                          │
│  ┌───────────────────────▼──────────────────────────────────────┐  │
│  │  InfluxDB (Time-Series Database - Docker)                    │  │
│  │  ────────────────────────────────────────────────────────────  │  │
│  │  - Container: influxdb                                       │  │
│  │  - Image: influxdb:2.7                                       │  │
│  │  - Port: 8086 (HTTP API)                                     │  │
│  │  - Organization: myorg                                       │  │
│  │  - Bucket: plc_data_new                                      │  │
│  │  - Token: my-super-secret-auth-token                         │  │
│  │  - Username: admin                                           │  │
│  │  - Password: admin123                                        │  │
│  │  - Measurement: plc_data                                    │  │
│  │  - Tags: machine_id, line, location (optional)              │  │
│  │  - Fields: 18 PLC tags (see Data Structure)                 │  │
│  │  - Network: ot-network (Docker)                             │  │
│  │  - Data Retention: Configurable                              │  │
│  └───────────────────────┬──────────────────────────────────────┘  │
│                          │                                          │
│                          │ Query API (HTTP)                        │
│                          │                                          │
│  ┌───────────────────────▼──────────────────────────────────────┐  │
│  │  Next.js Frontend (TypeScript)                            │  │
│  │  ────────────────────────────────────────────────────────────  │  │
│  │  - Port: 3005 (Development)                                  │  │
│  │  - Framework: Next.js 14                                     │  │
│  │  - Language: TypeScript                                      │  │
│  │  - Styling: Tailwind CSS                                     │  │
│  │  - Charts: Recharts                                          │  │
│  │  - Data Fetching: React Query (TanStack Query)              │  │
│  │  - API Routes: /api/influxdb/*, /api/services/*             │  │
│  │  - Files: frontend/app/*, frontend/components/*              │  │
│  │  - Build: npm run build                                      │  │
│  └───────────────────────┬──────────────────────────────────────┘  │
│                          │                                          │
│                          │ Query (via API routes)                  │
│                          │                                          │
│  ┌───────────────────────▼──────────────────────────────────────┐  │
│  │  Grafana (Visualization - Docker, Optional)                  │  │
│  │  ────────────────────────────────────────────────────────────  │  │
│  │  - Container: grafana                                        │  │
│  │  - Image: grafana/grafana:latest                              │  │
│  │  - Port: 3003 (Web UI)                                        │  │
│  │  - Username: admin                                            │  │
│  │  - Password: admin                                            │  │
│  │  - Datasource: InfluxDB (auto-provisioned)                    │  │
│  │  - Network: ot-network (Docker)                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Mock PLC Agent

**Location**: `mock_plc_agent/mock_plc_agent.py`

**Purpose**: Simulates bottle filler PLC data and publishes to MQTT

**Configuration**:
- `MACHINE_ID`: Machine identifier (default: "machine-01")
- `MQTT_BROKER_HOST`: Broker hostname (default: "localhost")
- `MQTT_BROKER_PORT`: Broker port (default: 8883 for TLS)
- `MQTT_USERNAME`: MQTT username (default: "edge_gateway")
- `MQTT_PASSWORD`: MQTT password (default: "edge_gateway_pass")
- `MQTT_TLS_ENABLED`: Enable TLS (default: "true")
- `CA_CERT_PATH`: Path to CA certificate (default: "mosquitto/config/certs/ca.crt")
- `PUBLISH_INTERVAL`: Publish frequency in seconds (default: 2)

**MQTT Topics Published**:
- `plc/{MACHINE_ID}/bottlefiller/data` - Complete dataset (main topic)
- `plc/{MACHINE_ID}/bottlefiller/inputs` - Input tags only
- `plc/{MACHINE_ID}/bottlefiller/outputs` - Output tags only
- `plc/{MACHINE_ID}/bottlefiller/analog` - Analog values only
- `plc/{MACHINE_ID}/bottlefiller/status` - Status flags only
- `plc/{MACHINE_ID}/bottlefiller/counters` - Counter values only
- `plc/{MACHINE_ID}/bottlefiller/alarms` - Alarm states only

**MQTT Client ID**: `mock_plc_{MACHINE_ID}_{uuid}` (unique per instance)

**Data Format**: JSON with UTC timestamps

**Start Script**: `start_mock_plc.sh {machine-id}`

---

### 2. MQTT Broker (Mosquitto)

**Location**: Docker container (`mqtt-broker-production`)

**Image**: `eclipse-mosquitto:latest`

**Ports**:
- `8883`: MQTT over TLS (production)
- `1883`: MQTT plain (development only)
- `9001`: WebSocket

**Configuration Files**:
- `mosquitto/config/mosquitto.production.conf` - Production config
- `mosquitto/config/passwd` - User passwords
- `mosquitto/config/acl` - Access Control List
- `mosquitto/config/certs/` - TLS certificates

**TLS Certificates**:
- `ca.crt` - Certificate Authority
- `server.crt` - Server certificate
- `server.key` - Server private key
- `client.crt` - Client certificate (for edge gateway)
- `client.key` - Client private key

**Users** (configured in `passwd`):
- `edge_gateway` / `edge_gateway_pass` - For PLC agents
- `influxdb_writer` / `influxdb_writer_pass` - For InfluxDB writer
- `admin` / `admin_pass` - For administration

**ACL Rules** (in `acl`):
- `edge_gateway`: Read/Write `plc/+/bottlefiller/#`
- `influxdb_writer`: Read `plc/+/bottlefiller/#`
- `admin`: Read/Write `#` (all topics)

**Network**: `ot-network` (Docker bridge network)

---

### 3. InfluxDB Writer

**Location**: `influxdb_writer/influxdb_writer_production.py`

**Purpose**: Subscribes to MQTT and writes time-series data to InfluxDB

**Configuration**:
- `MQTT_BROKER_HOST`: Broker hostname (default: "localhost")
- `MQTT_BROKER_PORT`: Broker port (default: 8883)
- `MQTT_TOPIC`: Subscription topic (default: "plc/+/bottlefiller/data")
- `MQTT_USERNAME`: MQTT username (default: "influxdb_writer")
- `MQTT_PASSWORD`: MQTT password (default: "influxdb_writer_pass")
- `MQTT_TLS_ENABLED`: Enable TLS (default: "true")
- `CA_CERT_PATH`: Path to CA certificate
- `INFLUXDB_URL`: InfluxDB API URL (default: "http://localhost:8086")
- `INFLUXDB_TOKEN`: InfluxDB auth token
- `INFLUXDB_ORG`: InfluxDB organization (default: "myorg")
- `INFLUXDB_BUCKET`: InfluxDB bucket (default: "plc_data_new")

**MQTT Client ID**: `influxdb_writer_it_{uuid}` (unique per instance)

**Data Processing**:
- Extracts `machine_id` from MQTT topic: `plc/{machine-id}/bottlefiller/data`
- Parses JSON payload
- Extracts 18 critical tags (see Data Structure)
- Creates InfluxDB Point with:
  - Measurement: `plc_data`
  - Tags: `machine_id`, `line` (optional), `location` (optional)
  - Fields: All 18 PLC tags
  - Timestamp: UTC (from message or current time)

**Start Script**: `start_influxdb_writer.sh`

**Logs**: `/tmp/influxdb_writer.log`

---

### 4. InfluxDB

**Location**: Docker container (`influxdb`)

**Image**: `influxdb:2.7`

**Port**: `8086` (HTTP API)

**Initial Setup** (environment variables):
- `DOCKER_INFLUXDB_INIT_MODE=setup`
- `DOCKER_INFLUXDB_INIT_USERNAME=admin`
- `DOCKER_INFLUXDB_INIT_PASSWORD=admin123`
- `DOCKER_INFLUXDB_INIT_ORG=myorg`
- `DOCKER_INFLUXDB_INIT_BUCKET=plc_data` (initial bucket)
- `DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=my-super-secret-auth-token`

**Current Bucket**: `plc_data_new` (created manually)

**Measurement**: `plc_data`

**Query Time Range**: Default `-24h` (last 24 hours), configurable

**Network**: `ot-network` (Docker bridge network)

**Web UI**: `http://localhost:8086`
- Username: `admin`
- Password: `admin123`

---

### 5. Next.js Frontend

**Location**: `frontend/`

**Port**: `3005` (development), configurable for production

**Framework**: Next.js 14 with App Router

**Technology Stack**:
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Data Fetching**: React Query (TanStack Query v5)
- **Build Tool**: Next.js built-in

**Key Files**:
- `app/page.tsx` - Main dashboard page
- `app/api/influxdb/latest/route.ts` - API endpoint for latest data
- `app/api/services/*/route.ts` - Service control endpoints
- `components/*.tsx` - React components
- `lib/influxdb.ts` - InfluxDB query functions
- `hooks/usePLCData.ts` - React hooks for data fetching

**API Endpoints** (Next.js API Routes):
- `GET /api/influxdb/latest?machineId={id}&timeRange={range}` - Get latest tag values
- `GET /api/influxdb/query` - Execute Flux queries
- `GET /api/services/status` - Check service status
- `POST /api/services/start` - Start services
- `POST /api/services/stop` - Stop services
- `GET /api/services/logs?service={name}&machineId={id}` - Get service logs

**Start Command**: `npm run dev` (from `frontend/` directory)

**Build Command**: `npm run build`

---

### 6. Grafana (Optional)

**Location**: Docker container (`grafana`)

**Image**: `grafana/grafana:latest`

**Port**: `3003` (mapped from container port 3000)

**Credentials**:
- Username: `admin`
- Password: `admin`

**Datasource**: InfluxDB (auto-provisioned via `grafana/provisioning/datasources/influxdb.yml`)

**Network**: `ot-network` (Docker bridge network)

**Web UI**: `http://localhost:3003`

---

## Network Configuration

### Docker Networks

**Network Name**: `ot-network`
**Driver**: `bridge`
**Services Connected**:
- `mqtt-broker-production` (Mosquitto)
- `influxdb`
- `grafana`

### Port Mappings

| Service | Container Port | Host Port | Protocol | Purpose |
|---------|---------------|-----------|----------|---------|
| Mosquitto | 8883 | 8883 | TCP/TLS | MQTT over TLS |
| Mosquitto | 1883 | 1883 | TCP | MQTT plain (dev) |
| Mosquitto | 9001 | 9001 | TCP | WebSocket |
| InfluxDB | 8086 | 8086 | HTTP | InfluxDB API |
| Grafana | 3000 | 3003 | HTTP | Grafana Web UI |
| Frontend | 3005 | 3005 | HTTP | Next.js dev server |

### Firewall Rules (Production)

**OT Network → IT Network**:
- Allow OUTBOUND: Port 8883 (MQTT over TLS)
- Block INBOUND: All ports (default deny)

**IT Network**:
- Allow INBOUND: Port 8086 (InfluxDB API)
- Allow INBOUND: Port 3003 (Grafana)
- Allow INBOUND: Port 3005 (Frontend)

---

## Data Structure

### MQTT Message Format

**Topic**: `plc/{machine-id}/bottlefiller/data`

**Payload** (JSON):
```json
{
  "timestamp": "2025-11-22T20:41:44.583647+00:00",
  "machine_id": "machine-01",
  "status": {
    "SystemRunning": true,
    "Fault": false,
    "Filling": true,
    "Ready": true,
    "AutoMode": true
  },
  "counters": {
    "BottlesFilled": 1234,
    "BottlesRejected": 5,
    "BottlesPerMinute": 45.2
  },
  "alarms": {
    "Fault": false,
    "Overfill": false,
    "Underfill": false,
    "LowProductLevel": false,
    "CapMissing": false
  },
  "analog": {
    "FillLevel": 75.5,
    "FillFlowRate": 2.5,
    "TankTemperature": 22.3,
    "TankPressure": 15.2,
    "ConveyorSpeed": 120.0
  },
  "inputs": {
    "BottlePresent": true,
    "BottleAtFill": true,
    "BottleAtCap": false,
    "LowLevel": false,
    "HighLevel": false,
    "CapPresent": true
  },
  "outputs": {
    "FillValve": true,
    "ConveyorMotor": true,
    "CappingMotor": false,
    "IndicatorGreen": true,
    "IndicatorRed": false,
    "IndicatorYellow": true
  },
  "setpoints": {
    "FillTarget": 500.0,
    "FillTime": 2.0,
    "FillSpeed": 250.0,
    "ConveyorSpeed": 120.0,
    "Tolerance": 5.0
  }
}
```

### InfluxDB Data Structure

**Measurement**: `plc_data`

**Tags**:
- `machine_id` (string): Machine identifier (e.g., "machine-01")
- `line` (string, optional): Production line ID
- `location` (string, optional): Physical location

**Fields** (18 total):

**Status Fields** (4):
1. `SystemRunning` (boolean)
2. `Fault` (boolean)
3. `Filling` (boolean)
4. `Ready` (boolean)

**Counter Fields** (3):
5. `BottlesFilled` (integer) - **Main bottle count**
6. `BottlesRejected` (integer)
7. `BottlesPerMinute` (float)

**Alarm Fields** (5):
8. `AlarmFault` (boolean)
9. `AlarmOverfill` (boolean)
10. `AlarmUnderfill` (boolean)
11. `AlarmLowProductLevel` (boolean)
12. `AlarmCapMissing` (boolean)

**Analog Fields** (5):
13. `FillLevel` (float) - Percentage (0-100)
14. `TankTemperature` (float) - Celsius
15. `TankPressure` (float) - PSI
16. `FillFlowRate` (float) - L/min
17. `ConveyorSpeed` (float) - RPM

**Input Fields** (1):
18. `LowLevelSensor` (boolean)

**Timestamp**: UTC (stored as `_time` field)

---

## Security

### MQTT Security

**TLS Encryption**:
- Protocol: MQTT over TLS (port 8883)
- Certificate Authority: Self-signed CA
- Server Certificate: `mosquitto/config/certs/server.crt`
- Server Key: `mosquitto/config/certs/server.key`
- Client Certificates: Optional (for mutual TLS)

**Authentication**:
- Method: Username/Password
- Password File: `mosquitto/config/passwd`
- Users: `edge_gateway`, `influxdb_writer`, `admin`

**Access Control**:
- Method: ACL (Access Control List)
- ACL File: `mosquitto/config/acl`
- Topic-based permissions

**Hostname Verification**:
- Production: Enabled (default)
- Development: Can be disabled via `MQTT_TLS_CHECK_HOSTNAME=false`

### InfluxDB Security

**Authentication**:
- Method: Token-based
- Token: `my-super-secret-auth-token` (change in production)
- Username/Password: `admin` / `admin123` (for Web UI)

**Network**:
- Access: Localhost only (Docker network)
- External Access: Via reverse proxy (recommended for production)

### Frontend Security

**API Routes**:
- Server-side only (not exposed to browser)
- InfluxDB credentials stored in environment variables
- No client-side token exposure

---

## API Endpoints

### InfluxDB Data Endpoints

#### GET `/api/influxdb/latest`
Get latest tag values for a machine.

**Query Parameters**:
- `machineId` (string, optional): Machine ID (default: "machine-01")
- `timeRange` (string, optional): Time range (default: "-24h")

**Response**:
```json
{
  "machineId": "machine-01",
  "timestamp": "2025-11-22T20:41:44.583647Z",
  "data": {
    "_time": "2025-11-22T20:41:44.583647Z",
    "machine_id": "machine-01",
    "BottlesFilled": 1234,
    "SystemRunning": true,
    "Fault": false,
    ...
  }
}
```

#### POST `/api/influxdb/query`
Execute Flux query (server-side).

**Body**:
```json
{
  "fluxQuery": "from(bucket: \"plc_data_new\") |> range(start: -24h) |> ..."
}
```

**Response**: Array of query results

### Service Control Endpoints

#### GET `/api/services/status`
Check running status of services.

**Response**:
```json
{
  "influxdb_writer": true,
  "mock_plc": {
    "machine-01": true,
    "machine-02": false,
    "machine-03": false
  }
}
```

#### POST `/api/services/start`
Start a service.

**Body**:
```json
{
  "service": "influxdb_writer" | "mock_plc",
  "machineId": "machine-01" // Required for mock_plc
}
```

#### POST `/api/services/stop`
Stop a service.

**Body**:
```json
{
  "service": "influxdb_writer" | "mock_plc",
  "machineId": "machine-01" // Required for mock_plc
}
```

#### GET `/api/services/logs`
Get service logs.

**Query Parameters**:
- `service` (string): Service name ("influxdb_writer" or "mock_plc")
- `machineId` (string, optional): Machine ID (for mock_plc)

**Response**: Array of log lines (last 30 lines)

---

## Data Flow

### Complete Data Flow

```
1. Mock PLC Agent (OT Network)
   ├─ Generates bottle filler data (every 2 seconds)
   ├─ Creates JSON payload with UTC timestamp
   └─ Publishes to MQTT broker
      Topic: plc/machine-01/bottlefiller/data
      Protocol: MQTT over TLS (port 8883)
      Authentication: edge_gateway / edge_gateway_pass

2. MQTT Broker (IT Network)
   ├─ Receives message on topic
   ├─ Validates authentication
   ├─ Checks ACL permissions
   └─ Routes to subscribers

3. InfluxDB Writer (IT Network)
   ├─ Subscribes to: plc/+/bottlefiller/data
   ├─ Receives message
   ├─ Extracts machine_id from topic
   ├─ Parses JSON payload
   ├─ Extracts 18 critical tags
   ├─ Creates InfluxDB Point
   │  ├─ Measurement: plc_data
   │  ├─ Tags: machine_id, line, location
   │  ├─ Fields: All 18 tags
   │  └─ Timestamp: UTC
   └─ Writes to InfluxDB bucket: plc_data_new

4. InfluxDB (IT Network)
   ├─ Stores time-series data
   ├─ Indexes by machine_id tag
   └─ Maintains historical data (24h+)

5. Frontend Dashboard (IT Network)
   ├─ User selects machine from dropdown
   ├─ Calls GET /api/influxdb/latest?machineId=machine-01
   ├─ API route queries InfluxDB
   │  Query: Latest record in last 24h
   ├─ Returns JSON data
   ├─ Frontend displays:
   │  ├─ Status Panel (SystemRunning, Fault, etc.)
   │  ├─ Production Counters (BottlesFilled, etc.)
   │  ├─ Alarms Panel (all 5 alarms)
   │  ├─ Tank Status (FillLevel, Temperature, etc.)
   │  ├─ Time Series Charts
   │  ├─ Alarm History
   │  └─ All Tags Table
   └─ Updates on manual refresh

6. Grafana (Optional, IT Network)
   ├─ Queries InfluxDB directly
   ├─ Creates dashboards
   └─ Visualizes historical trends
```

### Message Flow Diagram

```
┌─────────────┐
│ Mock PLC    │───[Publish]───┐
│ Agent       │               │
└─────────────┘               │
                              ▼
                        ┌──────────┐
                        │   MQTT    │
                        │  Broker   │
                        └─────┬─────┘
                              │
                              │ [Subscribe]
                              │
                              ▼
                        ┌──────────┐
                        │ InfluxDB │
                        │  Writer  │
                        └─────┬─────┘
                              │
                              │ [Write]
                              │
                              ▼
                        ┌──────────┐
                        │ InfluxDB │
                        │ Database │
                        └─────┬─────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
            ┌──────────────┐    ┌──────────┐
            │   Frontend   │    │  Grafana │
            │   Dashboard  │    │          │
            └──────────────┘    └──────────┘
```

---

## File Structure

```
mqtt-ot-network/
├── docker-compose.yml              # Docker services (dev)
├── docker-compose.production.yml   # Docker services (prod)
├── requirements.txt                # Python dependencies
│
├── mock_plc_agent/
│   └── mock_plc_agent.py          # Mock PLC agent
│
├── influxdb_writer/
│   └── influxdb_writer_production.py  # InfluxDB writer
│
├── mosquitto/
│   └── config/
│       ├── mosquitto.production.conf  # MQTT broker config
│       ├── passwd                      # User passwords
│       ├── acl                         # Access control list
│       └── certs/                      # TLS certificates
│           ├── ca.crt
│           ├── server.crt
│           ├── server.key
│           ├── client.crt
│           └── client.key
│
├── influxdb/
│   ├── data/                          # InfluxDB data
│   └── config/                         # InfluxDB config
│
├── grafana/
│   ├── data/                          # Grafana data
│   └── provisioning/
│       └── datasources/
│           └── influxdb.yml          # Auto-provisioned datasource
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx                   # Main dashboard
│   │   ├── layout.tsx                 # Root layout
│   │   └── api/
│   │       ├── influxdb/
│   │       │   ├── latest/route.ts   # Latest data endpoint
│   │       │   └── query/route.ts    # Query endpoint
│   │       └── services/
│   │           ├── status/route.ts    # Service status
│   │           ├── start/route.ts     # Start services
│   │           ├── stop/route.ts      # Stop services
│   │           └── logs/route.ts     # Service logs
│   ├── components/
│   │   ├── StatusPanel.tsx
│   │   ├── ProductionCounters.tsx
│   │   ├── AlarmsPanel.tsx
│   │   ├── TankStatus.tsx
│   │   ├── TimeSeriesChart.tsx
│   │   ├── AlarmHistory.tsx
│   │   ├── TagsTable.tsx
│   │   └── ServiceControls.tsx
│   ├── lib/
│   │   ├── influxdb.ts                # InfluxDB query functions
│   │   └── react-query.ts             # React Query config
│   ├── hooks/
│   │   └── usePLCData.ts              # Data fetching hooks
│   ├── types/
│   │   └── plc-data.ts                # TypeScript types
│   └── package.json
│
├── scripts/
│   ├── generate-tls-certs.sh          # Generate TLS certificates
│   └── setup-mqtt-auth.sh             # Setup MQTT users
│
├── start_influxdb_writer.sh           # Start writer script
├── start_mock_plc.sh                  # Start mock PLC script
├── start_frontend.sh                  # Start frontend script
├── start_all_machines.sh              # Start all machines
├── stop_all.sh                         # Stop all services
│
└── docs/
    ├── architecture.md                # Basic architecture
    ├── production-architecture.md     # Production architecture
    └── ARCHITECTURE_DETAILED.md       # This file
```

---

## Dependencies

### Python Dependencies (`requirements.txt`)

```
paho-mqtt==1.6.1          # MQTT client library
pymodbus==3.6.8           # Modbus TCP (for future PLC integration)
influxdb-client==1.38.0   # InfluxDB client library
```

### Frontend Dependencies (`frontend/package.json`)

**Production Dependencies**:
```json
{
  "@influxdata/influxdb-client": "^1.33.2",
  "@tanstack/react-query": "^5.17.0",
  "next": "^14.0.4",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "recharts": "^2.10.3"
}
```

**Development Dependencies**:
```json
{
  "@types/node": "^20.10.5",
  "@types/react": "^18.2.45",
  "@types/react-dom": "^18.2.18",
  "autoprefixer": "^10.4.16",
  "postcss": "^8.4.32",
  "tailwindcss": "^3.3.6",
  "typescript": "^5.3.3"
}
```

### Docker Images

- `eclipse-mosquitto:latest` - MQTT broker
- `influxdb:2.7` - Time-series database
- `grafana/grafana:latest` - Visualization (optional)

---

## Configuration

### Environment Variables

#### Mock PLC Agent

```bash
MACHINE_ID=machine-01
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=8883
MQTT_USERNAME=edge_gateway
MQTT_PASSWORD=edge_gateway_pass
MQTT_TLS_ENABLED=true
CA_CERT_PATH=mosquitto/config/certs/ca.crt
PUBLISH_INTERVAL=2
```

#### InfluxDB Writer

```bash
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=8883
MQTT_TOPIC=plc/+/bottlefiller/data
MQTT_USERNAME=influxdb_writer
MQTT_PASSWORD=influxdb_writer_pass
MQTT_TLS_ENABLED=true
MQTT_TLS_CHECK_HOSTNAME=false  # For development
CA_CERT_PATH=mosquitto/config/certs/ca.crt
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=my-super-secret-auth-token
INFLUXDB_ORG=myorg
INFLUXDB_BUCKET=plc_data_new
```

#### Frontend (Next.js)

```bash
NEXT_PUBLIC_INFLUXDB_URL=http://localhost:8086
NEXT_PUBLIC_INFLUXDB_TOKEN=my-super-secret-auth-token
NEXT_PUBLIC_INFLUXDB_ORG=myorg
NEXT_PUBLIC_INFLUXDB_BUCKET=plc_data_new
```

### Configuration Files

#### MQTT Broker (`mosquitto/config/mosquitto.production.conf`)

```conf
listener 8883
protocol mqtt
allow_anonymous false
cafile /mosquitto/config/certs/ca.crt
certfile /mosquitto/config/certs/server.crt
keyfile /mosquitto/config/certs/server.key
password_file /mosquitto/config/passwd
acl_file /mosquitto/config/acl
```

#### InfluxDB (Docker Environment)

```yaml
DOCKER_INFLUXDB_INIT_MODE=setup
DOCKER_INFLUXDB_INIT_USERNAME=admin
DOCKER_INFLUXDB_INIT_PASSWORD=admin123
DOCKER_INFLUXDB_INIT_ORG=myorg
DOCKER_INFLUXDB_INIT_BUCKET=plc_data
DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=my-super-secret-auth-token
```

---

## Deployment

### Quick Start (Development)

1. **Start Docker Services**:
   ```bash
   docker-compose up -d
   ```

2. **Start InfluxDB Writer**:
   ```bash
   bash start_influxdb_writer.sh
   ```

3. **Start Mock PLC Agent**:
   ```bash
   bash start_mock_plc.sh machine-01
   ```

4. **Start Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Access**:
   - Frontend: http://localhost:3005
   - Grafana: http://localhost:3003
   - InfluxDB: http://localhost:8086

### Production Deployment

1. **Generate TLS Certificates**:
   ```bash
   bash scripts/generate-tls-certs.sh
   ```

2. **Setup MQTT Authentication**:
   ```bash
   bash scripts/setup-mqtt-auth.sh
   ```

3. **Start Docker Services**:
   ```bash
   docker-compose -f docker-compose.production.yml up -d
   ```

4. **Start Services** (as systemd services or via process manager)

5. **Configure Firewall**:
   - Allow OUTBOUND: Port 8883 (OT → IT)
   - Block INBOUND: All ports to OT network

### Service Management

**Start Services**:
- `bash start_influxdb_writer.sh` - Start InfluxDB writer
- `bash start_mock_plc.sh {machine-id}` - Start mock PLC for specific machine
- `bash start_all_machines.sh` - Start all machines (01, 02, 03)

**Stop Services**:
- `bash stop_all.sh` - Stop all Python services
- `pkill -f "influxdb_writer_production.py"` - Stop writer
- `pkill -f "mock_plc_agent.py"` - Stop all agents

**Check Status**:
- `pgrep -f "influxdb_writer_production.py"` - Check if writer running
- `pgrep -f "mock_plc_agent.py"` - Check if agents running

---

## Summary

**System Type**: Real-time PLC monitoring with historical storage

**Architecture**: Pub/Sub (MQTT) with time-series database

**Components**: 6 main components (Mock PLC, MQTT Broker, InfluxDB Writer, InfluxDB, Frontend, Grafana)

**Data Tags**: 18 critical tags (status, counters, alarms, analog, inputs)

**Multi-Machine**: Supports multiple machines via `machine_id` tags

**Security**: TLS encryption, authentication, ACL-based access control

**Time Range**: Default 24 hours, configurable

**Timezone**: UTC storage, EST display in UI

---

**Last Updated**: 2025-11-22
**Version**: 1.0

