# InfluxDB Query Guide

## Quick Access Methods

### Method 1: InfluxDB Web UI (Easiest)

1. **Open InfluxDB UI:**
   ```bash
   # If running in Docker
   open http://localhost:8086
   ```

2. **Login:**
   - Username: `admin`
   - Password: `admin123`

3. **Navigate to Data Explorer:**
   - Click "Data Explorer" in the left sidebar
   - Or go to: http://localhost:8086/orgs/myorg/data-explorer

4. **Select Bucket:**
   - Choose bucket: `plc_data_new`

5. **Write Query:**
   - Use the query builder or write Flux queries directly

---

### Method 2: Using Python Script (Recommended for Testing)

Create a Python script to query InfluxDB:

```python
from influxdb_client import InfluxDBClient
from datetime import datetime, timedelta

# Configuration
INFLUXDB_URL = "http://localhost:8086"
INFLUXDB_TOKEN = "my-super-secret-auth-token"
INFLUXDB_ORG = "myorg"
INFLUXDB_BUCKET = "plc_data_new"

# Create client
client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
query_api = client.query_api()

# Example Query 1: Get all data from last hour
query1 = f'''
from(bucket: "{INFLUXDB_BUCKET}")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> limit(n: 100)
'''

print("📊 Query 1: Last hour of data (first 100 points)")
result1 = query_api.query(query1)
for table in result1:
    for record in table.records:
        print(f"  {record.get_time()}: {record.get_field()}={record.get_value()}")

# Example Query 2: Latest values for a specific machine
query2 = f'''
from(bucket: "{INFLUXDB_BUCKET}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> last()
'''

print("\n📊 Query 2: Latest values for machine-01")
result2 = query_api.query(query2)
for table in result2:
    for record in table.records:
        print(f"  {record.get_field()}: {record.get_value()}")

# Example Query 3: Count total data points
query3 = f'''
from(bucket: "{INFLUXDB_BUCKET}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> count()
'''

print("\n📊 Query 3: Total data points in last 24h")
result3 = query_api.query(query3)
for table in result3:
    for record in table.records:
        print(f"  Total points: {record.get_value()}")

client.close()
```

---

### Method 3: Using InfluxDB CLI

1. **Install InfluxDB CLI** (if not already installed):
   ```bash
   # macOS
   brew install influxdb
   
   # Or download from: https://portal.influxdata.com/downloads/
   ```

2. **Configure connection:**
   ```bash
   influx config create \
     --name local \
     --host-url http://localhost:8086 \
     --org myorg \
     --token my-super-secret-auth-token \
     --active
   ```

3. **Run queries:**
   ```bash
   influx query '
     from(bucket: "plc_data_new")
       |> range(start: -1h)
       |> filter(fn: (r) => r["_measurement"] == "plc_data")
       |> limit(n: 10)
   '
   ```

---

## Common Flux Queries

### 1. View All Recent Data
```flux
from(bucket: "plc_data_new")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> limit(n: 100)
```

### 2. Latest Values for Specific Machine
```flux
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> last()
```

### 3. All Tags for a Machine (Pivot Table)
```flux
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 1)
```

### 4. Specific Field Over Time
```flux
from(bucket: "plc_data_new")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "BottlesFilled")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
```

### 5. Count Data Points by Machine
```flux
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> group(columns: ["machine_id"])
  |> count()
```

### 6. Check Which Machines Have Data
```flux
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> keep(columns: ["machine_id"])
  |> distinct(column: "machine_id")
```

### 7. Average Values Over Time Window
```flux
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "BottlesPerMinute")
  |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
```

### 8. Check for Alarms (Boolean Fields)
```flux
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "AlarmFault" or 
                      r["_field"] == "AlarmOverfill" or
                      r["_field"] == "AlarmUnderfill")
  |> filter(fn: (r) => r["_value"] == true)
  |> last()
```

---

## Step-by-Step: Query via Web UI

### Step 1: Access InfluxDB
```
http://localhost:8086
```

### Step 2: Login
- Username: `admin`
- Password: `admin123`

### Step 3: Go to Data Explorer
- Click "Data Explorer" in left sidebar
- Or: http://localhost:8086/orgs/myorg/data-explorer

### Step 4: Select Bucket
- Click "Select Bucket" dropdown
- Choose: `plc_data_new`

### Step 5: Build Query
- Click "Script Editor" tab
- Paste one of the queries above
- Click "Submit"

### Step 6: View Results
- Results appear in table format
- You can export as CSV
- Switch to "Graph" view for visualizations

---

## Step-by-Step: Query via Python

### Step 1: Create Query Script
```bash
cd /Users/khanhamza/mqtt-ot-network
nano query_influxdb.py
```

### Step 2: Paste Query Code
Copy one of the Python examples above

### Step 3: Run Script
```bash
python3 query_influxdb.py
```

---

## Quick Test Query

Run this to see if you have data:

```python
from influxdb_client import InfluxDBClient

client = InfluxDBClient(
    url="http://localhost:8086",
    token="my-super-secret-auth-token",
    org="myorg"
)

query = '''
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> limit(n: 5)
'''

result = client.query_api().query(query)
count = 0
for table in result:
    for record in table.records:
        count += 1
        print(f"{count}. {record.get_time()}: {record.get_field()} = {record.get_value()}")

print(f"\n✅ Found {count} data points")
client.close()
```

---

## Troubleshooting

### No Data Found?
1. Check time range - try `-24h` or `-7d`
2. Verify bucket name: `plc_data_new`
3. Check if services are running:
   ```bash
   pgrep -f influxdb_writer_production.py
   pgrep -f mock_plc_agent.py
   ```

### Connection Error?
1. Verify InfluxDB is running:
   ```bash
   docker ps | grep influxdb
   ```
2. Check port: `http://localhost:8086`
3. Verify token: `my-super-secret-auth-token`

### Wrong Timezone?
- InfluxDB stores in UTC
- Adjust queries for your timezone
- Use wider time ranges: `-24h` instead of `-5m`

