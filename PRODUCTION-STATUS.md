# Production Environment - Status & Testing Guide

## ✅ What We've Completed

### 1. Security Infrastructure ✅
- [x] **TLS Certificates Generated**
  - CA Certificate: `mosquitto/config/certs/ca.crt`
  - Server Certificate: `mosquitto/config/certs/server.crt`
  - Server Key: `mosquitto/config/certs/server.key`
  - Client Certificate: `mosquitto/config/certs/client.crt`
  - Client Key: `mosquitto/config/certs/client.key`

- [x] **MQTT Authentication Configured**
  - Password file: `mosquitto/config/passwd`
  - Users created:
    - `edge_gateway` / `edge_gateway_pass` (OT Network - Publisher)
    - `influxdb_writer` / `influxdb_writer_pass` (IT Network - Subscriber)
    - `admin` / `admin_pass` (Full Access)

- [x] **Access Control List (ACL)**
  - File: `mosquitto/config/acl`
  - Edge gateway can publish to `plc/bottlefiller/#`
  - InfluxDB writer can subscribe to `plc/bottlefiller/#`

### 2. IT Network Services ✅
- [x] **MQTT Broker (Production)**
  - Container: `mqtt-broker-production`
  - Port: `8883` (TLS encrypted)
  - Status: ✅ Running
  - Config: `mosquitto/config/mosquitto.production.conf`
  - Features: TLS, Authentication, ACL

- [x] **InfluxDB**
  - Container: `influxdb-production`
  - Port: `8086`
  - Status: ✅ Running
  - Org: `myorg`
  - Bucket: `plc_data`
  - Token: `my-super-secret-auth-token`

