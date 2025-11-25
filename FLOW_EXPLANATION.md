# Complete Flow Explanation: How the UI Controls Work

## Overview
This document explains exactly what happens when you click buttons in the UI, from frontend to backend to services.

---

## 🎯 Flow: Clicking "Start Writer" Button

### Step 1: Frontend (React Component)
**File:** `frontend/components/ServiceControls.tsx`

```typescript
// User clicks "▶ Start Writer" button
onClick={() => startService('influxdb_writer')}
```

**What happens:**
1. Sets loading state: `loading.influxdb_writer = true`
2. Shows "⏳ Starting Writer..." on button
3. Clears any previous errors
4. If it's InfluxDB Writer, shows log viewer and initializes logs

### Step 2: API Call (HTTP Request)
**File:** `frontend/components/ServiceControls.tsx` (startService function)

```typescript
const response = await fetch('/api/services/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ service: 'influxdb_writer' })
});
```

**What happens:**
- Frontend sends POST request to `/api/services/start`
- Request body: `{ "service": "influxdb_writer" }`
- This is a Next.js API route (runs on server, not browser)

### Step 3: Backend API Route (Node.js/Next.js)
**File:** `frontend/app/api/services/start/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { service } = body;
  
  if (service === 'influxdb_writer') {
    return await startInfluxDBWriter();
  }
}
```

**What happens:**
1. Receives the POST request
2. Parses JSON body: `{ service: 'influxdb_writer' }`
3. Routes to `startInfluxDBWriter()` function

### Step 4: Check if Already Running
**File:** `frontend/app/api/services/start/route.ts` (startInfluxDBWriter function)

```typescript
// Check if already running using pgrep
const { stdout } = await execAsync('pgrep -f "influxdb_writer_production.py"');
if (stdout.trim().length > 0) {
  return { success: true, message: 'Already running' };
}
```

