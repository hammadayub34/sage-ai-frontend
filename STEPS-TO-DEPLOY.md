# Step-by-Step Deployment Guide

Follow these steps in order to deploy the production architecture.

## Prerequisites Check

Before starting, make sure you have:
- [ ] Docker and Docker Compose installed
- [ ] Python 3.7+ installed
- [ ] OpenSSL installed (for certificates)
- [ ] Access to terminal/command line

## Step 1: Generate TLS Certificates

Generate certificates for secure MQTT communication:

```bash
cd /Users/khanhamza/mqtt-ot-network
chmod +x scripts/generate-tls-certs.sh
./scripts/generate-tls-certs.sh
```

**What this does:**
- Creates CA certificate
- Creates server certificate (for MQTT broker)
- Creates client certificate (for edge gateway)
- All certificates stored in `mosquitto/config/certs/`

**Expected output:**
```
✅ TLS certificates generated successfully!
```

## Step 2: Setup MQTT Authentication

Create user accounts for MQTT broker:

```bash
chmod +x scripts/setup-mqtt-auth.sh
./scripts/setup-mqtt-auth.sh
```

**What this does:**
- Creates password file with 3 users:
  - `edge_gateway` (OT network - publishes data)
  - `influxdb_writer` (IT network - subscribes to data)
  - `admin` (full access)

**Expected output:**
```
✅ Password file created: mosquitto/config/passwd
👤 Users created:
   - edge_gateway / edge_gateway_pass
   - influxdb_writer / influxdb_writer_pass
   - admin / admin_pass
```

## Step 3: Start IT Network Services (Docker)

Start MQTT broker, InfluxDB, and Grafana:

```bash
docker-compose -f docker-compose.production.yml up -d
```

**What this does:**
- Starts MQTT broker on port 8883 (TLS)
- Starts InfluxDB on port 8086
- Starts Grafana on port 3000
- Creates separate IT network (192.168.1.0/24)

**Verify services are running:**
```bash
docker ps
```

You should see:
- `mqtt-broker-production`
- `influxdb-production`
- `grafana-production`

## Step 4: Configure Network IPs (Optional - for testing)

If you're testing locally, you can skip this. For real production:

**OT Network:**
- PLC IP: `10.0.1.10`
- Edge Gateway IP: `10.0.1.50`

**IT Network:**
- MQTT Broker: `192.168.1.100`
- InfluxDB: `192.168.1.201`
- Grafana: `192.168.1.202`
- InfluxDB Writer: `192.168.1.200`

## Step 5: Deploy Edge Gateway (OT Network)

The edge gateway reads from PLC and publishes to MQTT broker.

**On the OT network machine (or localhost for testing):**

```bash
cd /Users/khanhamza/mqtt-ot-network

# Set environment variables
export PLC_HOST=10.0.1.10          # Your PLC IP (or localhost for testing)
export PLC_PORT=502
export MQTT_BROKER_HOST=localhost  # For local testing, or 192.168.1.100 for production
export MQTT_BROKER_PORT=8883       # TLS port
export MQTT_USERNAME=edge_gateway
export MQTT_PASSWORD=edge_gateway_pass
export MQTT_TLS_ENABLED=true
export CA_CERT_PATH=mosquitto/config/certs/ca.crt
export CLIENT_CERT_PATH=mosquitto/config/certs/client.crt
export CLIENT_KEY_PATH=mosquitto/config/certs/client.key
export POLL_INTERVAL=1.0

# Run edge gateway
python3 modbus_reader/edge_gateway_production.py
```

**Expected output:**
```
🔐 Configuring TLS connection...
   ✅ TLS configured with CA cert: mosquitto/config/certs/ca.crt
🔗 Connecting to MQTT broker at localhost:8883...
   Network: OT → IT (outbound connection)
   TLS: Enabled
✅ Connected to MQTT broker at localhost:8883
🔗 Connecting to PLC at 10.0.1.10:502...
✅ Connected to PLC
🚀 Edge Gateway started (OT Network → IT Network)
⏰ 2025-11-20T16:25:49 | Bottles: 1410 | Speed: 42.30 | Running: True | → localhost
```

**Note:** If you don't have a real PLC, you can use the mock PLC agent temporarily:
```bash
python3 mock_plc_agent/mock_plc_agent.py
```

## Step 6: Deploy InfluxDB Writer (IT Network)

The InfluxDB writer subscribes to MQTT and writes to InfluxDB.

**On the IT network machine (or localhost for testing):**

Open a **new terminal**:

```bash
cd /Users/khanhamza/mqtt-ot-network

# Set environment variables
export MQTT_BROKER_HOST=localhost  # For local testing, or 192.168.1.100 for production
export MQTT_BROKER_PORT=8883       # TLS port
export MQTT_TOPIC=plc/bottlefiller/data
export MQTT_USERNAME=influxdb_writer
export MQTT_PASSWORD=influxdb_writer_pass
export MQTT_TLS_ENABLED=true
export CA_CERT_PATH=mosquitto/config/certs/ca.crt
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_TOKEN=my-super-secret-auth-token
export INFLUXDB_ORG=myorg
export INFLUXDB_BUCKET=plc_data

# Run InfluxDB writer
python3 influxdb_writer/influxdb_writer_production.py
```

**Expected output:**
```
🔐 Configuring TLS connection...
   ✅ TLS configured with CA cert: mosquitto/config/certs/ca.crt
🔗 Connecting to MQTT broker at localhost:8883...
   Network: IT Network
   TLS: Enabled
✅ Connected to MQTT broker
📡 Subscribed to: plc/bottlefiller/data
🔗 Connecting to InfluxDB at http://localhost:8086...
✅ Connected to InfluxDB
   Org: myorg
   Bucket: plc_data
🔄 Waiting for messages...
📨 Received message on topic: plc/bottlefiller/data
💾 Written to InfluxDB: Bottles=1410, Speed=42.30, Running=True
```

## Step 7: Verify Data Flow

### Check Edge Gateway Terminal
You should see messages being published every second.

### Check InfluxDB Writer Terminal
You should see messages being received and written to InfluxDB.

### Check Grafana

1. **Open Grafana:**
   - URL: http://localhost:3000
   - Login: `admin` / `admin`

2. **Go to Explore:**
   - Click "Explore" icon (compass) in left menu
   - Select "InfluxDB" datasource

3. **Run Query:**
   ```flux
   from(bucket: "plc_data")
     |> range(start: -1h)
     |> filter(fn: (r) => r["_measurement"] == "plc_data")
     |> filter(fn: (r) => r["_field"] == "BottleCount" or r["_field"] == "FillerSpeed" or r["_field"] == "LineRunning")
   ```

4. **Set Time Range:**
   - Top right corner: Select "Last 1 hour"

5. **Click "Run query"**
   - You should see graphs with data!

## Step 8: Configure Firewall (Production Only)

If deploying on separate networks:

### OT Network Firewall
Allow outbound connection to IT network:
```bash
# Allow edge gateway to connect to MQTT broker
ALLOW: 10.0.1.50 → 192.168.1.100:8883 (OUTBOUND)
```

### IT Network Firewall
Allow inbound connection from OT network:
```bash
# Allow MQTT connections from OT network
ALLOW: 192.168.1.100:8883 ← 10.0.1.0/24 (INBOUND)
```

## Step 9: Testing (Optional)

### Test MQTT Connection
```bash
# Test TLS connection
openssl s_client -connect localhost:8883 -CAfile mosquitto/config/certs/ca.crt
```

### Test MQTT Publish (from OT network)
```bash
mosquitto_pub -h localhost -p 8883 \
  --cafile mosquitto/config/certs/ca.crt \
  --cert mosquitto/config/certs/client.crt \
  --key mosquitto/config/certs/client.key \
  -u edge_gateway -P edge_gateway_pass \
  -t test/topic -m "Hello from OT network"
```

### Test MQTT Subscribe (from IT network)
```bash
mosquitto_sub -h localhost -p 8883 \
  --cafile mosquitto/config/certs/ca.crt \
  -u influxdb_writer -P influxdb_writer_pass \
  -t plc/bottlefiller/#
```

## Troubleshooting

### Edge Gateway can't connect to MQTT broker
- Check if broker is running: `docker ps | grep mqtt-broker`
- Verify certificates exist: `ls mosquitto/config/certs/`
- Check username/password are correct
- For local testing, use `localhost` instead of IP

### InfluxDB Writer not receiving messages
- Check MQTT broker logs: `docker logs mqtt-broker-production`
- Verify topic subscription matches publication
- Check ACL file allows user to read topic
- Verify edge gateway is publishing messages

### No data in Grafana
- Check InfluxDB has data:
  ```bash
  docker exec influxdb-production influx query \
    'from(bucket:"plc_data") |> range(start: -1h) |> limit(n:5)' \
    --org myorg --token my-super-secret-auth-token
  ```
- Verify time range in Grafana query
- Check InfluxDB writer is running and receiving messages

## Summary

You now have:
1. ✅ TLS certificates generated
2. ✅ MQTT authentication configured
3. ✅ IT network services running (MQTT, InfluxDB, Grafana)
4. ✅ Edge gateway running (OT network)
5. ✅ InfluxDB writer running (IT network)
6. ✅ Data flowing: PLC → Edge Gateway → MQTT → InfluxDB → Grafana

## Next Steps

- Change default passwords for production
- Use trusted CA certificates (not self-signed)
- Configure proper network IPs
- Set up monitoring and alerts
- Implement backup strategy