- [x] **Grafana**
  - Container: `grafana-production`
  - Port: `3004` (http://localhost:3004)
  - Status: ✅ Running
  - Login: `admin` / `admin`
  - Datasource: InfluxDB (pre-configured)

### 3. Production Code ✅
- [x] **Edge Gateway (OT Network)**
  - File: `modbus_reader/edge_gateway_production.py`
  - Features: TLS support, Authentication, Modbus → MQTT

- [x] **InfluxDB Writer (IT Network)**
  - File: `influxdb_writer/influxdb_writer_production.py`
  - Features: TLS support, Authentication, MQTT → InfluxDB

- [x] **Docker Compose (Production)**
  - File: `docker-compose.production.yml`
  - Network separation: OT network and IT network

### 4. Documentation ✅
- [x] Production architecture docs
- [x] Deployment guides
- [x] Quick start guides

## ❌ What's NOT Done Yet

- [ ] **Edge Gateway NOT Running** - Need to start it
- [ ] **InfluxDB Writer NOT Running** - Need to start it
- [ ] **Real PLC Connection** - Currently using mock data
- [ ] **Firewall Configuration** - For real network separation
- [ ] **Network IP Configuration** - Currently using localhost

## 🧪 How to Test the Production Environment

### Test 1: Verify MQTT Broker TLS Connection

```bash
# Test TLS connection to MQTT broker
openssl s_client -connect localhost:8883 -CAfile mosquitto/config/certs/ca.crt
```

**Expected:** Connection established, certificate shown

### Test 2: Test MQTT Publish (OT Network Simulation)

```bash
# Publish a test message using edge_gateway credentials
mosquitto_pub -h localhost -p 8883 \
  --cafile mosquitto/config/certs/ca.crt \
  --cert mosquitto/config/certs/client.crt \
  --key mosquitto/config/certs/client.key \
  -u edge_gateway -P edge_gateway_pass \
  -t plc/bottlefiller/data \
  -m '{"timestamp":"2025-11-20T17:30:00","BottleCount":100,"FillerSpeed":42.5,"LineRunning":true}'
```

**Expected:** Message published successfully

### Test 3: Test MQTT Subscribe (IT Network Simulation)

Open a terminal and run:
```bash
# Subscribe to MQTT topic using influxdb_writer credentials
mosquitto_sub -h localhost -p 8883 \
  --cafile mosquitto/config/certs/ca.crt \
  -u influxdb_writer -P influxdb_writer_pass \
  -t plc/bottlefiller/#
```

**Expected:** Should receive messages published in Test 2

### Test 4: Run Edge Gateway (OT Network)

```bash
cd /Users/khanhamza/mqtt-ot-network

export PLC_HOST=localhost
export MQTT_BROKER_HOST=localhost
export MQTT_BROKER_PORT=8883
export MQTT_USERNAME=edge_gateway
export MQTT_PASSWORD=edge_gateway_pass
export MQTT_TLS_ENABLED=true
export CA_CERT_PATH=mosquitto/config/certs/ca.crt
export CLIENT_CERT_PATH=mosquitto/config/certs/client.crt
export CLIENT_KEY_PATH=mosquitto/config/certs/client.key

python3 modbus_reader/edge_gateway_production.py
```

**Expected Output:**
```
🔐 Configuring TLS connection...
   ✅ TLS configured with CA cert: mosquitto/config/certs/ca.crt
🔗 Connecting to MQTT broker at localhost:8883...
   Network: OT → IT (outbound connection)
   TLS: Enabled
✅ Connected to MQTT broker at localhost:8883
🔗 Connecting to PLC at localhost:502...
✅ Connected to PLC
🚀 Edge Gateway started (OT Network → IT Network)
⏰ 2025-11-20T17:30:00 | Bottles: 100 | Speed: 42.50 | Running: True | → localhost
```

**Note:** If you don't have a real PLC, you can use the mock PLC agent temporarily:
```bash
python3 mock_plc_agent/mock_plc_agent.py
```

### Test 5: Run InfluxDB Writer (IT Network)

Open a **new terminal** and run:
```bash
cd /Users/khanhamza/mqtt-ot-network

export MQTT_BROKER_HOST=localhost
export MQTT_BROKER_PORT=8883
export MQTT_USERNAME=influxdb_writer
export MQTT_PASSWORD=influxdb_writer_pass
export MQTT_TLS_ENABLED=true
export CA_CERT_PATH=mosquitto/config/certs/ca.crt
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_TOKEN=my-super-secret-auth-token
export INFLUXDB_ORG=myorg
export INFLUXDB_BUCKET=plc_data

python3 influxdb_writer/influxdb_writer_production.py
```

**Expected Output:**
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
💾 Written to InfluxDB: Bottles=100, Speed=42.50, Running=True
```

### Test 6: Verify Data in InfluxDB

```bash
# Query InfluxDB directly
docker exec influxdb-production influx query \
  'from(bucket:"plc_data") |> range(start: -1h) |> limit(n:5)' \
  --org myorg --token my-super-secret-auth-token
```

**Expected:** Should see data points with BottleCount, FillerSpeed, LineRunning

### Test 7: View Data in Grafana

1. **Open Grafana:**
   - URL: http://localhost:3004
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
   - Top right: Select "Last 1 hour"

5. **Click "Run query"**
   - Should see graphs with data!

## 🔒 Security Tests

### Test Authentication (Should Fail)
```bash
# Try to connect without credentials (should fail)
mosquitto_pub -h localhost -p 8883 \
  --cafile mosquitto/config/certs/ca.crt \
  -t test/topic -m "test"
```

**Expected:** Connection refused or authentication error

### Test ACL (Should Fail)
```bash
# Try to publish to wrong topic (should fail if ACL configured)
mosquitto_pub -h localhost -p 8883 \
  --cafile mosquitto/config/certs/ca.crt \
  --cert mosquitto/config/certs/client.crt \
  --key mosquitto/config/certs/client.key \
  -u influxdb_writer -P influxdb_writer_pass \
  -t wrong/topic -m "test"
```

**Expected:** Publish denied (ACL blocks it)

## 📊 Complete End-to-End Test

### Step-by-Step:

1. **Start Edge Gateway (Terminal 1):**
   ```bash
   # Use mock PLC agent for testing
   python3 mock_plc_agent/mock_plc_agent.py
   ```
   Or use real edge gateway if you have a PLC

2. **Start InfluxDB Writer (Terminal 2):**
   ```bash
   # Run production InfluxDB writer
   python3 influxdb_writer/influxdb_writer_production.py
   ```

3. **Verify in Grafana:**
   - Open http://localhost:3004
   - Check Explore for data

4. **Check Logs:**
   ```bash
   # MQTT Broker logs
   docker logs mqtt-broker-production --tail 20
   
   # InfluxDB logs
   docker logs influxdb-production --tail 20
   ```

## ✅ Success Criteria

- [x] TLS certificates generated
- [x] MQTT authentication working
- [x] MQTT broker running on port 8883 (TLS)
- [x] InfluxDB running and accessible
- [x] Grafana running and accessible
- [ ] Edge gateway can connect to MQTT broker (TLS)
- [ ] InfluxDB writer can subscribe to MQTT (TLS)
- [ ] Data flows: Edge Gateway → MQTT → InfluxDB Writer → InfluxDB
- [ ] Data visible in Grafana

## 🐛 Troubleshooting

### Edge Gateway can't connect:
- Check MQTT broker is running: `docker ps | grep mqtt-broker`
- Verify certificates exist: `ls mosquitto/config/certs/`
- Check username/password
- Test TLS connection: `openssl s_client -connect localhost:8883`

### InfluxDB Writer not receiving:
- Check MQTT broker logs: `docker logs mqtt-broker-production`
- Verify topic subscription matches
- Check ACL allows user to read topic
- Test MQTT subscribe manually

### No data in Grafana:
- Check InfluxDB has data (Test 6)
- Verify time range in query
- Check InfluxDB writer is running
- Verify datasource configuration

