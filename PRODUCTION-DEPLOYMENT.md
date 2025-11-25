# Production Deployment Guide

This guide walks you through deploying the MQTT OT Network architecture in a production environment with proper OT/IT network separation.

## Prerequisites

- Docker and Docker Compose
- Python 3.7+
- OpenSSL (for certificate generation)
- Access to both OT and IT networks
- Firewall configuration access

## Step 1: Generate TLS Certificates

Generate TLS certificates for secure MQTT communication:

```bash
# Make script executable
chmod +x scripts/generate-tls-certs.sh

# Generate certificates
./scripts/generate-tls-certs.sh
```

This creates:
- `mosquitto/config/certs/ca.crt` - CA certificate
- `mosquitto/config/certs/server.crt` - Server certificate
- `mosquitto/config/certs/server.key` - Server private key
- `mosquitto/config/certs/client.crt` - Client certificate (for edge gateway)
- `mosquitto/config/certs/client.key` - Client private key

**For Production**: Use certificates from a trusted CA instead of self-signed certificates.

## Step 2: Setup MQTT Authentication

Create MQTT broker user accounts:

```bash
# Make script executable
chmod +x scripts/setup-mqtt-auth.sh

# Setup authentication
./scripts/setup-mqtt-auth.sh
```

This creates:
- `mosquitto/config/passwd` - Password file with users:
  - `edge_gateway` / `edge_gateway_pass` (OT Network - Publisher)
  - `influxdb_writer` / `influxdb_writer_pass` (IT Network - Subscriber)
  - `admin` / `admin_pass` (Full Access)

**For Production**: Change all passwords to strong, unique values.

## Step 3: Deploy IT Network Services

Deploy MQTT broker, InfluxDB, and Grafana on the IT network:

```bash
# Start IT network services
docker-compose -f docker-compose.production.yml up -d mosquitto influxdb grafana

# Verify services are running
docker ps
```

Services will be available at:
- MQTT Broker: `192.168.1.100:8883` (TLS)
- InfluxDB: `192.168.1.201:8086`
- Grafana: `192.168.1.202:3000`

## Step 4: Configure Firewall Rules

### OT Network Firewall (Outbound)

Allow edge gateway to connect to IT network MQTT broker:

```bash
# Allow outbound MQTT TLS
ALLOW: 10.0.1.50 → 192.168.1.100:8883 (OUTBOUND)

# Allow DNS resolution
ALLOW: 10.0.1.50 → DNS servers (port 53)

# Block all inbound (default deny)
BLOCK: All inbound connections
```

### IT Network Firewall (Inbound)

Allow MQTT connections from OT network:

```bash
# Allow MQTT TLS from OT network
ALLOW: 192.168.1.100:8883 ← 10.0.1.0/24 (INBOUND)

# Or allow from specific edge gateway
ALLOW: 192.168.1.100:8883 ← 10.0.1.50 (INBOUND)
```

## Step 5: Deploy Edge Gateway (OT Network)

The edge gateway runs on the OT network and connects to the PLC:

```bash
# On OT network machine (10.0.1.50)
cd /path/to/mqtt-ot-network

# Set environment variables
export PLC_HOST=10.0.1.10          # PLC IP in OT network
export PLC_PORT=502
export MQTT_BROKER_HOST=192.168.1.100  # IT network broker
export MQTT_BROKER_PORT=8883      # TLS port
export MQTT_USERNAME=edge_gateway
export MQTT_PASSWORD=edge_gateway_pass
export MQTT_TLS_ENABLED=true
export CA_CERT_PATH=mosquitto/config/certs/ca.crt
export CLIENT_CERT_PATH=mosquitto/config/certs/client.crt
export CLIENT_KEY_PATH=mosquitto/config/certs/client.key

# Run edge gateway
python3 modbus_reader/edge_gateway_production.py
```

## Step 6: Deploy InfluxDB Writer (IT Network)

The InfluxDB writer runs on the IT network and subscribes to MQTT:

```bash
# On IT network machine (192.168.1.200)
cd /path/to/mqtt-ot-network

# Set environment variables
export MQTT_BROKER_HOST=192.168.1.100  # IT network broker
export MQTT_BROKER_PORT=8883      # TLS port
export MQTT_USERNAME=influxdb_writer
export MQTT_PASSWORD=influxdb_writer_pass
export MQTT_TLS_ENABLED=true
export CA_CERT_PATH=mosquitto/config/certs/ca.crt
export INFLUXDB_URL=http://192.168.1.201:8086
export INFLUXDB_TOKEN=my-super-secret-auth-token
export INFLUXDB_ORG=myorg
export INFLUXDB_BUCKET=plc_data

# Run InfluxDB writer
python3 influxdb_writer/influxdb_writer_production.py
```

## Step 7: Verify Data Flow

### Check Edge Gateway (OT Network)

