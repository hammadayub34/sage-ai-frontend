# Production Architecture - Quick Start Guide

## Overview

This guide provides quick steps to deploy the production architecture with OT/IT network separation.

## Architecture Summary

```
OT Network (10.0.1.0/24)          IT Network (192.168.1.0/24)
┌─────────────────────┐           ┌─────────────────────┐
│ PLC (10.0.1.10)     │           │ MQTT Broker         │
│                     │           │ (192.168.1.100:8883) │
│ Modbus TCP:502      │           │                     │
└──────────┬──────────┘           └──────────┬──────────┘
           │                                 │
           │ Modbus                          │ MQTT (TLS)
           │                                 │
┌──────────▼──────────┐           ┌──────────▼──────────┐
│ Edge Gateway        │──────────►│ InfluxDB Writer    │
│ (10.0.1.50)         │  OUTBOUND │ (192.168.1.200)    │
│                      │           │                     │
│ Reads PLC → MQTT    │           │ MQTT → InfluxDB    │
└─────────────────────┘           └──────────┬──────────┘
                                              │
                                     ┌────────▼──────────┐
                                     │ InfluxDB           │
                                     │ (192.168.1.201)    │
                                     └──────────┬─────────┘
                                                │
                                     ┌──────────▼─────────┐
                                     │ Grafana            │
                                     │ (192.168.1.202)    │
                                     └────────────────────┘
```

## Quick Deployment Steps

### 1. Generate TLS Certificates

```bash
./scripts/generate-tls-certs.sh
```

### 2. Setup MQTT Authentication

```bash
./scripts/setup-mqtt-auth.sh
```

### 3. Start IT Network Services

```bash
docker-compose -f docker-compose.production.yml up -d
```

### 4. Deploy Edge Gateway (OT Network)

On machine `10.0.1.50`:

```bash
export PLC_HOST=10.0.1.10
export MQTT_BROKER_HOST=192.168.1.100
export MQTT_BROKER_PORT=8883
export MQTT_USERNAME=edge_gateway
export MQTT_PASSWORD=edge_gateway_pass
export MQTT_TLS_ENABLED=true

python3 modbus_reader/edge_gateway_production.py
```

### 5. Deploy InfluxDB Writer (IT Network)

On machine `192.168.1.200`:

```bash
export MQTT_BROKER_HOST=192.168.1.100
export MQTT_BROKER_PORT=8883
export MQTT_USERNAME=influxdb_writer
export MQTT_PASSWORD=influxdb_writer_pass
export MQTT_TLS_ENABLED=true
export INFLUXDB_URL=http://192.168.1.201:8086

python3 influxdb_writer/influxdb_writer_production.py
```

### 6. Configure Firewall

**OT Network Firewall:**
- Allow outbound: `10.0.1.50 → 192.168.1.100:8883`
- Block all inbound

**IT Network Firewall:**
- Allow inbound: `192.168.1.100:8883 ← 10.0.1.0/24`

## Key Files

- `docker-compose.production.yml` - Production Docker services
- `mosquitto/config/mosquitto.production.conf` - MQTT broker with TLS
- `modbus_reader/edge_gateway_production.py` - Edge gateway (OT network)
- `influxdb_writer/influxdb_writer_production.py` - InfluxDB writer (IT network)
- `scripts/generate-tls-certs.sh` - TLS certificate generation
- `scripts/setup-mqtt-auth.sh` - MQTT authentication setup

## Network Configuration

### OT Network
- IP Range: `10.0.1.0/24`
- PLC: `10.0.1.10:502`
- Edge Gateway: `10.0.1.50`

### IT Network
- IP Range: `192.168.1.0/24`
- MQTT Broker: `192.168.1.100:8883`
- InfluxDB: `192.168.1.201:8086`
- Grafana: `192.168.1.202:3000`
- InfluxDB Writer: `192.168.1.200`

## Security Features

✅ TLS encryption (port 8883)  
✅ MQTT authentication (username/password)  
✅ Access Control List (ACL)  
✅ One-way communication (OT → IT)  
✅ Network isolation  

## Testing

### Test Edge Gateway Connection

```bash
# From OT network
openssl s_client -connect 192.168.1.100:8883 -CAfile mosquitto/config/certs/ca.crt
```

### Test MQTT Publish

```bash
mosquitto_pub -h 192.168.1.100 -p 8883 \
  --cafile mosquitto/config/certs/ca.crt \
  --cert mosquitto/config/certs/client.crt \
  --key mosquitto/config/certs/client.key \
  -u edge_gateway -P edge_gateway_pass \
  -t test/topic -m "Hello"
```

### Test MQTT Subscribe

```bash
mosquitto_sub -h 192.168.1.100 -p 8883 \
  --cafile mosquitto/config/certs/ca.crt \
  -u influxdb_writer -P influxdb_writer_pass \
  -t plc/bottlefiller/#
```

## Troubleshooting

**Edge Gateway can't connect:**
- Check firewall allows outbound 8883
- Verify MQTT broker is running
- Check TLS certificates exist
- Verify username/password

**No data in Grafana:**
- Check InfluxDB has data
- Verify time range in query
- Check InfluxDB writer is running

## Full Documentation

See `PRODUCTION-DEPLOYMENT.md` for detailed instructions.