**What happens:**
- Uses `pgrep` to check if Python process is running
- If running, returns early (doesn't start duplicate)
- If not running, continues to start it

### Step 5: Execute Shell Script
**File:** `frontend/app/api/services/start/route.ts`

```typescript
exec(`cd "${PROJECT_ROOT}" && nohup bash start_influxdb_writer.sh > /tmp/influxdb_writer.log 2>&1 &`, ...)
```

**What happens:**
1. Changes directory to project root
2. Runs `start_influxdb_writer.sh` in background (`nohup ... &`)
3. Redirects output to `/tmp/influxdb_writer.log`
4. Returns immediately (doesn't wait for script to finish)

### Step 6: Shell Script Execution
**File:** `start_influxdb_writer.sh`

```bash
#!/bin/bash
cd /Users/khanhamza/mqtt-ot-network

# Set environment variables
export MQTT_BROKER_HOST=localhost
export MQTT_BROKER_PORT=8883
export MQTT_USERNAME=influxdb_writer
export MQTT_PASSWORD=influxdb_writer_pass
export MQTT_TLS_ENABLED=true
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_TOKEN=my-super-secret-auth-token
export INFLUXDB_ORG=myorg
export INFLUXDB_BUCKET=plc_data_new

# Print startup message
echo "🚀 Starting InfluxDB Writer..."
echo "   Subscribing to: plc/+/bottlefiller/data (all machines)"
echo "   Writing to: InfluxDB at http://localhost:8086"

# Start Python script
python3 influxdb_writer/influxdb_writer_production.py
```

**What happens:**
1. Sets all environment variables (MQTT credentials, InfluxDB config)
2. Prints startup messages (these go to log file)
3. Executes Python script: `python3 influxdb_writer/influxdb_writer_production.py`
4. Script runs in foreground (blocking), but since it's in background via `nohup`, it doesn't block the API

### Step 7: Python Script Starts
**File:** `influxdb_writer/influxdb_writer_production.py`

```python
# Connect to MQTT broker
mqtt_client = mqtt.Client(client_id=f"influxdb_writer_it_{uuid.uuid4().hex[:8]}")
mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

# Configure TLS
if MQTT_TLS_ENABLED:
    mqtt_client.tls_set(ca_certs=CA_CERT_PATH, ...)

# Connect
mqtt_client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, 60)

# Subscribe to topic
mqtt_client.subscribe("plc/+/bottlefiller/data")  # Wildcard: all machines

# Connect to InfluxDB
influxdb_client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
write_api = influxdb_client.write_api()

# Set callback for when messages arrive
mqtt_client.on_message = on_message

# Start listening loop
mqtt_client.loop_forever()
```

**What happens:**
1. **MQTT Connection:**
   - Creates MQTT client with unique ID
   - Sets username/password
   - Configures TLS (if enabled)
   - Connects to `localhost:8883` (MQTT broker)
   - Subscribes to `plc/+/bottlefiller/data` (receives data from all machines)

2. **InfluxDB Connection:**
   - Creates InfluxDB client
   - Connects to `http://localhost:8086`
   - Creates write API for writing data

3. **Message Handler:**
   - When MQTT message arrives, `on_message()` is called
   - Parses JSON data
   - Extracts `machine_id` from topic
   - Converts to InfluxDB Point format
   - Writes to InfluxDB bucket `plc_data_new`

4. **Runs Forever:**
   - `loop_forever()` keeps the script running
   - Continuously listens for MQTT messages
   - Writes each message to InfluxDB

### Step 8: Verify Process Started
**File:** `frontend/app/api/services/start/route.ts`

```typescript
// Wait 3 seconds
await new Promise(r => setTimeout(r, 3000));

// Check if process is running
const { stdout } = await execAsync('pgrep -f "influxdb_writer_production.py"');
if (stdout.trim().length > 0) {
  return { success: true, message: 'Started successfully' };
} else {
  return { success: false, message: 'Failed to start' };
}
```

**What happens:**
1. Waits 3 seconds for process to start
2. Checks if process is running using `pgrep`
3. Returns success or failure to frontend

### Step 9: Frontend Updates
**File:** `frontend/components/ServiceControls.tsx`

```typescript
if (response.ok && data.success) {
  // Update logs
  setLogs(prev => ({ 
    ...prev, 
    influxdb_writer: '✅ Service started successfully!\n📋 Command: bash start_influxdb_writer.sh\n\n' 
  }));
  
  // Refresh status after 2 seconds
  setTimeout(() => {
    fetch('/api/services/status').then(...);
  }, 2000);
}
```

**What happens:**
1. If successful, updates log viewer with success message
2. Schedules status refresh in 2 seconds
3. Button changes from "▶ Start Writer" to "⏹ Stop Writer"
4. Status dot changes from gray to green (pulsing)

### Step 10: Status Polling (Continuous)
**File:** `frontend/components/ServiceControls.tsx`

```typescript
useEffect(() => {
  const fetchStatus = async () => {
    const response = await fetch('/api/services/status');
    const data = await response.json();
    setStatus(data);  // Updates UI
  };
  
  fetchStatus();
  const interval = setInterval(fetchStatus, 3000);  // Every 3 seconds
}, [loading]);
```

**What happens:**
1. Every 3 seconds, frontend calls `/api/services/status`
2. Backend checks if processes are running using `pgrep`
3. Returns status: `{ influxdbWriter: { running: true }, machines: {...} }`
4. Frontend updates UI (status dots, button states)

---

## 🎯 Flow: Clicking "Start Agent" Button

Similar flow, but for Mock PLC agent:

### Step 1-3: Same as Writer (Frontend → API Route)

### Step 4: Check if Writer is Running
**File:** `frontend/components/ServiceControls.tsx`

```typescript
// Step 2 only shows if influxdbRunning is true
{influxdbRunning && (
  <button onClick={() => startService('mock_plc')}>Start Agent</button>
)}
```

**What happens:**
- Button only appears if InfluxDB Writer is running
- Prevents starting agent without writer

### Step 5: Execute Shell Script with Machine ID
**File:** `frontend/app/api/services/start/route.ts`

```typescript
exec(`cd "${PROJECT_ROOT}" && nohup bash start_mock_plc.sh ${machineId} > /tmp/mock_plc_${machineId}.log 2>&1 &`, ...)
```

**What happens:**
- Runs `start_mock_plc.sh machine-01` (or machine-02, machine-03)
- Logs go to `/tmp/mock_plc_machine-01.log`

### Step 6: Shell Script Sets Machine ID
**File:** `start_mock_plc.sh`

```bash
MACHINE_ID=${1:-machine-01}  # Get from command line argument
export MACHINE_ID=$MACHINE_ID
export MQTT_BROKER_HOST=localhost
export MQTT_BROKER_PORT=8883
export MQTT_USERNAME=edge_gateway
export MQTT_PASSWORD=edge_gateway_pass
export MQTT_TLS_ENABLED=true

python3 mock_plc_agent/mock_plc_agent.py
```

**What happens:**
- Sets `MACHINE_ID` environment variable
- Sets MQTT credentials (different user: `edge_gateway`)
- Starts Python script

### Step 7: Python Script Publishes Data
**File:** `mock_plc_agent/mock_plc_agent.py`

```python
# Connect to MQTT
mqtt_client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, 60)

# Publish to topic with machine_id
topic = f"plc/{MACHINE_ID}/bottlefiller/data"

while True:
    # Generate mock data
    data = {
        "status": { "SystemRunning": True, ... },
        "counters": { "BottlesFilled": 123, ... },
        "alarms": { "Fault": False, ... },
        "analog": { "FillLevel": 45.2, ... },
        "machine_id": MACHINE_ID,
        "timestamp": datetime.now().isoformat()
    }
    
    # Publish to MQTT
    mqtt_client.publish(topic, json.dumps(data))
    
    time.sleep(2)  # Every 2 seconds
```

**What happens:**
1. Connects to MQTT broker
2. Every 2 seconds:
   - Generates realistic mock PLC data
   - Publishes to `plc/machine-01/bottlefiller/data` (or machine-02, machine-03)
   - InfluxDB Writer (if running) receives this message
   - Writer writes it to InfluxDB

---

## 🔄 Complete Data Flow

```
┌─────────────────┐
│  Mock PLC Agent │  (Python script)
│  machine-01     │
└────────┬────────┘
         │
         │ Publishes JSON data
         │ Topic: plc/machine-01/bottlefiller/data
         │
         ▼
┌─────────────────┐
│  MQTT Broker    │  (Mosquitto on port 8883)
│  (Message Hub)  │
└────────┬────────┘
         │
         │ Delivers message
         │
         ▼
┌─────────────────┐
│ InfluxDB Writer │  (Python script)
│  (Subscriber)   │
└────────┬────────┘
         │
         │ Writes data
         │
         ▼
┌─────────────────┐
│    InfluxDB     │  (Time-series database)
│  Bucket:        │
│  plc_data_new   │
└────────┬────────┘
         │
         │ Queries data
         │
         ▼
┌─────────────────┐
│   Frontend UI   │  (Next.js React app)
│   Dashboard     │
└─────────────────┘
```

---

## 🛑 Flow: Clicking "Stop Writer" Button

### Step 1: Frontend
```typescript
onClick={() => stopService('influxdb_writer')}
```

### Step 2: API Call
```typescript
fetch('/api/services/stop', {
  method: 'POST',
  body: JSON.stringify({ service: 'influxdb_writer' })
});
```

### Step 3: Backend API Route
**File:** `frontend/app/api/services/stop/route.ts`

```typescript
async function stopInfluxDBWriter() {
  await execAsync('pkill -f "influxdb_writer_production.py"');
  return { success: true, message: 'Stopped' };
}
```

**What happens:**
1. Uses `pkill` to find and kill process matching pattern
2. Process terminates (MQTT connection closes, InfluxDB writes stop)
3. Returns success

### Step 4: Frontend Updates
- Button changes back to "▶ Start Writer"
- Status dot changes to gray
- Log viewer can still show logs (if shown)

---

## 📊 Status Checking Flow

### Every 3 Seconds:
1. Frontend calls `/api/services/status`
2. Backend runs:
   ```bash
   pgrep -f "influxdb_writer_production.py"  # Check writer
   pgrep -f "mock_plc_agent.py.*machine-01"  # Check each machine
   ```
3. Backend checks process environment variables for `MACHINE_ID`
4. Returns JSON:
   ```json
   {
     "influxdbWriter": { "running": true },
     "machines": {
       "machine-01": { "running": true },
       "machine-02": { "running": false },
       "machine-03": { "running": false }
     }
   }
   ```
5. Frontend updates UI (status dots, button states)

---

## 📋 Log Viewer Flow

### When "Show Logs" is Clicked:

1. **Frontend:**
   ```typescript
   setShowLogs(prev => ({ ...prev, influxdb_writer: true }));
   ```

2. **Log Fetching Starts:**
   ```typescript
   useEffect(() => {
     const fetchLogs = async () => {
       const response = await fetch('/api/services/logs?service=influxdb_writer');
       const data = await response.json();
       setLogs(prev => ({ ...prev, influxdb_writer: data.logs }));
     };
     
     fetchLogs();
     const interval = setInterval(fetchLogs, 2000);  // Every 2 seconds
   }, [influxdbRunning, showLogs.influxdb_writer]);
   ```

3. **Backend Reads Log File:**
   **File:** `frontend/app/api/services/logs/route.ts`
   ```typescript
   const logPath = '/tmp/influxdb_writer.log';
   const logContent = await readFile(logPath, 'utf-8');
   const lastLines = logContent.split('\n').slice(-50).join('\n');
   return { success: true, logs: lastLines };
   ```

4. **Frontend Displays:**
   - Shows last 50 lines from log file
   - Auto-scrolls to bottom
   - Updates every 2 seconds

---

## 🔐 Security & Authentication

### MQTT Authentication:
- **InfluxDB Writer:** Uses `influxdb_writer` / `influxdb_writer_pass`
- **Mock PLC Agent:** Uses `edge_gateway` / `edge_gateway_pass`
- **TLS:** Enabled on port 8883 (encrypted connection)
- **ACL:** Each user can only publish/subscribe to specific topics

### InfluxDB Authentication:
- **Token:** `my-super-secret-auth-token`
- **Org:** `myorg`
- **Bucket:** `plc_data_new`

---

## 🎯 Key Points

1. **All processes run on your local machine** (not in Docker)
2. **MQTT Broker runs in Docker** (port 8883)
3. **InfluxDB runs in Docker** (port 8086)
4. **Frontend runs on port 3005** (Next.js dev server)
5. **Logs are written to `/tmp/`** directory
6. **Process detection uses `pgrep`** to find running Python processes
7. **Status updates every 3 seconds** automatically
8. **Logs update every 2 seconds** when shown

---

## 🐛 Troubleshooting

### Writer won't start?
- Check if port 8883 is accessible (MQTT broker running?)
- Check if InfluxDB is running on port 8086
- Check `/tmp/influxdb_writer.log` for errors

### Agent won't start?
- Check if Writer is running first (required)
- Check if MQTT broker is accessible
- Check `/tmp/mock_plc_machine-XX.log` for errors

### Status shows wrong?
- Status polling might be delayed (3 second interval)
- Process might have crashed (check logs)
- `pgrep` might not find process (check manually)