You should see:
```
✅ Connected to MQTT broker at 192.168.1.100:8883
✅ Connected to PLC
🚀 Edge Gateway started (OT Network → IT Network)
⏰ 2025-11-20T16:25:49 | Bottles: 1410 | Speed: 42.30 | Running: True | → 192.168.1.100
```

### Check InfluxDB Writer (IT Network)

You should see:
```
✅ Connected to MQTT broker
📡 Subscribed to: plc/bottlefiller/data
📨 Received message on topic: plc/bottlefiller/data
💾 Written to InfluxDB: Bottles=1410, Speed=42.30, Running=True
```

### Check Grafana

1. Open Grafana: http://192.168.1.202:3000
2. Login: `admin` / `admin`
3. Go to Explore
4. Select InfluxDB datasource
5. Run query:
```flux
from(bucket: "plc_data")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
```

## Step 8: Network Configuration

### OT Network Configuration

On the edge gateway machine (10.0.1.50):

```bash
# Network interface configuration (example)
# /etc/network/interfaces or NetworkManager

# Static IP configuration
IP: 10.0.1.50
Netmask: 255.255.255.0
Gateway: 10.0.1.1
DNS: 8.8.8.8, 8.8.4.4
```

### IT Network Configuration

On IT network machines, configure static IPs:
- MQTT Broker: 192.168.1.100
- InfluxDB: 192.168.1.201
- Grafana: 192.168.1.202
- InfluxDB Writer: 192.168.1.200

## Step 9: Security Hardening

### Change Default Passwords

```bash
# Update MQTT passwords
mosquitto_passwd mosquitto/config/passwd edge_gateway
mosquitto_passwd mosquitto/config/passwd influxdb_writer
mosquitto_passwd mosquitto/config/passwd admin

# Update InfluxDB token
# Use InfluxDB UI or CLI to generate new token
```

### Use Trusted Certificates

Replace self-signed certificates with certificates from a trusted CA:
- Let's Encrypt
- Internal CA
- Commercial CA

### Enable Logging and Monitoring

```bash
# Enable MQTT broker logging
# Already configured in mosquitto.production.conf

# Monitor InfluxDB
docker logs -f influxdb-production

# Monitor Grafana
docker logs -f grafana-production
```

## Step 10: Testing

### Test MQTT Connection (OT → IT)

From OT network edge gateway:

```bash
# Test TLS connection
openssl s_client -connect 192.168.1.100:8883 -CAfile mosquitto/config/certs/ca.crt

# Test MQTT publish (if mosquitto_pub installed)
mosquitto_pub -h 192.168.1.100 -p 8883 \
  --cafile mosquitto/config/certs/ca.crt \
  --cert mosquitto/config/certs/client.crt \
  --key mosquitto/config/certs/client.key \
  -u edge_gateway -P edge_gateway_pass \
  -t test/topic -m "Hello from OT network"
```

### Test MQTT Subscribe (IT Network)

From IT network:

```bash
# Test MQTT subscribe
mosquitto_sub -h 192.168.1.100 -p 8883 \
  --cafile mosquitto/config/certs/ca.crt \
  -u influxdb_writer -P influxdb_writer_pass \
  -t plc/bottlefiller/#
```

## Troubleshooting

### Edge Gateway Cannot Connect to MQTT Broker

1. Check firewall rules allow outbound 8883
2. Verify MQTT broker is running: `docker ps | grep mqtt-broker`
3. Test network connectivity: `ping 192.168.1.100`
4. Check TLS certificates are accessible
5. Verify username/password are correct

### InfluxDB Writer Not Receiving Messages

1. Check MQTT broker logs: `docker logs mqtt-broker-production`
2. Verify subscription topic matches publication topic
3. Check ACL file allows user to read topic
4. Test MQTT connection manually

### No Data in Grafana

1. Verify InfluxDB has data:
```bash
docker exec influxdb-production influx query \
  'from(bucket:"plc_data") |> range(start: -1h) |> limit(n:5)' \
  --org myorg --token my-super-secret-auth-token
```

2. Check Grafana datasource configuration
3. Verify time range in Grafana query
4. Check InfluxDB writer is running and receiving messages

## Production Checklist

- [ ] TLS certificates generated (or from trusted CA)
- [ ] MQTT authentication configured
- [ ] Firewall rules configured (OT → IT outbound)
- [ ] Edge gateway deployed on OT network
- [ ] InfluxDB writer deployed on IT network
- [ ] All default passwords changed
- [ ] Network IPs configured correctly
- [ ] Data flow verified end-to-end
- [ ] Logging and monitoring enabled
- [ ] Backup strategy in place
- [ ] Documentation updated

## Next Steps

- Set up automated backups
- Configure alerting (Grafana alerts)
- Set up high availability (MQTT broker clustering)
- Implement message retention policies
- Add more PLCs/edge gateways
- Scale InfluxDB for high volume

## Support

For issues, check:
- MQTT broker logs: `docker logs mqtt-broker-production`
- Edge gateway console output
- InfluxDB writer console output
- Network connectivity tests

