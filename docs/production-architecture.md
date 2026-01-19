# Production Architecture: OT Network → IT Network

## Overview

This document describes the production architecture with proper network separation between Operational Technology (OT) and Information Technology (IT) networks.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    OT NETWORK (VLAN)                        │
│              (Operational Technology Network)               │
│              IP Range: 10.0.1.0/24                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Production Machine / PLC                 │  │
│  │  ────────────────────────────────────────────────    │  │
│  │  - Bottle Filler PLC (Allen-Bradley/Siemens)         │  │
│  │  - Real sensors, actuators, motors                   │  │
│  │  - Exposes Modbus TCP on port 502                     │  │
│  │  - IP: 10.0.1.10                                      │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                       │
│                      │ Modbus TCP/IP                         │
│                      │ Port 502                              │
│                      │                                       │
│  ┌───────────────────▼──────────────────────────────────┐  │
│  │         Edge Gateway / Modbus Reader                 │  │
│  │  ────────────────────────────────────────────────    │  │
│  │  - Reads PLC tags via Modbus                          │  │
│  │  - Converts to MQTT messages                          │  │
│  │  - Runs on edge device/server                         │  │
│  │  - IP: 10.0.1.50 (OT Network)                        │  │
│  │  - Connects to PLC: 10.0.1.10:502                    │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                       │
│                      │ MQTT (TLS, outbound)                 │
│                      │ Port 8883 (TLS)                       │
│                      │ Topic: plc/bottlefiller/data         │
│                      │                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │
                       │ FIREWALL / DMZ
                       │ ✅ Allow OUTBOUND 8883 (OT → IT)
                       │ ❌ Block INBOUND (default deny)
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    IT NETWORK (VLAN)                        │
│              (Information Technology Network)                │
│              IP Range: 192.168.1.0/24 or Cloud              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Cloud MQTT Broker                         │  │
│  │  ────────────────────────────────────────────────    │  │
│  │  - Mosquitto with TLS                                │  │
│  │  - Port 8883 (TLS)                                   │  │
│  │  - Authentication required                           │  │
│  │  - IP: cloud-broker.example.com or 192.168.1.100    │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                       │
│                      │ MQTT Subscribe                       │
│                      │                                       │
│  ┌───────────────────▼──────────────────────────────────┐  │
│  │         IT Services / Applications                  │  │
│  │  ────────────────────────────────────────────────    │  │
│  │  - InfluxDB Writer (writes to database)            │  │
│  │  - Analytics services                               │  │
│  │  - Dashboards (Grafana)                             │  │
│  │  - Cloud applications                               │  │
│  │  - IP: 192.168.1.200 (IT Network)                  │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                       │
│                      │ Write API                            │
│                      │                                       │
│  ┌───────────────────▼──────────────────────────────────┐  │
│  │         InfluxDB (Time-Series Database)            │  │
│  │  ────────────────────────────────────────────────    │  │
│  │  - Port 8086 (API)                                   │  │
│  │  - Org: myorg                                        │  │
│  │  - Bucket: plc_data                                  │  │
│  │  - IP: 192.168.1.201 (IT Network)                   │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                       │
│                      │ Query API                            │
│                      │                                       │
│  ┌───────────────────▼──────────────────────────────────┐  │
│  │         Grafana (Visualization)                     │  │
│  │  ────────────────────────────────────────────────    │  │
│  │  - Port 3000 (Web UI)                                │  │
│  │  - Connected to InfluxDB                             │  │
│  │  - IP: 192.168.1.202 (IT Network)                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **PLC (OT Network)**
   - Runs bottle filler program
   - Updates tags (BottleCount, FillLevel, etc.)
   - Exposes Modbus TCP on port 502

2. **Edge Gateway (OT Network)**
   - Connects to PLC via Modbus TCP (port 502)
   - Reads tags every 1 second
   - Converts to JSON format
   - Publishes to MQTT broker (TLS encrypted)

3. **Edge Gateway → Cloud MQTT Broker (OUTBOUND)**
   - Initiates TLS connection to cloud broker
   - Port 8883 (MQTT over TLS)
   - Publishes: `plc/bottlefiller/data`
   - Firewall allows outbound connection

4. **Cloud MQTT Broker (IT Network)**
   - Receives messages from OT network
   - Routes to subscribers
   - Requires authentication

5. **IT Services Subscribe**
   - InfluxDB Writer subscribes to topics
   - Writes to time-series database
   - Grafana queries database
   - Dashboards display data

## Security Features

1. **One-Way Communication**: OT → IT (outbound only)
2. **TLS Encryption**: All MQTT traffic encrypted
3. **Network Isolation**: OT network isolated from IT
4. **Authentication**: MQTT broker requires certificates/tokens
5. **No Inbound to OT**: OT network stays closed

## Firewall Rules

### OT Network Firewall (Outbound)
```bash
# Allow edge gateway to connect to cloud MQTT
ALLOW: 10.0.1.50 → cloud-broker.example.com:8883 (OUTBOUND)

# Allow DNS resolution
ALLOW: 10.0.1.50 → DNS servers (port 53)

# Block all inbound
BLOCK: All inbound connections (default deny)
```

### IT Network Firewall (Inbound)
```bash
# Allow MQTT connections from OT network
ALLOW: cloud-broker.example.com:8883 ← 10.0.1.50 (INBOUND)

# Or allow from entire OT subnet
ALLOW: cloud-broker.example.com:8883 ← 10.0.1.0/24 (INBOUND)
```

## Network Configuration

### OT Network
- **IP Range**: `10.0.1.0/24`
- **PLC IP**: `10.0.1.10`
- **Edge Gateway IP**: `10.0.1.50`
- **Gateway**: `10.0.1.1`
- **DNS**: `8.8.8.8`, `8.8.4.4`

### IT Network
- **IP Range**: `192.168.1.0/24` or Cloud
- **MQTT Broker IP**: `192.168.1.100` or `cloud-broker.example.com`
- **InfluxDB IP**: `192.168.1.201`
- **Grafana IP**: `192.168.1.202`

## Deployment Steps

See `PRODUCTION-DEPLOYMENT.md` for detailed deployment instructions.

## Benefits

- **Security**: OT network isolated, no inbound access
- **Scalability**: Cloud broker handles many devices
- **Monitoring**: IT team can monitor without OT network access
- **Compliance**: Meets industrial security standards
- **Reliability**: Edge gateway buffers if cloud is down

