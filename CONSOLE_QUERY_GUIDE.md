# Console Query Guide for InfluxDB

## Quick Start: Query from Terminal

### Method 1: Using Python Script (Easiest)

**Run the quick query script:**
```bash
cd /Users/khanhamza/mqtt-ot-network
python3 quick_query.py
```

This shows the latest values for `machine-01`.

---

### Method 2: Interactive Python Console

**Start Python and query interactively:**
```bash
cd /Users/khanhamza/mqtt-ot-network
python3
```

Then in Python:
```python
from influxdb_client import InfluxDBClient

# Connect
client = InfluxDBClient(
    url="http://localhost:8086",
    token="my-super-secret-auth-token",
    org="myorg"
)

query_api = client.query_api()

# Query: Latest values for machine-01
query = '''
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> last()
'''

result = query_api.query(query)
for table in result:
    for record in table.records:
        print(f"{record.get_field()}: {record.get_value()}")

# Close when done
client.close()
```

---

### Method 3: One-Liner Query

**Quick one-liner to see latest data:**
```bash
cd /Users/khanhamza/mqtt-ot-network
python3 -c "
from influxdb_client import InfluxDBClient
client = InfluxDBClient(url='http://localhost:8086', token='my-super-secret-auth-token', org='myorg')
result = client.query_api().query('from(bucket: \"plc_data_new\") |> range(start: -24h) |> filter(fn: (r) => r[\"_measurement\"] == \"plc_data\") |> filter(fn: (r) => r[\"machine_id\"] == \"machine-01\") |> last()')
for table in result:
    for record in table.records:
        print(f'{record.get_field()}: {record.get_value()}')
client.close()
"
```

---

### Method 4: Using InfluxDB CLI

**Install InfluxDB CLI (if not installed):**
```bash
# macOS
brew install influxdb

# Or download from: https://portal.influxdata.com/downloads/
```

**Configure connection:**
```bash
influx config create \
  --name local \
  --host-url http://localhost:8086 \
  --org myorg \
  --token my-super-secret-auth-token \
  --active
```

**Run query:**
```bash
influx query '
  from(bucket: "plc_data_new")
    |> range(start: -24h)
    |> filter(fn: (r) => r["_measurement"] == "plc_data")
    |> filter(fn: (r) => r["machine_id"] == "machine-01")
    |> last()
'
```

---

### Method 5: Using curl (HTTP API)

**Query via HTTP API:**
```bash
curl -X POST "http://localhost:8086/api/v2/query?org=myorg" \
  -H "Authorization: Token my-super-secret-auth-token" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "plc_data_new")
        |> range(start: -24h)
        |> filter(fn: (r) => r["_measurement"] == "plc_data")
        |> filter(fn: (r) => r["machine_id"] == "machine-01")
        |> last()'
```

---

## Common Queries

### 1. Latest Values for a Machine
```python
query = '''
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> last()
'''
```

### 2. All Recent Data Points
```python
query = '''
from(bucket: "plc_data_new")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> limit(n: 100)
'''
```

### 3. Count Total Data Points
```python
query = '''
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> count()
'''
```

### 4. All Tags in Pivot Table
```python
query = '''
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 1)
'''
```

### 5. Specific Field Over Time
```python
query = '''
from(bucket: "plc_data_new")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "BottlesFilled")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
'''
```

### 6. Which Machines Have Data
```python
query = '''
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> keep(columns: ["machine_id"])
  |> distinct(column: "machine_id")
'''
```

---

## Quick Reference

**Configuration:**
- URL: `http://localhost:8086`
- Token: `my-super-secret-auth-token`
- Org: `myorg`
- Bucket: `plc_data_new`
- Measurement: `plc_data`

**Time Ranges:**
- `-5m` = last 5 minutes
- `-1h` = last 1 hour
- `-24h` = last 24 hours
- `-7d` = last 7 days

**Common Fields:**
- `SystemRunning`, `Fault`, `Filling`, `Ready`
- `BottlesFilled`, `BottlesRejected`, `BottlesPerMinute`
- `AlarmFault`, `AlarmOverfill`, `AlarmUnderfill`, etc.
- `FillLevel`, `TankTemperature`, `TankPressure`, etc.

---

## Example: Full Interactive Session

```bash
$ cd /Users/khanhamza/mqtt-ot-network
$ python3
```

```python
>>> from influxdb_client import InfluxDBClient
>>> client = InfluxDBClient(url="http://localhost:8086", token="my-super-secret-auth-token", org="myorg")
>>> query_api = client.query_api()

>>> # Query latest BottlesFilled
>>> query = 'from(bucket: "plc_data_new") |> range(start: -24h) |> filter(fn: (r) => r["_measurement"] == "plc_data") |> filter(fn: (r) => r["machine_id"] == "machine-01") |> filter(fn: (r) => r["_field"] == "BottlesFilled") |> last()'
>>> result = query_api.query(query)
>>> for table in result:
...     for record in table.records:
...         print(f"BottlesFilled: {record.get_value()}")
...
BottlesFilled: 673

>>> # Count total data points
>>> query = 'from(bucket: "plc_data_new") |> range(start: -24h) |> filter(fn: (r) => r["_measurement"] == "plc_data") |> count()'
>>> result = query_api.query(query)
>>> for table in result:
...     for record in table.records:
...         print(f"Total points: {record.get_value()}")
...
Total points: 9409

>>> client.close()
>>> exit()
```

---

## Troubleshooting

**No data found?**
- Check time range (try `-24h` instead of `-5m`)
- Verify bucket name: `plc_data_new`
- Check if services are running:
  ```bash
  pgrep -f influxdb_writer_production.py
  pgrep -f mock_plc_agent.py
  ```

**Connection error?**
- Verify InfluxDB is running:
  ```bash
  docker ps | grep influxdb
  ```
- Check port: `http://localhost:8086`
- Verify token is correct

**Import error?**
- Install influxdb-client:
  ```bash
  pip install influxdb-client
  ```

